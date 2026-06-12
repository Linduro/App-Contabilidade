import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@nomicfoundation/hardhat-ignition-ethers"
import "hardhat-gas-reporter"
import "solidity-coverage"
import * as dotenv from "dotenv"

dotenv.config()

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY ?? ""

function resolveDeployAccounts(): string[] {
  const pk = process.env.PRIVATE_KEY?.trim()
  if (pk && /^0x[0-9a-fA-F]{64}$/.test(pk)) {
    return [pk]
  }
  return []
}

const accounts = resolveDeployAccounts()

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: {},
    polygon_amoy: {
      url: process.env.POLYGON_AMOY_RPC_URL ?? "https://rpc-amoy.polygon.technology",
      chainId: 80002,
      accounts,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL ?? `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
      chainId: 137,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      polygonAmoy: process.env.POLYGONSCAN_API_KEY ?? "",
      polygon: process.env.POLYGONSCAN_API_KEY ?? "",
    },
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
}

export default config
