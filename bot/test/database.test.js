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
    address: { street: 'Rua Teste', sitio: '', reference: '', observation: '' }
  };

  const first = await database.saveOrder('5587999990000', order, 'message-123');
  const duplicate = await database.saveOrder('5587999990000', order, 'message-123');
  const report = await database.salesReport('today');

  assert.equal(first.duplicate, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(report.total, 45);
  assert.equal(report.customers[0].nome, 'Cliente Teste');
});
