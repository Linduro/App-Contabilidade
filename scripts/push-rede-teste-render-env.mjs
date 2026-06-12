#!/usr/bin/env node
/**
 * Envia variáveis de rede-teste-web/.env.render para o serviço Render "rede-teste".
 * Uso: RENDER_API_KEY=rnd_... node scripts/push-rede-teste-render-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, "rede-teste-web", ".env.render");
const apiKey = process.env.RENDER_API_KEY?.trim();
const serviceName = process.env.RENDER_SERVICE_NAME?.trim() || "rede-teste";

if (!apiKey) {
  console.error("Defina RENDER_API_KEY (Render → Account Settings → API Keys).");
  process.exit(1);
}
if (!existsSync(envPath)) {
  console.error(`Arquivo não encontrado: ${envPath}`);
  process.exit(1);
}

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

async function api(path, opts = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${path}: ${body}`);
  return body ? JSON.parse(body) : null;
}

async function listEnvVars(serviceId) {
  const merged = {};
  let cursor = null;
  do {
    const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=100` : "?limit=100";
    const page = await api(`/services/${serviceId}/env-vars${q}`);
    for (const row of page) {
      if (row?.envVar?.key) merged[row.envVar.key] = row.envVar.value ?? "";
    }
    cursor = page?.length ? page[page.length - 1]?.cursor : null;
  } while (cursor);
  return merged;
}

const vars = parseEnv(readFileSync(envPath, "utf8"));
const list = await api(`/services?name=${encodeURIComponent(serviceName)}&limit=20`);
const service = list?.find?.((row) => row.service?.name === serviceName)?.service;
if (!service?.id) {
  console.error(`Serviço "${serviceName}" não encontrado no Render. Faça o deploy do blueprint primeiro.`);
  process.exit(1);
}

console.log(`Serviço: ${service.name} (${service.id})`);

const existing = await listEnvVars(service.id);
const merged = { ...existing, ...vars };
const payload = Object.entries(merged).map(([key, value]) => ({
  envVar: { key, value },
}));

await api(`/services/${service.id}/env-vars`, {
  method: "PUT",
  body: JSON.stringify(payload),
});

for (const key of Object.keys(vars)) {
  console.log(`  ✓ ${key}`);
}

await api(`/services/${service.id}/deploys`, {
  method: "POST",
  body: JSON.stringify({ clearCache: "clear" }),
});
console.log("Deploy disparado. Aguarde ~10–15 min em https://rede-teste.onrender.com/rede-teste");
