function tlv(id, value) {
  const text = String(value ?? '');
  const length = Buffer.byteLength(text, 'utf8');
  if (length > 99) throw new Error(`Campo Pix ${id} excede 99 caracteres.`);
  return `${id}${String(length).padStart(2, '0')}${text}`;
}

function normalizeMerchantText(value, maxLength) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function crc16(payload) {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function generatePixPayload({ key, holder, city, amount, txid = '***' }) {
  const pixKey = String(key || '').trim();
  const merchantName = normalizeMerchantText(holder, 25);
  const merchantCity = normalizeMerchantText(city, 15);
  const rawTxid = String(txid || '***').trim();
  const transactionId = rawTxid === '***'
    ? '***'
    : rawTxid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
  const numericAmount = Number(amount || 0);

  if (!pixKey) throw new Error('Chave Pix não configurada.');
  if (/\s/.test(pixKey) || Buffer.byteLength(pixKey, 'utf8') > 77) throw new Error('Formato da chave Pix inválido.');
  if (!merchantName) throw new Error('Nome do titular do Pix não configurado.');
  if (!merchantCity) throw new Error('Cidade do titular do Pix não configurada.');
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Valor do Pix inválido.');

  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', pixKey);
  const additionalData = tlv('05', transactionId);
  const payload = [
    tlv('00', '01'),
    tlv('26', merchantAccount),
    tlv('52', '0000'),
    tlv('53', '986'),
    tlv('54', numericAmount.toFixed(2)),
    tlv('58', 'BR'),
    tlv('59', merchantName),
    tlv('60', merchantCity),
    tlv('62', additionalData),
    '6304'
  ].join('');

  return `${payload}${crc16(payload)}`;
}

async function loadPixSettings(config) {
  const fallback = {
    key: config.pixKey || '',
    holder: config.pixHolder || '',
    city: config.pixCity || 'Garanhuns'
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const separator = config.cardapioDataUrl.includes('?') ? '&' : '?';
    const response = await fetch(`${config.cardapioDataUrl}${separator}t=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const pix = data?.info?.pix || {};
    return {
      key: String(pix.key || fallback.key).trim(),
      holder: String(pix.holder || fallback.holder).trim(),
      city: String(pix.city || fallback.city).trim()
    };
  } catch (error) {
    console.warn(`[PIX] Não foi possível carregar a configuração do cardápio: ${error.message}. Usando configuração local.`);
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { crc16, generatePixPayload, loadPixSettings, normalizeMerchantText };
