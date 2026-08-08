const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

function booleanValue(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'sim', 'yes', 'on'].includes(String(value).toLowerCase());
}

function defaultChromePath() {
  const candidates = [];

  if (os.platform() === 'darwin') candidates.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  if (os.platform() === 'win32') {
    candidates.push(
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
    );
  }
  if (os.platform() === 'linux') candidates.push('/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium');

  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
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
