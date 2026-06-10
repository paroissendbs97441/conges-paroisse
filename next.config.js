/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdfkit", "fontkit"],
  },
  outputFileTracingExcludes: {
    "*": ["node_modules/pdfkit/**", "node_modules/fontkit/**"],
  },
};
module.exports = nextConfig;
