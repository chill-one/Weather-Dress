// next.config.js
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000';

module.exports = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/:path*`,
      },
    ]
  },
}
