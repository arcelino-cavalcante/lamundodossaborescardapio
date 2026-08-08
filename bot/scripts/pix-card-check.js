const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('../src/config');
const { loadPixSettings } = require('../src/pix');
const { sendPixCard } = require('../src/whatsapp-pix');

async function main() {
  let client;
  try {
    const puppeteer = {
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    if (config.chromePath) puppeteer.executablePath = config.chromePath;
    client = new Client({
      authStrategy: new LocalAuth({ clientId: config.clientId, dataPath: config.authPath }),
      puppeteer
    });
    client.on('qr', qr => qrcode.generate(qr, { small: true }));
    const ready = new Promise((resolve, reject) => {
      client.once('ready', resolve);
      client.once('auth_failure', reject);
    });

    await client.initialize();
    await ready;
    const pix = await loadPixSettings(config);
    if (!pix.key) throw new Error('Configure o Pix no painel admin antes do teste.');

    const selfChat = client.info?.wid?._serialized;
    if (!selfChat) throw new Error('Não foi possível identificar o WhatsApp conectado.');
    console.log('Enviando cartão Pix de teste para a conversa do próprio número...');
    const sent = await sendPixCard(client, selfChat, pix, `TESTE${Date.now().toString().slice(-10)}`);
    if (!sent) throw new Error('O cartão Pix nativo não foi aceito pelo WhatsApp Web.');
    console.log('Cartão Pix de teste enviado com sucesso.');
  } finally {
    if (client) await client.destroy().catch(() => {});
  }
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
