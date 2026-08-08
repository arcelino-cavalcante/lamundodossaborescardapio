const { buildPixPaymentParams } = require('./pix');

async function sendPixCard(client, chatId, pix, referenceId) {
  try {
    const paymentParams = buildPixPaymentParams(pix, referenceId);
    const sent = await client.pupPage.evaluate(async ({ destination, params }) => {
      const chat = await window.WWebJS.getChat(destination, { getAsModel: false });
      if (!chat) return false;
      await window.WWebJS.sendMessage(chat, '', {
        extraOptions: {
          type: 'interactive',
          caption: '',
          nativeFlowName: 'payment_info',
          interactiveType: 'native_flow',
          interactivePayload: {
            buttons: [{
              name: 'payment_info',
              buttonParamsJson: JSON.stringify(params)
            }],
            messageVersion: 1
          },
          messageSecret: window.crypto.getRandomValues(new Uint8Array(32))
        }
      });
      // A versão atual do WhatsApp Web pode não devolver o modelo da mensagem
      // mesmo depois de aceitar o envio; ausência de exceção é a confirmação.
      return true;
    }, { destination: chatId, params: paymentParams });
    if (!sent) throw new Error('O WhatsApp não confirmou o envio do cartão.');
    return true;
  } catch (error) {
    console.error('[PIX] Falha ao enviar cartão nativo:', error.message || error);
    return false;
  }
}

module.exports = { sendPixCard };
