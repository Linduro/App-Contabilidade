/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["connectkit"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    }
    config.externals.push("pino-pretty", "lokijs", "encoding")
    return config
  },
}

export default nextConfig
