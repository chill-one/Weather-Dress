// next.config.js
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000';

module.exports = {
  turbopack: {
    root: process.cwd(),
  },
  async rewrites() {
    return [
      {
        source: '/api/weather/:path*',
        destination: `${BACKEND_URL}/weather/:path*`,
      },
    ]
  },
}
