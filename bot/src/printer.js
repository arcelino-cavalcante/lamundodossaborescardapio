const net = require('node:net');
const iconv = require('iconv-lite');
const { formatDatePtBr, money } = require('./ticket');

const ESC = 0x1b;
const GS = 0x1d;

function command(...bytes) {
  return Buffer.from(bytes);
}

function encodedLine(value = '') {
  return Buffer.concat([iconv.encode(String(value), 'cp860'), Buffer.from('\n')]);
}

function encodedText(value = '') {
  return iconv.encode(String(value), 'cp860');
}

function ticketBuffer(order, config, date) {
  const width = Number(config.printerCharsPerLine || 40);
  const separator = '-'.repeat(width);
  const address = order.address || {};
  const chunks = [
    command(ESC, 0x40),
    command(ESC, 0x74, 0x03),
    command(ESC, 0x61, 0x01),
    command(ESC, 0x45, 0x01),
    command(GS, 0x21, 0x11),
    encodedLine(config.storeName),
    command(GS, 0x21, 0x10),
    encodedLine('COMPROVANTE DO PEDIDO'),
    command(GS, 0x21, 0x00),
    command(ESC, 0x61, 0x00)
  ];

  const line = value => chunks.push(encodedLine(value));
  const boldLine = (label, value, large = false) => {
    if (large) chunks.push(command(GS, 0x21, 0x10));
    chunks.push(command(ESC, 0x45, 0x01), encodedText(`${label}: `));
    chunks.push(command(ESC, 0x45, 0x00), encodedLine(value));
    if (large) chunks.push(command(GS, 0x21, 0x00));
  };
  const section = title => {
    line(separator);
    chunks.push(
      command(ESC, 0x61, 0x01),
      command(ESC, 0x45, 0x01),
      command(GS, 0x21, 0x10),
      encodedLine(title),
      command(GS, 0x21, 0x00),
      command(ESC, 0x45, 0x00),
      command(ESC, 0x61, 0x00)
    );
  };

  line('='.repeat(width));
  boldLine('CLIENTE', order.name || 'Não informado', true);
  boldLine('WHATSAPP', order.customerWhatsapp || 'Não informado');
  boldLine('DATA', date || '');
  boldLine('ENTREGA', order.deliveryType || 'Não informada', true);
  if (address.street) boldLine('ENDEREÇO', address.street);
  if (address.sitio) boldLine('SÍTIO', address.sitio);
  if (address.reference) boldLine('REFERÊNCIA', address.reference);
  if (address.observation) boldLine('OBSERVAÇÃO', address.observation);

  section('ITENS DO PEDIDO');
  (order.items || []).forEach((item, index) => {
    const category = item.category ? ` [${String(item.category).toUpperCase()}]` : '';
    chunks.push(
      command(ESC, 0x45, 0x01),
      command(GS, 0x21, 0x10),
      encodedLine(`${index + 1}. ${item.quantity}x ${String(item.name || '').toUpperCase()}${category}`),
      command(GS, 0x21, 0x00),
      command(ESC, 0x45, 0x00)
    );
    boldLine('TOTAL DO ITEM', money(item.total));
    if (item.border) boldLine('BORDA', item.border);
    if (item.details) boldLine('DETALHES', item.details);
    if (item.observation) boldLine('OBSERVAÇÃO DO ITEM', item.observation, true);
    if (index < order.items.length - 1) line('');
  });

  section('RESUMO DO PAGAMENTO');
  boldLine('SUBTOTAL', money(order.subtotal));
  boldLine('TAXA DE ENTREGA', money(order.deliveryFee));
  line(separator);
  boldLine('VALOR TOTAL', money(order.total), true);
  boldLine('PAGAMENTO', order.payment || 'Não informado', true);
  if (order.payment === 'Dinheiro' && order.changeNeeded) {
    boldLine('VALOR RECEBIDO', money(order.paidAmount));
    boldLine('TROCO', money(order.change), true);
  }
  line('='.repeat(width));

  const footer = String(config.ticketFooter || '').trim();
  chunks.push(command(ESC, 0x61, 0x01));
  if (footer) {
    chunks.push(
      command(ESC, 0x45, 0x01),
      encodedLine(footer),
      command(ESC, 0x45, 0x00)
    );
  }
  chunks.push(command(ESC, 0x64, 0x03), command(GS, 0x56, 0x00));
  return Buffer.concat(chunks);
}

function createPrinter(config) {
  let enabled = config.printEnabled;

  return {
    setEnabled(value) {
      enabled = Boolean(value);
    },

    isEnabled() {
      return enabled;
    },

    async print(order, options = {}) {
      if (!enabled) return { printed: false, reason: 'disabled' };

      const date = formatDatePtBr(new Date(), config.timezone);
      const printConfig = {
        ...config,
        ticketFooter: Object.hasOwn(options, 'ticketFooter') ? options.ticketFooter : config.ticketFooter
      };
      const payload = ticketBuffer(order, printConfig, date);

      return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host: config.printerIp, port: config.printerPort });
        let settled = false;

        const finish = (error, result) => {
          if (settled) return;
          settled = true;
          socket.destroy();
          if (error) reject(error);
          else resolve(result);
        };

        socket.setTimeout(7000);
        socket.once('timeout', () => finish(new Error(`Tempo esgotado ao conectar à impressora ${config.printerIp}:${config.printerPort}.`)));
        socket.once('error', error => finish(new Error(`Falha na impressora ${config.printerIp}:${config.printerPort}: ${error.message}`)));
        socket.once('connect', () => {
          socket.end(payload, error => {
            if (error) finish(error);
            else finish(null, { printed: true });
          });
        });
      });
    }
  };
}

module.exports = { createPrinter, ticketBuffer };
