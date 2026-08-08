function createMessages(config) {
  return {
    menu:
      `Olá! Faça seu pedido pelo cardápio digital:\n${config.cardapioUrl}\n\n` +
      'Ajuda:\n1 - Tutorial de como fazer o pedido\n2 - Horário de funcionamento\n3 - Localização\n\n' +
      'Digite o número de uma opção ou *cancelar* para recomeçar.',

    tutorial:
      `*Tutorial de Pedido:*\n\n1. Acesse ${config.cardapioUrl}\n` +
      '2. Escolha os produtos, tamanhos e opcionais.\n' +
      '3. Informe entrega, nome, WhatsApp e endereço.\n' +
      '4. Escolha Pix, cartão ou dinheiro.\n' +
      '5. Toque em Finalizar Pedido e envie a mensagem pronta no WhatsApp.\n' +
      '6. Continue o atendimento por aqui e confirme o pedido.',

    hours: '⏰ Horário de funcionamento: consulte a informação atualizada no cardápio digital.',
    location: '📌 Localização: consulte o endereço atualizado na seção Informações do cardápio.',
    status: 'Estamos preparando o mais rápido possível para você. Obrigado pela compreensão! 😋',
    thanks: 'Gratidão! Que o Senhor ilumine sua vida. 🙏'
  };
}

module.exports = { createMessages };
