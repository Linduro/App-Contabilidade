# Web3 — status do deploy

## Polygon Amoy — cancelado

O deploy público na **Polygon Amoy** foi **interrompido** porque não foi possível obter **POL de teste** (gas) de forma confiável nos faucets.

- Contratos compilam e **16 testes** passam em `npx hardhat test --network hardhat`
- Deploy parcial na Amoy deixou apenas `CredentialNFT` (`0x66d3EfbA31A31e666Ef626bC4b8573a02A51F118`) — **não use** sem o restante do hub (ReputationSBT + ServiceEscrow)
- USDC na carteira **não substitui** POL para deploy

## O que continua funcionando

| Parte | Status |
|--------|--------|
| App (login, perfis, rede, conexões) | Normal |
| `walletAddress` no banco | Pode vincular depois, quando Web3 voltar |
| Leitura on-chain (`/web3/*`) | Desligada com `WEB3_ENABLED=false` |
| Testes locais Hardhat | `cd networking-contracts && npx hardhat test` |

## Se retomar no futuro

1. Obter POL na Amoy (ou usar outra rede com faucet estável)
2. `echo y | npx hardhat ignition deploy ignition/modules/NetworkingHubAmoy.ts --network polygon_amoy`
3. `npx hardhat run scripts/export-amoy-json.ts`
4. No hub: `WEB3_ENABLED=true` + endereços em `deployments/amoy.json`
5. No web: `NEXT_PUBLIC_WEB3_ENABLED=true`

## Alternativa só para demo local

```bash
npx hardhat node
# outro terminal:
npx hardhat ignition deploy ignition/modules/NetworkingHub.ts --network localhost
```

MetaMask na rede **Hardhat (31337)** — não é a Amoy; serve apenas para demo em máquina local.
