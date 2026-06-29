/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@office/types'],
  output: 'standalone',
};

export default nextConfig;
