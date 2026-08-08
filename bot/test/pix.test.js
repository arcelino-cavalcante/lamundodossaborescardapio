const test = require('node:test');
const assert = require('node:assert/strict');
const { crc16, generatePixPayload, normalizeMerchantText } = require('../src/pix');

test('normaliza nome e cidade para o padrão Pix', () => {
  assert.equal(normalizeMerchantText('João da Silva', 25), 'JOAO DA SILVA');
  assert.equal(normalizeMerchantText('Garanhuns - PE', 15), 'GARANHUNS - PE');
});

test('gera Pix Copia e Cola dinâmico com valor e CRC válido', () => {
  const payload = generatePixPayload({
    key: 'teste@exemplo.com',
    holder: 'João da Silva',
    city: 'Garanhuns',
    amount: 50.99,
    txid: 'PEDIDO123'
  });

  assert.match(payload, /^00020126/);
  assert.match(payload, /5303986540550\.99/);
  assert.match(payload, /5913JOAO DA SILVA/);
  assert.match(payload, /6009GARANHUNS/);
  assert.match(payload, /6304[0-9A-F]{4}$/);
  assert.equal(payload.slice(-4), crc16(payload.slice(0, -4)));
});

test('confere o CRC do exemplo oficial do Banco Central', () => {
  const officialPrefix = '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
  assert.equal(crc16(officialPrefix), '1D3D');
});

test('recusa gerar Pix sem os dados obrigatórios', () => {
  assert.throws(() => generatePixPayload({ amount: 10 }), /Chave Pix/);
});
