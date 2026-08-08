const path = require('node:path');
const os = require('node:os');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function booleanValue(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).toLowerCase());
}

function defaultChromePath() {
  if (os.platform() === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }
  if (os.platform() === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }
  return '/usr/bin/google-chrome-stable';
}

const botRoot = path.resolve(__dirname, '..');
const cardapioUrl = process.env.CARDAPIO_URL || 'https://lamundodossabores.com.br/';

module.exports = {
  cardapioUrl,
  cardapioDataUrl: process.env.CARDAPIO_DATA_URL || new URL('data.json', cardapioUrl.endsWith('/') ? cardapioUrl : `${cardapioUrl}/`).toString(),
  pixKey: process.env.PIX_KEY || '',
  pixHolder: process.env.PIX_HOLDER || '',
  pixCity: process.env.PIX_CITY || 'Garanhuns',
  printerIp: process.env.PRINTER_IP || '192.168.3.14',
  printerPort: Number(process.env.PRINTER_PORT || 9100),
  printEnabled: booleanValue(process.env.PRINT_ENABLED, true),
  printerCharsPerLine: Number(process.env.PRINTER_CHARS_PER_LINE || 40),
  adminNumbers: new Set(
    (process.env.ADMIN_NUMBERS || '')
      .split(',')
      .map(value => value.replace(/\D/g, ''))
      .filter(Boolean)
  ),
  chromePath: process.env.CHROME_PATH || defaultChromePath(),
  headless: booleanValue(process.env.HEADLESS, false),
  clientId: process.env.WHATSAPP_CLIENT_ID || 'la-mundo',
  authPath: path.join(botRoot, '.wwebjs_auth'),
  dbPath: path.resolve(botRoot, process.env.DB_PATH || './leonus.db'),
  timezone: process.env.TIMEZONE || 'America/Recife',
  storeName: process.env.STORE_NAME || 'LA MUNDO DOS SABORES',
  ticketFooter: process.env.TICKET_FOOTER || 'É hoje que eu como mais uma fatia!',
  dashboardHost: process.env.DASHBOARD_HOST || '127.0.0.1',
  dashboardPort: Number(process.env.DASHBOARD_PORT || 3030),
  dashboardAutoOpen: booleanValue(process.env.DASHBOARD_AUTO_OPEN, true)
};
