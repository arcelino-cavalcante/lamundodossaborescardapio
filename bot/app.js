const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./src/config');
const { createDatabase } = require('./src/database');
const { createMessages } = require('./src/messages');
const { isOrderMessage, parseOrder, validateOrder } = require('./src/order-parser');
const { createPrinter } = require('./src/printer');
const { generatePixPayload, loadPixSettings } = require('./src/pix');
const { confirmationMessage, money } = require('./src/ticket');

const KEYWORDS = [
  'boa noite', 'boa tarde', 'oi', 'olá', 'ola', 'e aí', 'e ai',
  'pastel', 'hambúrguer', 'hamburguer', 'esfirra', 'pizza', 'açaí', 'açai',
  'cardápio', 'cardapio', 'comida'
];
const STATUS_KEYWORDS = ['vai demorar', 'ta vindo', 'tá vindo', 'ta saindo', 'tá saindo', 'que horas'];
const THANK_KEYWORDS = ['obrigado', 'obrigada', 'amém', 'amem', 'ok'];

const sessions = new Map();
const messages = createMessages(config);
const printer = createPrinter(config);

function createSession() {
  return { state: 'initial', order: null, sourceMessageId: '' };
}

function getSession(phone) {
  if (!sessions.has(phone)) sessions.set(phone, createSession());
  return sessions.get(phone);
}

function resetSession(phone) {
  sessions.set(phone, createSession());
}

function phoneNumber(chatId = '') {
  return chatId.split('@')[0].replace(/\D/g, '');
}

function isDirectCustomerChat(chatId = '') {
  return /@(c\.us|lid)$/.test(chatId);
}

function isAdmin(chatId) {
  return config.adminNumbers.has(phoneNumber(chatId));
}

async function pixInstructions(order, chatId) {
  const pix = await loadPixSettings(config);
  if (!pix.key) {
    return '⚠️ O Pix está temporariamente indisponível. Escolha cartão ou dinheiro e envie novamente o pedido.';
  }
  const txid = `PEDIDO${phoneNumber(chatId).slice(-8)}${Date.now().toString().slice(-6)}`;
  const payload = generatePixPayload({ ...pix, amount: order.total, txid });
  return {
    details: (
    '💠 *Pagamento via Pix*\n\n' +
    `🔑 *Chave Pix:* ${pix.key}\n` +
    `*Titular:* ${pix.holder}\n` +
    `*Valor Total:* ${money(order.total)}\n\n` +
    'Copie o código da próxima mensagem no aplicativo do seu banco. Depois, envie o comprovante por aqui.'
    ),
    payload
  };
}

function reportMessage(report, day) {
  let text = `📊 Relatório de ${day === 'yesterday' ? 'ontem' : 'hoje'}:\n\n`;
  text += `💰 Total vendido: ${money(report.total)}\n\n👑 Top 3 clientes:\n`;
  report.customers.forEach((row, index) => {
    text += `${index + 1}. ${row.nome || 'Sem nome'} – ${money(row.total)}\n`;
  });
  text += '\n🏘️ Top 3 sítios:\n';
  report.sitios.forEach((row, index) => {
    text += `${index + 1}. ${row.sitio || 'Não informado'} – ${row.quantidade || 0} pedidos\n`;
  });
  return text;
}

