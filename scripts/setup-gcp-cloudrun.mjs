#!/usr/bin/env node
/**
 * Habilita APIs Cloud Run + IAM para deploy via GitHub Actions.
 * Usa credenciais do Firebase CLI (cartoonhq / owner do projeto).
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

const PROJECT = 'contabilidade-ebed6';
const REGION = 'southamerica-east1';
const FIREBASE_SA = `firebase-adminsdk-fbsvc@${PROJECT}.iam.gserviceaccount.com`;
const CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const APIS = [
  'run.googleapis.com',
  'cloudbuild.googleapis.com',
  'artifactregistry.googleapis.com',
  'containerregistry.googleapis.com',
  'iam.googleapis.com',
  'serviceusage.googleapis.com',
  'cloudresourcemanager.googleapis.com',
];

const SA_ROLES = [
  'roles/run.admin',
  'roles/cloudbuild.builds.editor',
  'roles/iam.serviceAccountUser',
  'roles/storage.admin',
  'roles/artifactregistry.writer',
  'roles/serviceusage.serviceUsageAdmin',
];

function firebaseConfigPath() {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('firebase-tools.json não encontrado. Rode: npx firebase-tools login');
}

async function getAccessToken() {
  const cfg = JSON.parse(fs.readFileSync(firebaseConfigPath(), 'utf8'));
  const expiresAt = cfg?.tokens?.expires_at || 0;
  if (cfg?.tokens?.access_token && expiresAt > Date.now() + 60000) {
    return cfg.tokens.access_token;
  }
  const refresh = cfg?.tokens?.refresh_token;
  if (!refresh) throw new Error('Sem refresh_token no Firebase CLI. Rode: npx firebase-tools login');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error('Falha ao obter access_token: ' + JSON.stringify(data));
  }
  return data.access_token;
}

async function gcp(token, url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try { body = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!res.ok) {
    const msg = typeof body === 'object' ? JSON.stringify(body) : text;
    throw new Error(`${opts.method || 'GET'} ${url} → ${res.status}: ${msg}`);
  }
  return body;
}

async function enableApi(token, service) {
  const url = `https://serviceusage.googleapis.com/v1/projects/${PROJECT}/services/${service}:enable`;
  try {
    await gcp(token, url, { method: 'POST', body: '{}' });
    console.log(`  ✓ ${service}`);
  } catch (e) {
    if (String(e.message).includes('ALREADY_ENABLED') || String(e.message).includes('already enabled')) {
      console.log(`  · ${service} (já ativa)`);
    } else {
      throw e;
    }
  }
}

async function grantRoles(token) {
  const getUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:getIamPolicy`;
  const policy = await gcp(token, getUrl, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  policy.bindings = policy.bindings || [];
  const member = `serviceAccount:${FIREBASE_SA}`;

  for (const role of SA_ROLES) {
    let binding = policy.bindings.find((b) => b.role === role);
    if (!binding) {
      binding = { role, members: [] };
      policy.bindings.push(binding);
    }
    if (!binding.members.includes(member)) {
      binding.members.push(member);
      console.log(`  + ${role}`);
    } else {
      console.log(`  · ${role} (já concedida)`);
    }
  }

  const setUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT}:setIamPolicy`;
  await gcp(token, setUrl, {
    method: 'POST',
    body: JSON.stringify({ policy }),
  });
}

async function linkBilling(token) {
  const accounts = await gcp(token, 'https://cloudbilling.googleapis.com/v1/billingAccounts');
  const open = (accounts.billingAccounts || []).find((a) => a.open);
  if (!open) throw new Error('Nenhuma conta de faturamento aberta no GCP.');
  const name = open.name;
  const url = `https://cloudbilling.googleapis.com/v1/projects/${PROJECT}/billingInfo`;
  await gcp(token, url, {
    method: 'PUT',
    body: JSON.stringify({ billingAccountName: name, billingEnabled: true }),
  });
  console.log(`  ✓ Faturamento vinculado (${open.displayName || name})`);
}

async function main() {
  console.log(`\n=== Setup GCP Cloud Run — ${PROJECT} ===\n`);
  const token = await getAccessToken();
  console.log('Token OAuth OK\n');

  console.log('1/3 Vinculando faturamento…');
  try {
    await linkBilling(token);
  } catch (e) {
    if (String(e.message).includes('already linked') || String(e.message).includes('BILLING_ALREADY')) {
      console.log('  · Faturamento já vinculado');
    } else {
      throw e;
    }
  }

  console.log('\n2/3 Habilitando APIs…');
  for (const api of APIS) {
    await enableApi(token, api);
  }

  console.log('\n3/3 Concedendo roles à', FIREBASE_SA);
  await grantRoles(token);

  console.log('\n✅ GCP pronto para deploy Cloud Run.');
  console.log('\nPróximo passo: dispare o workflow no GitHub Actions:');
  console.log('  Deploy AFS Market Intelligence (Cloud Run)\n');
}

main().catch((e) => {
  console.error('\n❌', e.message || e);
  process.exit(1);
});
