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
  webpack: (config, { isServer }) => {
    // фиксим ноды-модули на клиенте
    if (!isServer) {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        net: false,
        tls: false,
      }

      // ГАРАНТИРУЕМ наличие MiniCssExtractPlugin,
      // чтобы не было ошибки "You forgot to add 'mini-css-extract-plugin'..."
      config.plugins = config.plugins || []
      const hasMiniCss = config.plugins.some(
        (plugin) => plugin?.constructor?.name === "MiniCssExtractPlugin",
      )

      if (!hasMiniCss) {
        config.plugins.push(
          new MiniCssExtractPlugin({
            filename: "static/css/[name].[contenthash].css",
            chunkFilename: "static/css/[id].[contenthash].css",
          }),
        )
      }
    }

    return config
  },
}

export default nextConfig
