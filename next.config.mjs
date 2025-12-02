// next.config.mjs
import MiniCssExtractPlugin from "next/dist/compiled/mini-css-extract-plugin"

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["localhost", "vercel.app"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
    unoptimized: true,
  },
  webpack: (config, { isServer, dev }) => {
    // твой fallback для fs/net/tls — оставляем
    if (!isServer) {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      }
    }

    // Гарантируем наличие MiniCssExtractPlugin в прод-клиенте
    if (!dev && !isServer) {
      const hasMiniCss = config.plugins?.some(
        (plugin) => plugin?.constructor?.name === "MiniCssExtractPlugin",
      )

      if (!hasMiniCss) {
        config.plugins.push(
          new MiniCssExtractPlugin({
            filename: "static/css/[contenthash].css",
            chunkFilename: "static/css/[contenthash].css",
          }),
        )
      }
    }

    return config
  },
}

export default nextConfig
