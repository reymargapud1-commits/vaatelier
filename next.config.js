/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @napi-rs/canvas ships a native .node binary (used by the welcome-banner
  // generator) - it must stay an external require, not get bundled/parsed
  // by webpack, or the production build fails trying to parse the binary.
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas"],
  },
};

module.exports = nextConfig;
