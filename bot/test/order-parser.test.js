const test = require('node:test');
const assert = require('node:assert/strict');
const iconv = require('iconv-lite');
const { isOrderMessage, parseMoneyBR, parseOrder, validateOrder } = require('../src/order-parser');
const { confirmationMessage, ticketLines } = require('../src/ticket');
const { printProfile, ticketBuffer, wrapText } = require('../src/printer');

const CASH_ORDER = `*Olá, gostaria de fazer o seguinte pedido:*

*Nome do Cliente:* Maria da Silva
*WhatsApp:* (87) 99999-1111
*Endereço:* Rua das Flores, 25
*Sítio:* Sítio Boa Vista
*Local/Ponto de Referência:* Próximo à igreja
*Observação geral:* Portão azul

*Itens do pedido:*
(2) Calabresa [PIZZAS] - R$ 76,00
Quantidade: 2
Total: R$ 76,00
Borda: Catupiry
Detalhes: Tamanho: Média, Meia: Frango
Observação do item: Sem cebola e molho separado
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

const SITIO_ORDER_WITHOUT_STREET = PIX_ORDER.replace(
  '*Endereço:* Retirada no Local',
  '*Sítio:* Entupido\n*Local/Ponto de Referência:* Próximo à igreja'
);

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
    details: 'Tamanho: Média, Meia: Frango',
    observation: 'Sem cebola e molho separado',
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

test('aceita entrega em sítio sem exigir endereço de rua', () => {
  const order = parseOrder(SITIO_ORDER_WITHOUT_STREET);
  assert.deepEqual(validateOrder(order), []);
  assert.equal(order.deliveryType, 'Sítio');
  assert.equal(order.address.street, '');
  assert.equal(order.address.sitio, 'Entupido');
  assert.equal(order.address.reference, 'Próximo à igreja');
});

test('identifica entrega em Jucati na mensagem do cardápio', () => {
  const message = PIX_ORDER.replace(
    '*Endereço:* Retirada no Local',
    '*Endereço:* Rua do Cliente, 10\n*Localidade:* Jucati'
  );
  const order = parseOrder(message);
  assert.deepEqual(validateOrder(order), []);
  assert.equal(order.deliveryType, 'Entrega em Jucati');
  assert.equal(order.address.street, 'Rua do Cliente, 10');
});

test('gera confirmação e impressão com os campos novos', () => {
  const order = parseOrder(CASH_ORDER);
  const confirmation = confirmationMessage(order);
  const lines = ticketLines(order, { width: 40, date: '08/08/2026 14:00:00' });
  const ticket = lines.join('\n');

  assert.match(confirmation, /2x Calabresa/);
  assert.match(confirmation, /\*Observação do item:\* Sem cebola e molho separado/);
  assert.match(confirmation, /\*Troco:\* R\$ 4,00/);
  assert.match(ticket, /WHATSAPP: \(87\) 99999-1111/);
  assert.match(ticket, /SÍTIO   : Sítio Boa Vista/);
  assert.match(ticket, /OBS\.    : Portão azul/);
  assert.match(ticket, /2x CALABRESA \[PIZZAS\]/);
  assert.match(ticket, /Detalhes: Tamanho: Média, Meia: Frango/);
  assert.match(ticket, /Obs\. do item: Sem cebola e molho separado/);
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
  assert.equal(iconv.decode(buffer, 'cp860').includes('SÓ VITÓRIA'), true);
  assert.equal(buffer.includes(Buffer.from('Obrigado!')), true);
});

test('configura três tamanhos e quebra a frase final sem cortar palavras', () => {
  assert.deepEqual(wrapText('O Senhor é meu pastor e nada me faltará', 15), [
    'O Senhor é meu',
    'pastor e nada',
    'me faltará'
  ]);
  assert.equal(printProfile(1, 40).bodyWidth, 40);
  assert.equal(printProfile(2, 40).bodyCommand, 0x10);
  assert.equal(printProfile(3, 40).bodyWidth, 20);

  const buffer = ticketBuffer(parseOrder(PIX_ORDER), {
    printerCharsPerLine: 40,
    printSize: 3,
    storeName: 'LA MUNDO DOS SABORES',
    ticketFooter: 'Obrigado por escolher a La Mundo dos Sabores. Deus abençoe sua família!'
  }, '13/08/2026 às 18:00');

  assert.equal(buffer.includes(Buffer.from([0x1d, 0x21, 0x11])), true);
  assert.equal(buffer.includes(Buffer.from([0x1b, 0x64, 0x05])), true);
  assert.equal(buffer.includes(Buffer.from('Obrigado por')), true);
  assert.equal(buffer.includes(Buffer.from('dos Sabores. Deus')), true);
});
