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

function detectPixKeyType(key) {
  const value = String(key || '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'EMAIL';
  if (/^\+\d{10,15}$/.test(value)) return 'PHONE';
  if (/^\d{11}$/.test(value)) return 'CPF';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return 'EVP';
  return 'EVP';
}

function buildPixPaymentParams({ key, holder }, referenceId = `PEDIDO${Date.now()}`) {
  const pixKey = String(key || '').trim();
  const merchantName = String(holder || '').trim();
  if (!pixKey || !merchantName) throw new Error('Chave e titular do Pix são obrigatórios.');

  return {
    order: {
      items: [{
        name: '',
        retailer_id: `pedido-${referenceId}`,
        amount: { offset: 1, value: 0 },
        quantity: 0
      }],
      order_type: 'ORDER_WITHOUT_AMOUNT',
      status: 'payment_requested',
      subtotal: { value: 0, offset: 1 }
    },
    total_amount: { value: 0, offset: 1 },
    reference_id: referenceId,
    payment_settings: [{
      type: 'pix_static_code',
      pix_static_code: {
        merchant_name: merchantName,
        key: pixKey,
        key_type: detectPixKeyType(pixKey)
      }
    }],
    external_payment_configurations: [],
    additional_note: '',
    currency: 'BRL',
    type: 'physical-goods'
  };
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

module.exports = { buildPixPaymentParams, crc16, detectPixKeyType, generatePixPayload, loadPixSettings, normalizeMerchantText };
