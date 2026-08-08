const config = require('../src/config');
const { createPrinter } = require('../src/printer');

const testOrder = {
  name: 'TESTE LOCAL DO BOT',
  customerWhatsapp: 'Não se aplica',
  deliveryType: 'Teste de impressão',
  address: {
    observation: 'Se este comprovante saiu completo, a conexão está funcionando.'
  },
  items: [
    {
      name: 'IMPRESSÃO DE TESTE',
      category: 'SISTEMA',
      quantity: 1,
      total: 0,
      observation: 'Não preparar este item.',
      border: ''
    }
  ],
  subtotal: 0,
  deliveryFee: 0,
  total: 0,
  payment: 'Teste',
  changeNeeded: false
};

async function main() {
  const printer = createPrinter({ ...config, printEnabled: true });
  console.log(`Enviando teste para ${config.printerIp}:${config.printerPort}...`);
  const result = await printer.print(testOrder);
  if (!result.printed) throw new Error(`Teste não impresso: ${result.reason || 'motivo desconhecido'}`);
  console.log('Teste enviado com sucesso para a impressora.');
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
