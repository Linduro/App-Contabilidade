const GITHUB_SITE_BASE = "/App-Contabilidade"
const NETWORKING_PAGES_SEGMENT = "_internal/f7c2-network"

const isGithubPages = process.env.GITHUB_PAGES === "true"
const basePath = isGithubPages
  ? `${GITHUB_SITE_BASE}/${NETWORKING_PAGES_SEGMENT}`
  : ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: isGithubPages ? "export" : undefined,
  basePath,
  assetPrefix: isGithubPages ? `${basePath}/` : "",
  trailingSlash: isGithubPages,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

export default nextConfig
