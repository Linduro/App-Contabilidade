#!/usr/bin/env node
/** Deploy Cloud Run local usando credenciais Firebase OAuth (owner). */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const PROJECT = 'contabilidade-ebed6';
const REGION = 'southamerica-east1';
const SERVICE = 'afs-market-intelligence';
const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const MARKET = path.join(REPO_ROOT, 'afs-market-intelligence');
const GCLOUD = path.join(
  process.env.LOCALAPPDATA || '',
  'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd',
);

function firebaseConfigPath() {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Firebase CLI não autenticado');
}

async function createDeployKey(token) {
  const sa = `projects/${PROJECT}/serviceAccounts/firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com`;
  const res = await fetch(`https://iam.googleapis.com/v1/${sa}/keys`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyAlgorithm: 'KEY_ALG_RSA_2048', privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE' }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('createKey: ' + JSON.stringify(data));
  const keyPath = path.join(REPO_ROOT, `.tmp-afs-deploy-key-${Date.now()}.json`);
  fs.writeFileSync(keyPath, Buffer.from(data.privateKeyData, 'base64'));
  return { keyPath, keyName: data.name };
}

async function deleteKey(token, keyName) {
  await fetch(`https://iam.googleapis.com/v1/${keyName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
  try { fs.unlinkSync(path.join(os.tmpdir(), 'afs-deploy-key.json')); } catch (_) {}
}

function run(cmd, args, opts = {}) {
  const quoted = `"${cmd}" ${args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`;
  console.log('>', quoted);
  const r = spawnSync(quoted, { stdio: 'inherit', shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status || 1);
}

async function main() {
  if (!fs.existsSync(GCLOUD)) throw new Error('gcloud não encontrado: ' + GCLOUD);
  const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath(), 'utf8'));
  let token = cfg.tokens?.access_token;
  if (!token || (cfg.tokens.expires_at || 0) < Date.now() + 60000) {
    throw new Error('Token Firebase expirado — rode: npx firebase-tools login');
  }

  const { keyPath, keyName } = await createDeployKey(token);
  console.log('Chave temporária criada (será removida após deploy)\n');

  try {
    spawnSync(`"${GCLOUD}" auth revoke --all --quiet`, { shell: true, stdio: 'ignore' });
    run(GCLOUD, ['auth', 'activate-service-account', '--key-file=' + keyPath, '--quiet']);
    run(GCLOUD, ['config', 'set', 'project', PROJECT, '--quiet']);
    run(GCLOUD, [
      'run', 'deploy', SERVICE,
      '--source', MARKET,
      '--region', REGION,
      '--platform', 'managed',
      '--allow-unauthenticated',
      '--set-env-vars', 'DB_ENGINE=duckdb,DB_PATH=/app/data/afs_market.duckdb',
      '--memory', '2Gi',
      '--cpu', '2',
      '--timeout', '3600',
      '--max-instances', '3',
      '--quiet',
    ], { cwd: MARKET });

    const urlOut = spawnSync(
      `"${GCLOUD}" run services describe ${SERVICE} --region ${REGION} --format=value(status.url)`,
      { encoding: 'utf8', shell: true },
    );
    const url = (urlOut.stdout || '').trim();
    console.log('\n✅ Cloud Run URL:', url);

    if (url) {
      process.env.SERVICE_URL = url;
      run('node', [path.join(REPO_ROOT, 'scripts', 'update-afs-market-config.mjs')], { cwd: REPO_ROOT });
      console.log('\nconfig.json atualizado com apiBase:', url);
    }
  } finally {
    try { fs.unlinkSync(keyPath); } catch (_) {}
    await deleteKey(token, keyName);
    console.log('Chave temporária removida.');
  }
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
