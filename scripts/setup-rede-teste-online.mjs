#!/usr/bin/env node
/**
 * Configura Supabase (IPs Render) + Render (env vars) em um comando.
 *
 * Uso:
 *   RENDER_API_KEY=rnd_... node scripts/setup-rede-teste-online.mjs
 *
 * Opcional (allowlist no Supabase via Management API):
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/setup-rede-teste-online.mjs
 *
 * IPs Render (saída outbound) — padrão abaixo; sobrescreva com RENDER_OUTBOUND_CIDRS=ip1,ip2
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, "rede-teste-web", ".env.render");
const projectRef = "diuudxdcemegubuajvql";

const renderApiKey = process.env.RENDER_API_KEY?.trim();
const supabaseToken = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const renderCidrs = (
  process.env.RENDER_OUTBOUND_CIDRS ??
  "74.220.48.0/24,74.220.56.0/24"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function supabaseApi(path, opts = {}) {
  const res = await fetch(`https://api.supabase.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${supabaseToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} ${path}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function configureSupabaseNetwork() {
  if (!supabaseToken) {
    console.log("⊘ Supabase: SUPABASE_ACCESS_TOKEN ausente — pulando allowlist.");
    console.log("  Token: https://supabase.com/dashboard/account/tokens");
    return;
  }

  console.log("→ Supabase: liberando IPs do Render no Postgres...");
  const current = await supabaseApi(
    `/projects/${projectRef}/network-restrictions`,
  );
  const existing = (current?.config?.dbAllowedCidrs ?? [])
    .map((row) => row?.address)
    .filter(Boolean);

  const merged = [...new Set([...existing, ...renderCidrs, "0.0.0.0/0"])];
  await supabaseApi(`/projects/${projectRef}/network-restrictions/apply`, {
    method: "POST",
    body: JSON.stringify({ dbAllowedCidrs: merged }),
  });
  for (const cidr of renderCidrs) console.log(`  ✓ allow ${cidr}`);
  console.log("  ✓ Supabase network restrictions atualizadas");
}

async function configureRender() {
  if (!renderApiKey) {
    console.error("✗ Render: defina RENDER_API_KEY (Account Settings → API Keys).");
    process.exit(1);
  }
  if (!existsSync(envPath)) {
    console.error(`✗ Arquivo não encontrado: ${envPath}`);
    process.exit(1);
  }

  console.log("→ Render: enviando variáveis e disparando deploy...");
  const pushScript = join(__dirname, "push-rede-teste-render-env.mjs");
  const result = spawnSync(process.execPath, [pushScript], {
    cwd: root,
    env: { ...process.env, RENDER_API_KEY: renderApiKey },
    stdio: "inherit",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

async function testSupabaseDb() {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  const match = text.match(/^DATABASE_URL=(.+)$/m);
  if (!match) return;
  let url = match[1].trim();
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1);
  }
  try {
    const pg = await import(pathToFileURL(join(root, "rede-teste-web", "node_modules", "pg", "lib", "index.js")).href);
    const { createPgPool } = await import(
      pathToFileURL(join(root, "rede-teste-web", "lib", "pg-connection.ts")).href
    );
    const pool = createPgPool(url);
    await pool.query("select 1");
    await pool.end();
    console.log("✓ Teste local: Supabase Postgres respondeu OK");
  } catch (err) {
    console.warn(`⚠ Teste local Supabase falhou: ${err.message}`);
  }
}

console.log("=== Setup Rede Teste (Supabase + Render) ===\n");
await testSupabaseDb();
await configureSupabaseNetwork();
await configureRender();
console.log("\nPronto. Aguarde ~10 min e teste: https://rede-teste.onrender.com/rede-teste");
