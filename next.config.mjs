/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.optimization.concatenateModules = false;
    return config;
  }
};

export default nextConfig;
