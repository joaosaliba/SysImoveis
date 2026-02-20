import type { NextConfig } from "next";

console.log(`[NEXT_CONFIG] BACKEND_URL: ${process.env.BACKEND_URL}`);

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  transpilePackages: ['lucide-react', 'chart.js'], // Ensure modern packages are transpiled
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    console.log(`[NEXT_CONFIG] Setting rewrites with BACKEND_URL: ${process.env.BACKEND_URL}`);
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'http://127.0.0.1:3001'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
