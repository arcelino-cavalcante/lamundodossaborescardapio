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
    if (body.length > 65536) throw new Error('Conteúdo muito grande.');
  }
  if (!body) return {};
  try { return JSON.parse(body); } catch { throw new Error('JSON inválido.'); }
}

function actionAllowed(req) {
  return req.headers['x-leonus-action'] === ACTION_HEADER;
}

function limitedText(value, maxLength, field, { required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new Error(`${field} é obrigatório.`);
  if (text.length > maxLength) throw new Error(`${field} está muito longo.`);
  return text;
}

function validMoney(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1000000) {
    throw new Error(`${field} deve ser um valor válido.`);
  }
  return Math.round(number * 100) / 100;
}

function validDateTime(value) {
  const text = String(value ?? '').trim().replace('T', ' ');
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/.test(text)) {
    throw new Error('Data e hora inválidas.');
  }
  const normalized = text.length === 16 ? `${text}:00` : text;
  if (Number.isNaN(new Date(normalized.replace(' ', 'T')).getTime())) throw new Error('Data e hora inválidas.');
  return normalized;
}

function normalizeOrder(body) {
  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length || rawItems.length > 100) throw new Error('O pedido deve ter entre 1 e 100 itens.');
  const items = rawItems.map((item, index) => {
    const quantity = Number.parseInt(item.quantity, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) {
      throw new Error(`Quantidade inválida no item ${index + 1}.`);
    }
    return {
      name: limitedText(item.name, 180, `Nome do item ${index + 1}`, { required: true }),
      category: limitedText(item.category, 100, `Categoria do item ${index + 1}`),
      quantity,
      total: validMoney(item.total, `Total do item ${index + 1}`),
      details: limitedText(item.details, 300, `Detalhes do item ${index + 1}`),
      observation: limitedText(item.observation, 300, `Observação do item ${index + 1}`),
      border: limitedText(item.border, 120, `Borda do item ${index + 1}`)
    };
  });
  const address = body.address && typeof body.address === 'object' ? body.address : {};
  return {
    name: limitedText(body.name, 120, 'Nome do cliente', { required: true }),
    customerWhatsapp: limitedText(body.whatsapp, 40, 'WhatsApp'),
    items,
    subtotal: validMoney(body.subtotal, 'Subtotal'),
    deliveryFee: validMoney(body.deliveryFee, 'Taxa de entrega'),
    total: validMoney(body.total, 'Total'),
    payment: limitedText(body.payment, 50, 'Forma de pagamento', { required: true }),
    paidAmount: validMoney(body.paidAmount ?? 0, 'Valor recebido'),
    change: validMoney(body.change ?? 0, 'Troco'),
    address: {
      street: limitedText(address.street, 240, 'Endereço'),
      sitio: limitedText(address.sitio, 160, 'Sítio'),
      reference: limitedText(address.reference, 240, 'Referência'),
      observation: limitedText(address.observation, 300, 'Observação geral')
    },
    dateTime: validDateTime(body.dateTime)
  };
}

async function startDashboard({ database, controller, config }) {
  const publicDirectory = path.resolve(__dirname, '..', 'dashboard');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${config.dashboardHost}:${config.dashboardPort}`);

      if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        const [stats, footer, printSize, logs] = await Promise.all([
          database.dashboardStats(),
          database.getSetting('ticket_footer', config.ticketFooter),
          database.getSetting('print_size', config.printSize || 1),
          database.listLogs(100)
        ]);
        return json(res, 200, {
          stats,
          footer,
          printSize: Number(printSize) || 1,
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

      if (req.method === 'PUT' && url.pathname === '/api/settings/printing') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        const body = await readJson(req);
        const footer = String(body.footer ?? '').trim();
        const printSize = Number.parseInt(body.printSize, 10);
        if (footer.length > 180) return json(res, 400, { error: 'A frase deve ter no máximo 180 caracteres.' });
        if (![1, 2, 3].includes(printSize)) return json(res, 400, { error: 'Selecione um tamanho de impressão válido.' });
        await Promise.all([
          database.setSetting('ticket_footer', footer),
          database.setSetting('print_size', printSize)
        ]);
        return json(res, 200, { ok: true, footer, printSize });
      }

      const orderRoute = url.pathname.match(/^\/api\/orders\/(\d+)$/);
      if (orderRoute && req.method === 'PUT') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        const orderId = Number.parseInt(orderRoute[1], 10);
        let order;
        try {
          order = normalizeOrder(await readJson(req));
        } catch (error) {
          return json(res, 400, { error: error.message || 'Dados do pedido inválidos.' });
        }
        const updated = await database.updateOrder(orderId, order);
        if (!updated) return json(res, 404, { error: 'Pedido não encontrado.' });
        return json(res, 200, { ok: true, message: 'Pedido atualizado.' });
      }

      if (orderRoute && req.method === 'DELETE') {
        if (!actionAllowed(req)) return json(res, 403, { error: 'Ação não autorizada.' });
        const orderId = Number.parseInt(orderRoute[1], 10);
        const deleted = await database.deleteOrder(orderId);
        if (!deleted) return json(res, 404, { error: 'Pedido não encontrado.' });
        return json(res, 200, { ok: true, message: 'Pedido excluído.' });
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
