/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/admin/batches/:id/label',
        destination: '/admin/batches/:id/print',
        permanent: false
      }
    ];
  }
};

module.exports = nextConfig;
