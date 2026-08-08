const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const ACTION_HEADER = 'painel-local';
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 8192) throw new Error('Conteúdo muito grande.');
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error('JSON inválido.'); }
}

function actionAllowed(req) {
  return req.headers['x-leonus-action'] === ACTION_HEADER;
}

async function startDashboard({ database, controller, config }) {
  const publicDirectory = path.resolve(__dirname, '..', 'dashboard');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${config.dashboardHost}:${config.dashboardPort}`);

      if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        const [stats, footer, logs] = await Promise.all([
          database.dashboardStats(),
          database.getSetting('ticket_footer', config.ticketFooter),
          database.listLogs(100)
        ]);
        return json(res, 200, {
          stats,
          footer,
          logs,
          bot: controller.status()
        });
      }

      if (req.method === 'PUT' && url.pathname === '/api/settings/footer') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        const body = await readJson(req);
        const footer = String(body.footer ?? '').trim();
        if (footer.length > 180) return json(res, 400, { error: 'A frase deve ter no máximo 180 caracteres.' });
        await database.setSetting('ticket_footer', footer);
        return json(res, 200, { ok: true, footer });
      }

      if (req.method === 'POST' && url.pathname === '/api/bot/restart') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        controller.restart().catch(error => controller.recordError('painel', error));
        return json(res, 202, { ok: true, message: 'Reinicialização solicitada.' });
      }

      if (req.method === 'DELETE' && url.pathname === '/api/whatsapp/session') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        controller.clearSession().catch(error => controller.recordError('painel', error));
        return json(res, 202, {
          ok: true,
          message: 'Limpeza solicitada. Será necessário escanear um novo QR Code no terminal.'
        });
      }

      if (req.method === 'DELETE' && url.pathname === '/api/logs') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        await database.clearLogs();
        return json(res, 200, { ok: true });
      }

      if (req.method === 'GET' && STATIC_FILES.has(url.pathname)) {
        const [filename, contentType] = STATIC_FILES.get(url.pathname);
        const file = await fs.readFile(path.join(publicDirectory, filename));
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'"
        });
        return res.end(file);
      }

      return json(res, 404, { error: 'Página não encontrada.' });
    } catch (error) {
      controller.recordError('painel', error);
      return json(res, 500, { error: error.message || 'Erro interno.' });
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.dashboardPort, config.dashboardHost, resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.dashboardPort;

  return {
    url: `http://${config.dashboardHost}:${port}`,
    port,
    close: () => new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())))
  };
}

module.exports = { ACTION_HEADER, startDashboard };
