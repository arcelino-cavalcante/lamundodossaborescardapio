const test = require('node:test');
const assert = require('node:assert/strict');
const { isOrderMessage, parseMoneyBR, parseOrder, validateOrder } = require('../src/order-parser');
const { confirmationMessage, ticketLines } = require('../src/ticket');
const { ticketBuffer } = require('../src/printer');

const CASH_ORDER = `*Olá, gostaria de fazer o seguinte pedido:*

*Nome do Cliente:* Maria da Silva
*WhatsApp:* (87) 99999-1111
*Endereço:* Rua das Flores, 25
*Sítio:* Sítio Boa Vista
*Local/Ponto de Referência:* Próximo à igreja | Obs: Portão azul

*Itens do pedido:*
(2) Calabresa [PIZZAS] - R$ 76,00
Quantidade: 2
Total: R$ 76,00
Borda: Catupiry
Obs: Tamanho: Média, Meia: Frango
(1) Coca-Cola 2L [REFRIGERANTES] - R$ 15,00
Quantidade: 1
Total: R$ 15,00

*Subtotal:* R$ 91,00
*Taxa de Entrega:* R$ 5,00
*VALOR TOTAL:* R$ 96,00

*Forma de Pagamento:* Dinheiro
*Troco para:* R$ 100,00`;

const PIX_ORDER = `*Olá, gostaria de fazer o seguinte pedido:*

*Nome do Cliente:* João
*WhatsApp:* (87) 98888-2222
*Endereço:* Retirada no Local

*Itens do pedido:*
(1) Classic Burger [HAMBÚRGUERES] - R$ 13,99
Quantidade: 1
Total: R$ 13,99

*Subtotal:* R$ 13,99
*Taxa de Entrega:* R$ 0,00
*VALOR TOTAL:* R$ 13,99

*Forma de Pagamento:* Pix`;

test('reconhece a mensagem gerada pelo cardápio novo', () => {
  assert.equal(isOrderMessage(CASH_ORDER), true);
  assert.equal(isOrderMessage('Olá, quero uma pizza'), false);
});

test('converte valores monetários brasileiros', () => {
  assert.equal(parseMoneyBR('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoneyBR('R$ 13,99'), 13.99);
  assert.equal(parseMoneyBR('0,00'), 0);
});

test('lê todos os campos de entrega, itens, dinheiro e troco', () => {
  const order = parseOrder(CASH_ORDER);
  assert.deepEqual(validateOrder(order), []);
  assert.equal(order.name, 'Maria da Silva');
  assert.equal(order.customerWhatsapp, '(87) 99999-1111');
  assert.equal(order.deliveryType, 'Sítio');
  assert.equal(order.address.street, 'Rua das Flores, 25');
  assert.equal(order.address.sitio, 'Sítio Boa Vista');
  assert.equal(order.address.reference, 'Próximo à igreja');
  assert.equal(order.address.observation, 'Portão azul');
  assert.equal(order.items.length, 2);
  assert.deepEqual(order.items[0], {
    name: 'Calabresa',
    category: 'PIZZAS',
    quantity: 2,
    total: 76,
    observation: 'Tamanho: Média, Meia: Frango',
    border: 'Catupiry'
  });
  assert.equal(order.subtotal, 91);
  assert.equal(order.deliveryFee, 5);
  assert.equal(order.total, 96);
  assert.equal(order.payment, 'Dinheiro');
  assert.equal(order.paidAmount, 100);
  assert.equal(order.change, 4);
  assert.equal(order.changeNeeded, true);
});

test('lê Pix e retirada sem exigir endereço de entrega', () => {
  const order = parseOrder(PIX_ORDER);
  assert.deepEqual(validateOrder(order), []);
  assert.equal(order.payment, 'Pix');
  assert.equal(order.deliveryType, 'Retirada');
  assert.equal(order.total, 13.99);
});

test('gera confirmação e impressão com os campos novos', () => {
  const order = parseOrder(CASH_ORDER);
  const confirmation = confirmationMessage(order);
  const lines = ticketLines(order, { width: 40, date: '08/08/2026 14:00:00' });
  const ticket = lines.join('\n');

  assert.match(confirmation, /2x Calabresa/);
  assert.match(confirmation, /\*Troco:\* R\$ 4,00/);
  assert.match(ticket, /WHATSAPP: \(87\) 99999-1111/);
  assert.match(ticket, /SÍTIO   : Sítio Boa Vista/);
  assert.match(ticket, /OBS\.    : Portão azul/);
  assert.match(ticket, /2x CALABRESA \[PIZZAS\]/);
  assert.match(ticket, /TAXA      : R\$ 5,00/);
  assert.match(ticket, /PAGAMENTO : Dinheiro/);
  assert.match(ticket, /TROCO     : R\$ 4,00/);

  const buffer = ticketBuffer(order, {
    printerCharsPerLine: 40,
    storeName: 'LA MUNDO DOS SABORES',
    ticketFooter: 'Obrigado!'
  }, '08/08/2026 14:00:00');
  assert.equal(Buffer.isBuffer(buffer), true);
  assert.deepEqual([...buffer.subarray(0, 2)], [0x1b, 0x40]);
  assert.equal(buffer.includes(Buffer.from([0x1b, 0x45, 0x01])), true);
  assert.equal(buffer.includes(Buffer.from([0x1d, 0x21, 0x10])), true);
  assert.equal(buffer.includes(Buffer.from([0x1d, 0x56, 0x00])), true);
});
