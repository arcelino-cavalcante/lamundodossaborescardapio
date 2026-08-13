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

function normalizePrintSize(value) {
  const size = Number.parseInt(value, 10);
  return [1, 2, 3].includes(size) ? size : 1;
}

function wrapText(value, width) {
  const safeWidth = Math.max(4, Number(width) || 40);
  const paragraphs = String(value ?? '').replace(/\r/g, '').split('\n');
  const lines = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      continue;
    }

    let current = '';
    for (let word of words) {
      while (word.length > safeWidth) {
        if (current) {
          lines.push(current);
          current = '';
        }
        lines.push(word.slice(0, safeWidth));
        word = word.slice(safeWidth);
      }

      if (!word) continue;
      if (!current) {
        current = word;
      } else if (`${current} ${word}`.length <= safeWidth) {
        current += ` ${word}`;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines.length ? lines : [''];
}

function printProfile(value, charsPerLine = 40) {
  const printSize = normalizePrintSize(value);
  const baseWidth = Math.max(20, Number(charsPerLine) || 40);
  if (printSize === 2) {
    return { printSize, bodyCommand: 0x10, emphasisCommand: 0x11, bodyWidth: baseWidth, emphasisWidth: Math.floor(baseWidth / 2) };
  }
  if (printSize === 3) {
    return { printSize, bodyCommand: 0x11, emphasisCommand: 0x11, bodyWidth: Math.floor(baseWidth / 2), emphasisWidth: Math.floor(baseWidth / 2) };
  }
  return { printSize, bodyCommand: 0x00, emphasisCommand: 0x10, bodyWidth: baseWidth, emphasisWidth: baseWidth };
}

function ticketBuffer(order, config, date) {
  const profile = printProfile(config.printSize, config.printerCharsPerLine);
  const separator = '-'.repeat(profile.bodyWidth);
  const address = order.address || {};
  const chunks = [
    command(ESC, 0x40),
    command(ESC, 0x74, 0x03),
    command(ESC, 0x61, 0x01),
    command(ESC, 0x45, 0x01),
    command(GS, 0x21, 0x11)
  ];

  const write = (value, { size = profile.bodyCommand, width = profile.bodyWidth, bold = false, align = 0 } = {}) => {
    chunks.push(command(ESC, 0x61, align), command(GS, 0x21, size), command(ESC, 0x45, bold ? 0x01 : 0x00));
    wrapText(value, width).forEach(textLine => chunks.push(encodedLine(textLine)));
  };
  const line = value => write(value);
  const boldLine = (label, value, large = false) => {
    const size = large ? profile.emphasisCommand : profile.bodyCommand;
    const width = large ? profile.emphasisWidth : profile.bodyWidth;
    const prefix = `${label}: `;
    const text = String(value ?? '');

    chunks.push(command(ESC, 0x61, 0), command(GS, 0x21, size));
    if (prefix.length >= width - 3) {
      chunks.push(command(ESC, 0x45, 0x01), encodedLine(prefix.trimEnd()), command(ESC, 0x45, 0x00));
      wrapText(text, width).forEach(textLine => chunks.push(encodedLine(textLine)));
      return;
    }

    const firstWidth = width - prefix.length;
    const words = wrapText(text, firstWidth);
    chunks.push(command(ESC, 0x45, 0x01), encodedText(prefix), command(ESC, 0x45, 0x00), encodedLine(words.shift() || ''));
    const continuation = words.join(' ');
    if (continuation) wrapText(continuation, width).forEach(textLine => chunks.push(encodedLine(textLine)));
  };
  const section = title => {
    line(separator);
    write(title, { size: profile.emphasisCommand, width: profile.emphasisWidth, bold: true, align: 1 });
  };

  write('SÓ VITÓRIA', { size: 0x11, width: Math.floor(Number(config.printerCharsPerLine || 40) / 2), bold: true, align: 1 });
  write(config.storeName, { size: 0x11, width: Math.floor(Number(config.printerCharsPerLine || 40) / 2), bold: true, align: 1 });
  write('COMPROVANTE DO PEDIDO', { size: 0x10, width: Number(config.printerCharsPerLine || 40), bold: true, align: 1 });
  line('='.repeat(profile.bodyWidth));
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
    write(`${index + 1}. ${item.quantity}x ${String(item.name || '').toUpperCase()}${category}`, {
      size: profile.emphasisCommand,
      width: profile.emphasisWidth,
      bold: true
    });
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
  line('='.repeat(profile.bodyWidth));

  const footer = String(config.ticketFooter || '').trim();
  if (footer) {
    write(footer, { size: profile.bodyCommand, width: profile.bodyWidth, bold: true, align: 1 });
  }
  chunks.push(
    command(ESC, 0x45, 0x00),
    command(GS, 0x21, 0x00),
    command(ESC, 0x61, 0x00),
    command(ESC, 0x64, 0x05),
    command(GS, 0x56, 0x00)
  );
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
        ticketFooter: Object.hasOwn(options, 'ticketFooter') ? options.ticketFooter : config.ticketFooter,
        printSize: Object.hasOwn(options, 'printSize') ? options.printSize : config.printSize
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

module.exports = { createPrinter, normalizePrintSize, printProfile, ticketBuffer, wrapText };
