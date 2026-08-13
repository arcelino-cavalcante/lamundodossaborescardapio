const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const actionHeaders = { 'Content-Type': 'application/json', 'X-Leonus-Action': 'painel-local' };
let footerDirty = false;
let toastTimer;
let ordersById = new Map();

const byId = id => document.getElementById(id);
const plural = (value, singular, pluralWord) => `${value} ${value === 1 ? singular : pluralWord}`;
const formatDateTime = value => {
  if (!value) return '—';
  const date = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

function toast(message) {
  const element = byId('toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.classList.remove('visible'), 2800);
}

function setText(id, value) { byId(id).textContent = value; }

function renderPerson(prefix, person) {
  setText(`${prefix}Customer`, person?.name || '—');
  setText(
    `${prefix}CustomerDetails`,
    person ? `${money.format(person.total)} · ${plural(person.orders, 'pedido', 'pedidos')}` : 'Sem pedidos'
  );
}

function renderStatus(bot) {
  const element = byId('botStatus');
  const states = {
    online: ['Bot online', 'status-online'],
    qr: ['Aguardando QR Code', 'status-waiting'],
    starting: ['Bot iniciando…', 'status-waiting'],
    restarting: ['Bot reiniciando…', 'status-waiting'],
    stopped: ['Bot parado', 'status-error'],
    error: ['Bot com erro', 'status-error']
  };
  const [label, className] = states[bot?.state] || ['Verificando bot…', 'status-waiting'];
  element.textContent = label;
  element.className = `status ${className}`;
}

function renderOrders(orders) {
  ordersById = new Map(orders.map(order => [Number(order.id), order]));
  const body = byId('ordersBody');
  body.replaceChildren();
  byId('emptyOrders').hidden = orders.length > 0;
  for (const order of orders) {
    const row = document.createElement('tr');
    const values = [
      formatDateTime(order.dateTime),
      order.name,
      order.site || order.delivery || 'Retirada',
      order.payment
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    const totalCell = document.createElement('td');
    totalCell.className = 'money-column';
    totalCell.textContent = money.format(order.total);
    row.append(totalCell);

    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-column';
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const editButton = document.createElement('button');
    editButton.className = 'button secondary';
    editButton.type = 'button';
    editButton.textContent = 'Editar';
    editButton.addEventListener('click', () => openOrderEditor(order.id));
    const deleteButton = document.createElement('button');
    deleteButton.className = 'button danger';
    deleteButton.type = 'button';
    deleteButton.textContent = 'Excluir';
    deleteButton.addEventListener('click', () => deleteOrder(order.id, deleteButton));
    actions.append(editButton, deleteButton);
    actionsCell.append(actions);
    row.append(actionsCell);
    body.append(row);
  }
}

function inputDateTime(value) {
  return String(value || '').replace(' ', 'T').slice(0, 16);
}

function numericValue(id) {
  return Number(byId(id).value || 0);
}

function createItemField(labelText, className, type = 'text') {
  const label = document.createElement('label');
  label.className = `item-field ${className}`;
  label.append(document.createTextNode(labelText));
  const input = document.createElement('input');
  input.type = type;
  input.dataset.field = className.replace('-field', '');
  if (type === 'number') {
    input.min = className === 'quantity-field' ? '1' : '0';
    input.max = className === 'quantity-field' ? '999' : '1000000';
    input.step = className === 'quantity-field' ? '1' : '0.01';
  } else {
    input.maxLength = className === 'name-field' ? 180 : 300;
  }
  if (className === 'name-field') input.required = true;
  label.append(input);
  return label;
}

function addOrderItem(item = {}) {
  const row = document.createElement('article');
  row.className = 'order-item';
  const quantity = createItemField('Qtd.', 'quantity-field', 'number');
  const name = createItemField('Produto', 'name-field');
  const category = createItemField('Categoria', 'category-field');
  const total = createItemField('Total do item', 'total-field', 'number');
  const remove = document.createElement('button');
  remove.className = 'button danger remove-item';
  remove.type = 'button';
  remove.title = 'Remover item';
  remove.setAttribute('aria-label', 'Remover item');
  remove.textContent = '×';

  const extra = document.createElement('div');
  extra.className = 'item-extra';
  const details = createItemField('Detalhes', 'details-field');
  const observation = createItemField('Observação', 'observation-field');
  const border = createItemField('Borda', 'border-field');
  extra.append(details, observation, border);
  row.append(quantity, name, category, total, remove, extra);

  const values = {
    quantity: item.quantity || 1,
    name: item.name || '',
    category: item.category || '',
    total: Number(item.total || 0).toFixed(2),
    details: item.details || '',
    observation: item.observation || '',
    border: item.border || ''
  };
  for (const [field, value] of Object.entries(values)) row.querySelector(`[data-field="${field}"]`).value = value;
  row.querySelector('[data-field="total"]').addEventListener('input', recalculateOrderTotals);
  remove.addEventListener('click', () => {
    if (byId('orderItems').children.length === 1) return toast('O pedido precisa ter pelo menos um item');
    row.remove();
    recalculateOrderTotals();
  });
  byId('orderItems').append(row);
}

function recalculateOrderTotals() {
  const itemTotal = [...byId('orderItems').querySelectorAll('[data-field="total"]')]
    .reduce((sum, input) => sum + Number(input.value || 0), 0);
  byId('orderSubtotal').value = itemTotal.toFixed(2);
  byId('orderTotal').value = (itemTotal + numericValue('orderDeliveryFee')).toFixed(2);
  recalculateChange();
}

function recalculateChange() {
  if (byId('orderPayment').value === 'Dinheiro') {
    byId('orderChange').value = Math.max(0, numericValue('orderPaidAmount') - numericValue('orderTotal')).toFixed(2);
  } else {
    byId('orderPaidAmount').value = '0.00';
    byId('orderChange').value = '0.00';
  }
}

function openOrderEditor(id) {
  const order = ordersById.get(Number(id));
  if (!order) return toast('Pedido não encontrado');
  byId('orderId').value = order.id;
  setText('orderNumber', `#${order.id}`);
  byId('orderName').value = order.name || '';
  byId('orderWhatsapp').value = order.whatsapp || '';
  byId('orderDateTime').value = inputDateTime(order.dateTime);
  byId('orderPayment').value = ['Pix', 'Dinheiro', 'Cartão'].includes(order.payment) ? order.payment : 'Pix';
  byId('orderStreet').value = order.address?.street || '';
  byId('orderSite').value = order.address?.sitio || '';
  byId('orderReference').value = order.address?.reference || '';
  byId('orderObservation').value = order.address?.observation || order.observation || '';
  byId('orderSubtotal').value = Number(order.subtotal || 0).toFixed(2);
  byId('orderDeliveryFee').value = Number(order.deliveryFee || 0).toFixed(2);
  byId('orderTotal').value = Number(order.total || 0).toFixed(2);
  byId('orderPaidAmount').value = Number(order.paidAmount || 0).toFixed(2);
  byId('orderChange').value = Number(order.change || 0).toFixed(2);
  byId('orderItems').replaceChildren();
  (order.items?.length ? order.items : [{}]).forEach(addOrderItem);
  setText('orderMessage', '');
  byId('orderDialog').showModal();
}

function closeOrderEditor() {
  byId('orderDialog').close();
}

function orderPayload() {
  const items = [...byId('orderItems').querySelectorAll('.order-item')].map(row => ({
    quantity: Number(row.querySelector('[data-field="quantity"]').value),
    name: row.querySelector('[data-field="name"]').value,
    category: row.querySelector('[data-field="category"]').value,
    total: Number(row.querySelector('[data-field="total"]').value),
    details: row.querySelector('[data-field="details"]').value,
    observation: row.querySelector('[data-field="observation"]').value,
    border: row.querySelector('[data-field="border"]').value
  }));
  return {
    name: byId('orderName').value,
    whatsapp: byId('orderWhatsapp').value,
    dateTime: byId('orderDateTime').value,
    payment: byId('orderPayment').value,
    address: {
      street: byId('orderStreet').value,
      sitio: byId('orderSite').value,
      reference: byId('orderReference').value,
      observation: byId('orderObservation').value
    },
    items,
    subtotal: numericValue('orderSubtotal'),
    deliveryFee: numericValue('orderDeliveryFee'),
    total: numericValue('orderTotal'),
    paidAmount: numericValue('orderPaidAmount'),
    change: numericValue('orderChange')
  };
}

async function saveOrder(event) {
  event.preventDefault();
  const button = byId('saveOrder');
  button.disabled = true;
  setText('orderMessage', 'Salvando…');
  try {
    const response = await fetch(`/api/orders/${byId('orderId').value}`, {
      method: 'PUT',
      headers: actionHeaders,
      body: JSON.stringify(orderPayload())
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o pedido.');
    closeOrderEditor();
    toast('Pedido atualizado');
    await loadDashboard({ quiet: true });
  } catch (error) {
    setText('orderMessage', error.message);
  } finally {
    button.disabled = false;
  }
}

async function deleteOrder(id, button) {
  const order = ordersById.get(Number(id));
  if (!order) return toast('Pedido não encontrado');
  const warning = `Excluir definitivamente o pedido #${order.id} de ${order.name}, no valor de ${money.format(order.total)}?`;
  if (!confirm(warning)) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/orders/${order.id}`, { method: 'DELETE', headers: actionHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível excluir o pedido.');
    toast('Pedido excluído');
    await loadDashboard({ quiet: true });
  } catch (error) {
    toast(error.message);
    button.disabled = false;
  }
}

function renderLogs(logs) {
  const container = byId('logs');
  container.replaceChildren();
  byId('emptyLogs').hidden = logs.length > 0;
  for (const entry of logs) {
    const item = document.createElement('article');
    item.className = 'log';
    const meta = document.createElement('div');
    meta.className = 'log-meta';
    const source = document.createElement('strong');
    source.textContent = entry.source;
    const date = document.createElement('span');
    date.textContent = entry.dateTime;
    const message = document.createElement('p');
    message.className = 'log-message';
    message.textContent = entry.message;
    meta.append(source, date);
    item.append(meta, message);
    container.append(item);
  }
}

async function loadDashboard({ quiet = false } = {}) {
  try {
    const response = await fetch('/api/dashboard', { cache: 'no-store' });
    if (!response.ok) throw new Error('Não foi possível carregar o painel.');
    const data = await response.json();
    const stats = data.stats;
    setText('todayTotal', money.format(stats.today.total));
    setText('todayOrders', plural(stats.today.orders, 'pedido', 'pedidos'));
    setText('monthTotal', money.format(stats.month.total));
    setText('monthOrders', plural(stats.month.orders, 'pedido', 'pedidos'));
    setText('topSite', stats.topSite?.name || '—');
    setText(
      'topSiteDetails',
      stats.topSite ? `${money.format(stats.topSite.total)} · ${plural(stats.topSite.orders, 'pedido', 'pedidos')}` : 'Nenhum pedido de sítio'
    );
    renderPerson('week', stats.topCustomerWeek);
    renderPerson('month', stats.topCustomerMonth);
    renderOrders(stats.orders);
    renderLogs(data.logs);
    renderStatus(data.bot);
    if (!footerDirty && document.activeElement !== byId('ticketFooter')) {
      byId('ticketFooter').value = data.footer || '';
      byId('printSize').value = String(data.printSize || 1);
      updateFooterCount();
    }
    setText('lastUpdate', `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`);
    if (!quiet) toast('Painel atualizado');
  } catch (error) {
    renderStatus({ state: 'error' });
    if (!quiet) toast(error.message);
  }
}

function updateFooterCount() {
  setText('footerCount', `${byId('ticketFooter').value.length}/180`);
}

async function saveFooter() {
  const button = byId('saveFooter');
  button.disabled = true;
  try {
    const response = await fetch('/api/settings/printing', {
      method: 'PUT',
      headers: actionHeaders,
      body: JSON.stringify({
        footer: byId('ticketFooter').value,
        printSize: Number(byId('printSize').value)
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
    footerDirty = false;
    setText('footerMessage', 'Tamanho e frase salvos para as próximas comandas.');
    toast('Impressão configurada');
  } catch (error) {
    setText('footerMessage', error.message);
  } finally {
    button.disabled = false;
  }
}

async function action(url, method, successMessage) {
  const response = await fetch(url, { method, headers: actionHeaders, body: method === 'POST' ? '{}' : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'A ação não pôde ser concluída.');
  setText('actionMessage', data.message || successMessage);
  toast(successMessage);
  setTimeout(() => loadDashboard({ quiet: true }), 2000);
}

byId('ticketFooter').addEventListener('input', () => { footerDirty = true; updateFooterCount(); });
byId('printSize').addEventListener('change', () => { footerDirty = true; });
byId('saveFooter').addEventListener('click', saveFooter);
byId('refreshButton').addEventListener('click', () => loadDashboard());
byId('orderForm').addEventListener('submit', saveOrder);
byId('closeOrderDialog').addEventListener('click', closeOrderEditor);
byId('cancelOrderEdit').addEventListener('click', closeOrderEditor);
byId('addOrderItem').addEventListener('click', () => addOrderItem());
byId('orderDeliveryFee').addEventListener('input', recalculateOrderTotals);
byId('orderSubtotal').addEventListener('input', () => {
  byId('orderTotal').value = (numericValue('orderSubtotal') + numericValue('orderDeliveryFee')).toFixed(2);
  recalculateChange();
});
byId('orderTotal').addEventListener('input', recalculateChange);
byId('orderPaidAmount').addEventListener('input', recalculateChange);
byId('orderPayment').addEventListener('change', recalculateChange);
byId('restartBot').addEventListener('click', async () => {
  if (!confirm('Reiniciar o bot agora? O atendimento ficará indisponível por alguns segundos.')) return;
  try { await action('/api/bot/restart', 'POST', 'Bot reiniciando'); } catch (error) { toast(error.message); }
});
byId('clearSession').addEventListener('click', async () => {
  const warning = 'Apagar a sessão do WhatsApp? Você precisará escanear um novo QR Code no terminal para voltar a atender.';
  if (!confirm(warning)) return;
  if (!confirm('Confirma a exclusão somente da sessão autenticada do WhatsApp?')) return;
  try { await action('/api/whatsapp/session', 'DELETE', 'Sessão sendo apagada'); } catch (error) { toast(error.message); }
});
byId('clearLogs').addEventListener('click', async () => {
  if (!confirm('Limpar a lista de erros exibida no painel?')) return;
  try {
    await action('/api/logs', 'DELETE', 'Erros removidos');
    await loadDashboard({ quiet: true });
  } catch (error) { toast(error.message); }
});

loadDashboard({ quiet: true });
setInterval(() => loadDashboard({ quiet: true }), 10000);
