const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const actionHeaders = { 'Content-Type': 'application/json', 'X-Leonus-Action': 'painel-local' };
let footerDirty = false;
let toastTimer;

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
  const body = byId('ordersBody');
  body.replaceChildren();
  byId('emptyOrders').hidden = orders.length > 0;
  for (const order of orders) {
    const row = document.createElement('tr');
    const values = [
      formatDateTime(order.dateTime),
      order.name,
      order.site || order.delivery || 'Retirada',
      order.payment,
      money.format(order.total)
    ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    body.append(row);
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
