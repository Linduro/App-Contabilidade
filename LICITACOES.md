# Licitações Advocacia — Firestore (sem Blaze, sem Supabase)

Módulo integrado ao portal **site-de-notas-futurista**. Dados no **Firestore** (plano Spark gratuito), acesso **somente** para `cartoonhq@gmail.com`.

## Arquitetura

```
GitHub Pages (/dashboard/licitacoes)
    ↓ Firebase Auth + Firestore SDK (direto)
Firestore (licitacoesMatches, licitacoes, …)
    ↑
Job local ou GitHub Actions (firebase-admin)
```

**Não usa:** Cloud Functions (Blaze), Supabase.

## Coleções Firestore

| Coleção | Conteúdo |
|---------|----------|
| `licitacoesConfig/owner` | Perfil owner + especialidades |
| `licitacoesEspecialidades/{slug}` | Catálogo NLP |
| `licitacoes/{id}` | Licitações coletadas |
| `licitacoesMatches/{id}` | Matches (licitação + especialidade embutidos) |

Rules em `site-de-notas-futurista/firestore.rules` — `isAdmin()` = `cartoonhq@gmail.com`.

## Setup inicial (uma vez)

### 1. Deploy das Firestore Rules

```powershell
cd site-de-notas-futurista
npx -y firebase-tools@latest deploy --only firestore:rules
```

Funciona no **plano Spark** (grátis).

### 2. Seed no Firestore

Baixe a **service account** em Firebase Console → Project Settings → Service accounts → Generate new private key.

```powershell
cd licitacoes-advocacia/backend
npm install
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\contabilidade-ebed6-firebase-adminsdk.json"
npm run seed:firestore
```

Isso cria especialidades + owner `cartoonhq@gmail.com`.

### 3. Coleta de licitações (quando quiser)

**Setup (uma vez):**

```powershell
cd licitacoes-advocacia\backend
copy .env.example .env
# Edite .env → GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\chave-firebase.json
npm run setup:python
```

Service account: Firebase Console → Project Settings → Service accounts → Generate new private key.

**Caçar licitações na hora:**

```powershell
cd licitacoes-advocacia\backend
.\coletar.ps1
```

Ou, da pasta `licitacoes-advocacia`: `npm run job:collect`

Depois atualize o dashboard no navegador (F5).

## URL

https://linduro.github.io/App-Contabilidade/dashboard/licitacoes/

Login com **cartoonhq@gmail.com** → botão **Licitações** no painel.

## Variáveis (.env do backend)

```env
FIREBASE_PROJECT_ID=contabilidade-ebed6
GOOGLE_APPLICATION_CREDENTIALS=C:\caminho\service-account.json
RESEND_API_KEY=          # opcional — e-mails de alerta
EMAIL_FROM=
```

## Desenvolvimento local

```powershell
cd site-de-notas-futurista
npm run dev
# http://localhost:3000/dashboard/licitacoes/
```
