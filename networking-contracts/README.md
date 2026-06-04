# FIPECAFI Networking — Smart Contracts

Solidity ^0.8.24 · Hardhat · OpenZeppelin 5.x · Ignition · Polygon Amoy / PoS

## Contratos

| Contrato | Descrição |
|----------|-----------|
| `ServiceEscrow` | Marketplace USDC com escrow, disputas e taxa 5% |
| `ReputationSBT` | Soulbound reputation (ERC-721 não transferível) |
| `CredentialNFT` | Credenciais verificáveis (AccessControl + ERC-721) |
| `MockUSDC` | ERC-20 6 decimais para testes / Amoy |

## Setup

```bash
cd networking-contracts
npm install
cp .env.example .env
npm run compile
npm test
```

## Deploy (Ignition)

Local:

```bash
npm run deploy:local
```

Polygon Amoy:

```bash
npm run deploy:amoy
```

Parâmetros opcionais no deploy:

- `useMockUsdc` (default `true`)
- `usdcAddress` — USDC oficial quando `useMockUsdc=false`
- `treasury`, `platformFeeBps`, `admin`, `issuer`, `gelatoForwarder`

## Verificar no Polygonscan

```bash
npm run verify
```

Preencha os endereços em `.env` conforme `.env.example`.

## ERC-2771 (Gelato Relay)

Passe o endereço do forwarder Gelato em `GELATO_FORWARDER_ADDRESS` / parâmetro `gelatoForwarder` no deploy.
