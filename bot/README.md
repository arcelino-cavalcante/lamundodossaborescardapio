# LEONUS — Bot do cardápio La Mundo

O bot recebe no WhatsApp a mensagem gerada pelo cardápio novo, continua o atendimento, registra o pedido em SQLite e imprime em uma impressora térmica ESC/POS conectada à rede local. A impressão é enviada diretamente por TCP, sem a biblioteca legada `escpos`.

## Compatibilidade com o cardápio

O parser reconhece todos os campos atualmente enviados pelo `js/app.js`:

| Campo do cardápio | Uso no bot |
| --- | --- |
| Nome do cliente | Banco, confirmação e impressão |
| WhatsApp | Banco e impressão |
| Endereço/retirada | Confirmação e impressão |
| Sítio | Banco, relatório e impressão |
| Referência e observação | Banco e impressão |
| Produto e categoria | Confirmação e impressão |
| Quantidade | Confirmação e impressão |
| Tamanho, meia pizza e opcionais | Linha de observação do item |
| Borda | Linha própria na impressão |
| Subtotal e taxa | Confirmação e impressão |
| Valor total | Banco, confirmação e impressão |
| Pix, cartão ou dinheiro | Continuação automática do atendimento |
| Troco para | Cálculo e impressão do troco |

O bot não pergunta novamente a forma de pagamento:

- **Pix:** lê chave, titular e cidade publicados pelo painel admin, gera o Pix Copia e Cola com o valor exato e aguarda um comprovante.
- **Cartão:** mostra o resumo e pede confirmação.
- **Dinheiro:** usa o valor de troco informado pelo cardápio e pede confirmação.

## Requisitos

- Node.js 20 ou superior.
- Google Chrome instalado.
- Computador ligado com acesso à internet e à mesma rede da impressora.
- Impressora ESC/POS de rede, normalmente na porta 9100.
- Um número de WhatsApp para a pizzaria.

## Instalação

Dentro da pasta `bot`:

```bash
npm install
cp .env.example .env
```

Configure o Pix em **Admin → Informações**. Os campos abaixo no `.env` são apenas uma alternativa local caso o `data.json` não possa ser carregado:

```env
PIX_KEY=sua-chave-real
PIX_HOLDER=nome-do-titular
PIX_CITY=Garanhuns
PRINTER_IP=192.168.3.14
PRINTER_PORT=9100
ADMIN_NUMBERS=5587999999999
```

Nunca envie o arquivo `.env` para o GitHub. Ele já está coberto pelo `.gitignore` do projeto.

## Executar

```bash
npm start
```

Na primeira execução, o terminal exibirá um QR Code. No celular da pizzaria, abra **WhatsApp → Aparelhos conectados → Conectar um aparelho** e escaneie o código.

A sessão fica salva em `bot/.wwebjs_auth/`, portanto normalmente não será necessário escanear novamente.

## Testes

```bash
npm test
```

Os testes usam uma mensagem com o formato real do cardápio novo e verificam campos, valores, itens, pagamento, troco, confirmação e conteúdo da impressão. Eles não acessam o WhatsApp nem a impressora.

## Comandos administrativos

Somente números listados em `ADMIN_NUMBERS` podem executar:

- `admin: valor hoje`
- `admin: valor ontem`
- `admin: imp sim`
- `admin: imp não`

## Banco de dados

Os pedidos ficam em `bot/leonus.db`. A tabela antiga é atualizada automaticamente com as novas colunas quando possível. O `message_id` evita que a mesma mensagem seja confirmada e impressa duas vezes.

## Comportamento quando a impressora falha

O pedido continua salvo no SQLite. O bot não afirma que foi impresso: responde que houve falha e registra o erro no terminal com o IP e a porta utilizados.

## Estrutura

```text
bot/
├── app.js
├── .env.example
├── package.json
├── README.md
├── src/
│   ├── config.js
│   ├── database.js
│   ├── messages.js
│   ├── order-parser.js
│   ├── printer.js
│   └── ticket.js
└── test/
    └── order-parser.test.js
```
