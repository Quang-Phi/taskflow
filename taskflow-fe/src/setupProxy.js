/**
 * CRA Dev Server Proxy (src/setupProxy.js)
 *
 * Proxies all /api/* /auth/* /callback requests from localhost:3000
 * to the real backend (ngrok or local IP), so the browser never makes
 * cross-origin requests → no CORS issues in development.
 *
 * Target priority:
 *   1. REACT_APP_NGROK_URL  (e.g. https://xxx.ngrok-free.app)
 *   2. REACT_APP_API_URL stripped of /api suffix
 *   3. http://localhost:8000
 *
 * Header `ngrok-skip-browser-warning` is injected on every proxied
 * request so ngrok free-tier never serves its warning HTML page
 * (which would break CORS preflight OPTIONS responses).
 */
const { createProxyMiddleware } = require('http-proxy-middleware');

const resolveTarget = () => {
  // 1. Explicit ngrok URL
  if (process.env.REACT_APP_NGROK_URL) {
    return process.env.REACT_APP_NGROK_URL.replace(/\/+$/, '');
  }
  // 2. API URL minus /api suffix
  const apiUrl = process.env.REACT_APP_API_URL || '';
  if (apiUrl && !apiUrl.includes('localhost')) {
    return apiUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
  // 3. Local fallback
  return 'http://localhost:8000';
};

const target = resolveTarget();
console.log(`[setupProxy] → ${target}`);

module.exports = function (app) {
  const opts = {
    target,
    changeOrigin: true,
    secure: false,
    on: {
      proxyReq: (proxyReq) => {
        proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
      },
      error: (err, req, res) => {
        console.error('[setupProxy] error:', err.message);
        if (!res.headersSent) {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: 'Proxy error: ' + err.message }));
        }
      },
    },
  };

  app.use('/api', createProxyMiddleware(opts));
  app.use('/auth', createProxyMiddleware(opts));
  app.use('/callback', createProxyMiddleware(opts));
  app.use('/storage', createProxyMiddleware(opts));
};
