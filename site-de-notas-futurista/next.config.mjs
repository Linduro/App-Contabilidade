/** @type {import('next').NextConfig} */
const isGithubPages = process.env.GITHUB_PAGES === 'true'
const basePath = isGithubPages ? '/App-Contabilidade' : ''

const nextConfig = {
  output: isGithubPages ? 'export' : undefined,
  basePath,
  assetPrefix: isGithubPages ? '/App-Contabilidade/' : '',
  trailingSlash: isGithubPages,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    NEXT_PUBLIC_AFS_API_URL: process.env.NEXT_PUBLIC_AFS_API_URL ?? '',
    NEXT_PUBLIC_AFS_MARKET_API_URL: process.env.NEXT_PUBLIC_AFS_MARKET_API_URL ?? '',
    NEXT_PUBLIC_GITHUB_PAGES: isGithubPages ? 'true' : '',
  },
  async rewrites() {
    if (isGithubPages) return []
    const afsApiPrefix = basePath ? `${basePath}/afs-api` : '/afs-api'
    const marketApiPrefix = basePath ? `${basePath}/afs-market-api` : '/afs-market-api'
    return [
      {
        source: `${afsApiPrefix}/:path*`,
        destination: 'http://127.0.0.1:5000/api/:path*',
      },
      {
        source: `${marketApiPrefix}/:path*`,
        destination: 'http://127.0.0.1:5001/api/:path*',
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