async function main() {
  const database = await createDatabase(config.dbPath);
  const client = new Client({
    authStrategy: new LocalAuth({ clientId: config.clientId, dataPath: config.authPath }),
    puppeteer: {
      headless: config.headless,
      executablePath: config.chromePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  async function safeSend(chatId, content, options = {}) {
    try {
      return await client.sendMessage(chatId, content, { sendSeen: false, ...options });
    } catch (error) {
      console.error('[WHATSAPP] Falha ao enviar mensagem:', error.message || error);
      return null;
    }
  }

  const safeReply = (message, content, options = {}) => safeSend(message.from, content, options);

  client.on('qr', qr => {
    console.log('Escaneie o QR Code abaixo com o WhatsApp da pizzaria:');
    qrcode.generate(qr, { small: true });
  });
  client.on('ready', async () => {
    console.log('LEONUS pronto para atender.');
    console.log(`Impressão: ${printer.isEnabled() ? 'ativada' : 'desativada'}`);
    const pix = await loadPixSettings(config);
    console.log(`Pix: ${pix.key ? 'configurado' : 'aguardando configuração no painel admin'}`);
  });
  client.on('auth_failure', message => console.error('[WHATSAPP] Falha de autenticação:', message));
  client.on('disconnected', reason => console.error('[WHATSAPP] Desconectado:', reason));

  client.on('message', async message => {
    try {
      const chatId = message.from;

      // O WhatsApp também dispara este evento para Status, canais, listas e
      // grupos. O bot atende somente conversas individuais de clientes.
      if (message.fromMe || !isDirectCustomerChat(chatId)) return;

      const text = message.body?.trim() || '';
      const lower = text.toLowerCase();
      const session = getSession(chatId);
      const isMedia = ['image', 'video', 'audio', 'document'].includes(message.type);

      console.log('[ENTRADA]', { de: phoneNumber(chatId), tipo: message.type });

      if (message.type === 'location') {
        return safeReply(message, '🛵 Localização recebida. O entregador agradece!');
      }

      if (lower === 'cancelar') {
        resetSession(chatId);
        return safeReply(message, messages.menu);
      }

      if (lower.startsWith('admin:')) {
        if (!isAdmin(chatId)) return safeReply(message, '⛔ Comando não autorizado.');

        if (lower.startsWith('admin: valor')) {
          const day = lower.includes('ontem') ? 'yesterday' : 'today';
          const report = await database.salesReport(day);
          return safeReply(message, reportMessage(report, day));
        }
        if (lower.startsWith('admin: imp')) {
          const enabled = !lower.includes('nao') && !lower.includes('não') && !lower.includes('off');
          printer.setEnabled(enabled);
          return safeReply(message, `Impressão ${enabled ? 'ATIVADA' : 'DESATIVADA'}.`);
        }
        return safeReply(message, 'Comando administrativo desconhecido.');
      }

      if (isOrderMessage(text)) {
        const order = parseOrder(text);
        const errors = validateOrder(order);
        if (errors.length) {
          console.error('[PEDIDO] Campos ausentes:', errors);
          return safeReply(
            message,
            `⚠️ Não consegui ler: ${errors.join(', ')}. Volte ao cardápio, revise os campos e envie o pedido novamente.`
          );
        }

        session.order = order;
        session.sourceMessageId = message.id?._serialized || `${chatId}-${Date.now()}`;

        if (order.payment === 'Pix') {
          session.state = 'awaiting_pix_proof';
          const pixMessage = await pixInstructions(order, chatId);
          if (typeof pixMessage === 'string') return safeReply(message, pixMessage);
          await safeReply(message, pixMessage.details);
          return safeReply(message, `\`\`\`${pixMessage.payload}\`\`\``);
        }

        session.state = 'awaiting_confirmation';
        return safeReply(message, confirmationMessage(order));
      }

      if (STATUS_KEYWORDS.some(keyword => lower.includes(keyword))) {
        return safeReply(message, messages.status);
      }
      if (THANK_KEYWORDS.some(keyword => lower === keyword || lower.includes(keyword))) {
        return safeReply(message, messages.thanks);
      }
      if (KEYWORDS.some(keyword => lower.includes(keyword))) {
        session.state = 'menu';
        return safeReply(message, messages.menu);
      }

      if (session.state === 'menu') {
        if (lower === '1') return safeReply(message, messages.tutorial);
        if (lower === '2') return safeReply(message, messages.hours);
        if (lower === '3') return safeReply(message, messages.location);
      }

      if (session.state === 'awaiting_pix_proof') {
        if (!isMedia) return safeReply(message, '📲 Por favor, envie a imagem ou o documento do comprovante Pix.');
        session.state = 'awaiting_confirmation';
        return safeReply(message, `📥 Comprovante recebido.\n\n${confirmationMessage(session.order)}`);
      }

      if (session.state === 'awaiting_confirmation') {
        if (lower === '2' || lower.startsWith('não') || lower.startsWith('nao')) {
          resetSession(chatId);
          return safeReply(message, '❌ Pedido cancelado. Envie “oi” para começar novamente.');
        }
        if (lower !== '1' && !lower.startsWith('sim')) return;

        const saved = await database.saveOrder(phoneNumber(chatId), session.order, session.sourceMessageId);
        if (saved.duplicate) {
          resetSession(chatId);
          return safeReply(message, '✅ Este pedido já havia sido confirmado. Não imprimimos uma segunda via automaticamente.');
        }

        let printResult;
        try {
          printResult = await printer.print(session.order);
        } catch (error) {
          console.error('[IMPRESSORA]', error.message || error);
          printResult = { printed: false, reason: 'error' };
        }

        const printText = printResult.printed
          ? 'Pedido confirmado e impresso!'
          : printResult.reason === 'disabled'
            ? 'Pedido confirmado! A impressão automática está desativada.'
            : 'Pedido confirmado! Houve uma falha na impressão; a equipe deve conferir o painel do bot.';

        await safeReply(
          message,
          `✅ ${printText}\n\nMuito obrigado. Que Deus abençoe! 🙏\n` +
          (session.order.deliveryType === 'Sítio' ? '\nEnvie sua localização para ajudar o entregador.' : '')
        );
        resetSession(chatId);
      }
    } catch (error) {
      console.error('[ATENDIMENTO]', error.stack || error);
      await safeReply(message, '❌ Ocorreu um erro ao processar sua mensagem. Digite “cancelar” e tente novamente.');
    }
  });

  async function shutdown(signal) {
    console.log(`\nEncerrando o bot (${signal})...`);
    try { await client.destroy(); } catch (error) { console.error(error.message); }
    try { await database.close(); } catch (error) { console.error(error.message); }
    process.exit(0);
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  await client.initialize();
}

main().catch(error => {
  console.error('[INICIALIZAÇÃO]', error.stack || error);
  process.exitCode = 1;
});
