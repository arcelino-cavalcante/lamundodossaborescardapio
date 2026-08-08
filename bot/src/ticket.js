function money(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value || 0)).replace(/\u00a0/g, ' ');
}

function formatDatePtBr(value = new Date(), timeZone = 'America/Recife') {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(value);
  const part = type => parts.find(item => item.type === type)?.value || '';
  return `${part('day')}/${part('month')}/${part('year')} às ${part('hour')}:${part('minute')}`;
}

function ticketLines(order, options = {}) {
  const width = Number(options.width || 40);
  const separator = '-'.repeat(width);
  const address = order.address || {};
  const lines = [
    '='.repeat(width),
    `CLIENTE : ${order.name || 'Não informado'}`,
    `WHATSAPP: ${order.customerWhatsapp || 'Não informado'}`,
    `DATA    : ${options.date || ''}`,
    `ENTREGA : ${order.deliveryType || 'Não informada'}`
  ];

  if (address.street) lines.push(`ENDEREÇO: ${address.street}`);
  if (address.sitio) lines.push(`SÍTIO   : ${address.sitio}`);
  if (address.reference) lines.push(`REF.    : ${address.reference}`);
  if (address.observation) lines.push(`OBS.    : ${address.observation}`);

  lines.push(separator, 'ITENS DO PEDIDO:', separator);
  (order.items || []).forEach((item, index) => {
    const category = item.category ? ` [${item.category.toUpperCase()}]` : '';
    lines.push(`${index + 1}. ${item.quantity}x ${String(item.name || '').toUpperCase()}${category}`);
    lines.push(`   Total: ${money(item.total)}`);
    if (item.border) lines.push(`   Borda: ${item.border}`);
    if (item.details) lines.push(`   Detalhes: ${item.details}`);
    if (item.observation) lines.push(`   Obs. do item: ${item.observation}`);
  });

  lines.push(
    separator,
    `SUBTOTAL  : ${money(order.subtotal)}`,
    `TAXA      : ${money(order.deliveryFee)}`,
    `TOTAL     : ${money(order.total)}`,
    `PAGAMENTO : ${order.payment || 'Não informado'}`
  );

  if (order.payment === 'Dinheiro' && order.changeNeeded) {
    lines.push(`ENTREGUE  : ${money(order.paidAmount)}`, `TROCO     : ${money(order.change)}`);
  }
  lines.push('='.repeat(width));
  return lines;
}

function confirmationMessage(order) {
  let message = '📋 *Resumo do Pedido:*\n\n';
  (order.items || []).forEach(item => {
    message += `${item.quantity}x ${item.name} - ${money(item.total)}\n`;
    if (item.border) message += `   Borda: ${item.border}\n`;
    if (item.details) message += `   Detalhes: ${item.details}\n`;
    if (item.observation) message += `   *Observação do item:* ${item.observation}\n`;
  });
  message += `\n*Subtotal:* ${money(order.subtotal)}\n`;
  message += `*Taxa de entrega:* ${money(order.deliveryFee)}\n`;
  message += `*Valor Total:* ${money(order.total)}\n`;
  message += `*Pagamento:* ${order.payment}\n`;
  if (order.payment === 'Dinheiro' && order.changeNeeded) {
    message += `*Troco para:* ${money(order.paidAmount)}\n`;
    message += `*Troco:* ${money(order.change)}\n`;
  }
  message += '\nConfirmar pedido?\n1 - Sim\n2 - Não';
  return message;
}

module.exports = { confirmationMessage, formatDatePtBr, money, ticketLines };
