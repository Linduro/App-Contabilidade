import { getDefaultConfig } from "connectkit"
import { createConfig } from "wagmi"
import { polygon, polygonAmoy } from "wagmi/chains"

export const wagmiConfig = createConfig(
  getDefaultConfig({
    appName: "FIPECAFI Network",
    walletConnectProjectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "00000000000000000000000000000000",
    chains: [polygonAmoy, polygon],
    ssr: true,
  })
)
