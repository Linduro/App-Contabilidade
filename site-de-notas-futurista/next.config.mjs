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
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
