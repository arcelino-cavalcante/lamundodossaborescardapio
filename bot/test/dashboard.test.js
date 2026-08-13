const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database');
const { ACTION_HEADER, startDashboard } = require('../src/dashboard-server');

test('painel expõe métricas, salva a frase e protege ações do bot', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'la-mundo-dashboard-'));
  const database = await createDatabase(path.join(directory, 'test.db'));
  let restarts = 0;
  const controller = {
    status: () => ({ state: 'online' }),
    restart: async () => { restarts += 1; },
    clearSession: async () => {},
    recordError: () => {}
  };
  const server = await startDashboard({
    database,
    controller,
    config: {
      dashboardHost: '127.0.0.1',
      dashboardPort: 0,
      ticketFooter: 'Frase inicial',
      printSize: 1
    }
  });

  t.after(async () => {
    await server.close();
    await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  const baseUrl = server.url;
  const savedOrder = await database.saveOrder('5587999990000', {
    name: 'Cliente Painel',
    customerWhatsapp: '87999990000',
    items: [{ name: 'Pizza', category: 'Pizzas', quantity: 1, total: 30, details: '', observation: '', border: '' }],
    subtotal: 30,
    deliveryFee: 5,
    total: 35,
    payment: 'Pix',
    paidAmount: 0,
    change: 0,
    address: { street: 'Rua Teste', sitio: '', reference: '', observation: '' }
  }, 'dashboard-order-1');
  const dashboardResponse = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(dashboardResponse.status, 200);
  const dashboard = await dashboardResponse.json();
  assert.equal(dashboard.footer, 'Frase inicial');
  assert.equal(dashboard.printSize, 1);
  assert.equal(dashboard.bot.state, 'online');
  assert.equal(dashboard.stats.orders[0].items[0].name, 'Pizza');

  const blocked = await fetch(`${baseUrl}/api/bot/restart`, { method: 'POST' });
  assert.equal(blocked.status, 403);

  const footerResponse = await fetch(`${baseUrl}/api/settings/footer`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Leonus-Action': ACTION_HEADER },
    body: JSON.stringify({ footer: 'Volte sempre!' })
  });
  assert.equal(footerResponse.status, 200);
  assert.equal(await database.getSetting('ticket_footer'), 'Volte sempre!');

  const printingResponse = await fetch(`${baseUrl}/api/settings/printing`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Leonus-Action': ACTION_HEADER },
    body: JSON.stringify({ footer: 'Versículo completo sem cortes', printSize: 3 })
  });
  assert.equal(printingResponse.status, 200);
  assert.equal(await database.getSetting('ticket_footer'), 'Versículo completo sem cortes');
  assert.equal(await database.getSetting('print_size'), '3');

  const invalidPrintingResponse = await fetch(`${baseUrl}/api/settings/printing`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Leonus-Action': ACTION_HEADER },
    body: JSON.stringify({ footer: 'Teste', printSize: 4 })
  });
  assert.equal(invalidPrintingResponse.status, 400);

  const blockedOrderEdit = await fetch(`${baseUrl}/api/orders/${savedOrder.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  assert.equal(blockedOrderEdit.status, 403);

  const orderEditResponse = await fetch(`${baseUrl}/api/orders/${savedOrder.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Leonus-Action': ACTION_HEADER },
    body: JSON.stringify({
      name: 'Cliente Editado',
      whatsapp: '87988880000',
      dateTime: dashboard.stats.orders[0].dateTime,
      payment: 'Cartão',
      address: { street: 'Retirada', sitio: '', reference: '', observation: 'Sem cebola' },
      items: [{ name: 'Pizza editada', category: 'Pizzas', quantity: 2, total: 60, details: '', observation: '', border: '' }],
      subtotal: 60,
      deliveryFee: 0,
      total: 60,
      paidAmount: 0,
      change: 0
    })
  });
  assert.equal(orderEditResponse.status, 200);
  const editedDashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.equal(editedDashboard.stats.today.total, 60);
  assert.equal(editedDashboard.stats.orders[0].name, 'Cliente Editado');
  assert.equal(editedDashboard.stats.orders[0].items[0].quantity, 2);

  const deleteOrderResponse = await fetch(`${baseUrl}/api/orders/${savedOrder.id}`, {
    method: 'DELETE',
    headers: { 'X-Leonus-Action': ACTION_HEADER }
  });
  assert.equal(deleteOrderResponse.status, 200);
  const deletedDashboard = await (await fetch(`${baseUrl}/api/dashboard`)).json();
  assert.equal(deletedDashboard.stats.today.orders, 0);

  const restartResponse = await fetch(`${baseUrl}/api/bot/restart`, {
    method: 'POST',
    headers: { 'X-Leonus-Action': ACTION_HEADER }
  });
  assert.equal(restartResponse.status, 202);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(restarts, 1);
});
