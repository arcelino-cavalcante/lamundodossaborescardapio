function stripMarkdown(value = '') {
  return value.trim().replace(/\*/g, '').trim();
}

function parseMoneyBR(value = '') {
  let normalized = String(value).replace(/[^\d,.-]/g, '');
  if (!normalized) return 0;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    normalized = normalized.replace(',', '.');
  }

  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : 0;
}

function fieldValue(line) {
  return line.split(':').slice(1).join(':').trim();
}

function normalizePayment(value = '') {
  const normalized = value.toLowerCase();
  if (normalized.includes('pix')) return 'Pix';
  if (normalized.includes('dinheiro')) return 'Dinheiro';
  if (normalized.includes('cart')) return 'Cartão';
  return '';
}

function isOrderMessage(text = '') {
  const normalized = text
    .replace(/\*/g, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized.startsWith('ola, gostaria de fazer o seguinte pedido:');
}

function parseOrder(text = '') {
  const order = {
    name: '',
    customerWhatsapp: '',
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    payment: '',
    paidAmount: 0,
    change: 0,
    changeNeeded: false,
    deliveryType: '',
    address: {
      street: '',
      sitio: '',
      reference: '',
      observation: ''
    }
  };

  let section = '';
  let currentItem = null;

  String(text).split(/\r?\n/).forEach(rawLine => {
    const clean = stripMarkdown(rawLine);
    const lower = clean.toLowerCase();
    if (!clean) return;

    if (lower.startsWith('nome do cliente:')) {
      order.name = fieldValue(clean);
      return;
    }
    if (lower.startsWith('whatsapp:')) {
      order.customerWhatsapp = fieldValue(clean);
      return;
    }
    if (lower.startsWith('endereço:') || lower.startsWith('endereco:')) {
      order.address.street = fieldValue(clean);
      order.deliveryType = /retirada|retirar/i.test(order.address.street) ? 'Retirada' : 'Entrega';
      return;
    }
    if (lower.startsWith('localidade:')) {
      const locality = fieldValue(clean);
      if (/jucati/i.test(locality)) order.deliveryType = 'Entrega em Jucati';
      else if (/neves/i.test(locality)) order.deliveryType = 'Entrega em Neves';
      else if (locality) order.deliveryType = locality;
      return;
    }
    if (lower.startsWith('sítio:') || lower.startsWith('sitio:')) {
      order.address.sitio = fieldValue(clean);
      order.deliveryType = 'Sítio';
      return;
    }
    if (lower.startsWith('local/ponto de referência:') || lower.startsWith('local/ponto de referencia:')) {
      const value = fieldValue(clean);
      const parts = value.split(/\s*\|\s*obs:\s*/i);
      if (/^obs:/i.test(value)) {
        order.address.observation = value.replace(/^obs:\s*/i, '');
      } else {
        order.address.reference = parts[0] || '';
        order.address.observation = parts[1] || '';
      }
      return;
    }
    if (lower.startsWith('itens do pedido:')) {
      section = 'items';
      return;
    }

    if (section === 'items' && /^\(\d+\)/.test(clean)) {
      const match = clean.match(/^\((\d+)\)\s+(.+?)\s+-\s+(.+)$/);
      if (match) {
        let itemName = match[2].trim();
        let category = '';
        const categoryMatch = itemName.match(/\s+\[([^\]]+)]$/);
        if (categoryMatch) {
          category = categoryMatch[1].trim();
          itemName = itemName.slice(0, categoryMatch.index).trim();
        }
        currentItem = {
          name: itemName,
          category,
          quantity: Number.parseInt(match[1], 10) || 1,
          total: parseMoneyBR(match[3]),
          details: '',
          observation: '',
          border: ''
        };
        order.items.push(currentItem);
      }
      return;
    }

    if (section === 'items' && lower.startsWith('quantidade:')) {
      const quantity = Number.parseInt(fieldValue(clean), 10);
      if (currentItem && Number.isFinite(quantity)) currentItem.quantity = quantity;
      return;
    }
    if (section === 'items' && lower.startsWith('borda:')) {
      if (currentItem) currentItem.border = fieldValue(clean);
      return;
    }
    if (section === 'items' && (lower.startsWith('obs:') || lower.startsWith('observação:') || lower.startsWith('observacao:'))) {
      if (currentItem) currentItem.observation = fieldValue(clean);
      return;
    }
    if (section === 'items' && lower.startsWith('detalhes:')) {
      if (currentItem) currentItem.details = fieldValue(clean);
      return;
    }
    if (section === 'items' && (lower.startsWith('observação do item:') || lower.startsWith('observacao do item:'))) {
      if (currentItem) currentItem.observation = fieldValue(clean);
      return;
    }
    if (section === 'items' && lower.startsWith('total:')) {
      if (currentItem) currentItem.total = parseMoneyBR(fieldValue(clean));
      return;
    }

    if (lower.startsWith('subtotal:')) {
      section = '';
      order.subtotal = parseMoneyBR(fieldValue(clean));
      return;
    }
    if (lower.startsWith('observação geral:') || lower.startsWith('observacao geral:')) {
      order.address.observation = fieldValue(clean);
      return;
    }
    if (lower.startsWith('taxa de entrega:')) {
      section = '';
      order.deliveryFee = parseMoneyBR(fieldValue(clean));
      return;
    }
    if (lower.startsWith('valor total:')) {
      section = '';
      order.total = parseMoneyBR(fieldValue(clean));
      return;
    }
    if (lower.startsWith('forma de pagamento:')) {
      order.payment = normalizePayment(fieldValue(clean));
      return;
    }
    if (lower.startsWith('troco para:')) {
      order.paidAmount = parseMoneyBR(fieldValue(clean));
      order.changeNeeded = order.paidAmount > 0;
    }
  });

  if (!order.subtotal) {
    order.subtotal = order.items.reduce((sum, item) => sum + item.total, 0);
  }
  if (!order.total) order.total = order.subtotal + order.deliveryFee;
  if (order.payment === 'Dinheiro') {
    if (!order.paidAmount) order.paidAmount = order.total;
    order.change = Math.max(0, Number((order.paidAmount - order.total).toFixed(2)));
    order.changeNeeded = order.change > 0;
  }

  return order;
}

function validateOrder(order) {
  const errors = [];
  if (!order.name) errors.push('nome do cliente');
  if (!order.customerWhatsapp) errors.push('WhatsApp do cliente');
  if (!order.items.length) errors.push('itens do pedido');
  if (!(order.total > 0)) errors.push('valor total');
  if (!order.payment) errors.push('forma de pagamento');
  if (order.deliveryType === 'Sítio') {
    if (!order.address.sitio) errors.push('sítio');
  } else if (order.deliveryType !== 'Retirada' && !order.address.street) {
    errors.push('endereço');
  }
  return errors;
}

module.exports = {
  isOrderMessage,
  normalizePayment,
  parseMoneyBR,
  parseOrder,
  validateOrder
};
