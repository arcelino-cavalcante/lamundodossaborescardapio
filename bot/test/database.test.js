const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createDatabase } = require('../src/database');

test('salva o pedido completo e impede impressão duplicada pelo message_id', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'la-mundo-bot-'));
  const database = await createDatabase(path.join(directory, 'test.db'));
  t.after(async () => {
    await database.close();
    await fs.rm(directory, { recursive: true, force: true });
  });

  const order = {
    name: 'Cliente Teste',
    customerWhatsapp: '(87) 99999-0000',
    items: [{ name: 'Pizza', category: 'Pizzas', quantity: 1, total: 40, border: '', observation: '' }],
    subtotal: 40,
    deliveryFee: 5,
    total: 45,
    payment: 'Cartão',
    paidAmount: 0,
    change: 0,
    address: { street: 'Rua Teste', sitio: 'Sítio Teste', reference: '', observation: '' }
  };

  const first = await database.saveOrder('5587999990000', order, 'message-123');
  const duplicate = await database.saveOrder('5587999990000', order, 'message-123');
  const firstIncoming = await database.claimIncomingMessage('incoming-123', '5587999990000', 'chat');
  const duplicateIncoming = await database.claimIncomingMessage('incoming-123', '5587999990000', 'chat');
  const secondIncoming = await database.claimIncomingMessage('incoming-456', '5587999990000', 'image');
  const report = await database.salesReport('today');
  await database.setSetting('ticket_footer', 'Obrigado pela preferência!');
  await database.addLog('error', 'teste', 'Falha simulada');
  const dashboard = await database.dashboardStats();
  const logs = await database.listLogs();

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(firstIncoming, true);
  assert.equal(duplicateIncoming, false);
  assert.equal(secondIncoming, true);
  assert.equal(report.total, 45);
  assert.equal(report.customers[0].nome, 'Cliente Teste');
  assert.equal(await database.getSetting('ticket_footer'), 'Obrigado pela preferência!');
  assert.equal(dashboard.today.orders, 1);
  assert.equal(dashboard.today.total, 45);
  assert.equal(dashboard.topSite.name, 'Sítio Teste');
  assert.equal(dashboard.topCustomerWeek.name, 'Cliente Teste');
  assert.equal(dashboard.orders[0].site, 'Sítio Teste');
  assert.equal(logs[0].message, 'Falha simulada');

  const updated = await database.updateOrder(first.id, {
    ...order,
    name: 'Cliente Corrigido',
    items: [{ ...order.items[0], quantity: 2, total: 80 }],
    subtotal: 80,
    deliveryFee: 6,
    total: 86,
    dateTime: dashboard.orders[0].dateTime
  });
  assert.equal(updated, true);
  const updatedDashboard = await database.dashboardStats();
  assert.equal(updatedDashboard.today.total, 86);
  assert.equal(updatedDashboard.orders[0].name, 'Cliente Corrigido');
  assert.equal(updatedDashboard.orders[0].items[0].quantity, 2);

  assert.equal(await database.deleteOrder(first.id), true);
  assert.equal(await database.deleteOrder(first.id), false);
  const emptyDashboard = await database.dashboardStats();
  assert.equal(emptyDashboard.today.orders, 0);
  assert.equal(emptyDashboard.today.total, 0);

  const credit = await database.saveCreditSale({
    name: 'Cliente Fiado',
    value: 27.5,
    observation: 'Compra no balcão',
    dateTime: new Date().toLocaleString('sv-SE', { timeZone: 'America/Recife' })
  });
  const creditDashboard = await database.dashboardStats();
  assert.equal(creditDashboard.today.total, 27.5);
  assert.equal(creditDashboard.today.creditSales, 1);
  assert.equal(creditDashboard.credit.openTotal, 27.5);
  assert.equal(creditDashboard.credit.entries[0].name, 'Cliente Fiado');
  assert.equal((await database.salesReport('today')).total, 27.5);
  assert.equal(await database.setCreditPaid(credit.id, true), true);
  const paidDashboard = await database.dashboardStats();
  assert.equal(paidDashboard.today.total, 27.5);
  assert.equal(paidDashboard.credit.openTotal, 0);
  assert.equal(paidDashboard.credit.entries[0].status, 'pago');
  assert.equal(await database.setCreditPaid(credit.id, false), true);
  assert.equal(await database.deleteCreditSale(credit.id), true);
  assert.equal(await database.deleteCreditSale(credit.id), false);
  assert.equal((await database.dashboardStats()).today.total, 0);
  await database.clearLogs();
  assert.deepEqual(await database.listLogs(), []);
});
