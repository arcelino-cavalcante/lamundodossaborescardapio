# Mapa do Projeto — Cardápio com GitHub CMS

## Visão geral

Este projeto é um cardápio digital estático. O próprio repositório GitHub funciona como fonte de dados: todo o conteúdo editável fica em `data.json`.

Não há Firebase, banco externo, KDS/cozinha, impressão térmica ou servidor de pagamentos. Pix aparece apenas como forma de pagamento informada no pedido enviado pelo WhatsApp.

## Arquitetura

- `index.html`: cardápio do cliente, carrinho e envio do pedido pelo WhatsApp.
- `admin.html`: painel de edição protegido por um token pessoal do GitHub.
- `data.json`: categorias, produtos, taxas, grupos de opcionais e dados do estabelecimento.
- `images/products/`: imagens enviadas pelo painel administrativo.
- `js/app.js`: comportamento do cardápio, carrinho, histórico local e WhatsApp.
- `js/admin.js`: edição em memória e publicação de `data.json` pela API do GitHub.
- `js/db.js`: esquema padrão, normalização dos dados, imagens e formatação monetária.
- `js/ui.js`: alertas e confirmações do painel.
- `sw.js`: cache básico do PWA, com prioridade para conteúdo atualizado da rede.
- `vite.config.js`: desenvolvimento e build multipágina de `index.html` e `admin.html`.

## Fluxo dos dados

1. O cardápio carrega `data.json` do site.
2. O administrador entra em `admin.html` usando um token do GitHub.
3. O painel lê o `data.json` diretamente da API do GitHub.
4. As edições ficam pendentes na memória do navegador.
5. Imagens selecionadas são enviadas para `images/products/` em commits próprios.
6. O produto guarda somente a URL pública da imagem, nunca o conteúdo Base64.
7. O botão **Salvar e Publicar** cria o commit que atualiza `data.json`.
8. O GitHub Pages publica a nova versão.

## Upload de imagens

- Formatos aceitos: JPG, PNG, WebP e GIF.
- Tamanho máximo por arquivo: 2 MB.
- A seleção do arquivo não publica imediatamente; ela entra na fila de alterações.
- Ao usar **Salvar e Publicar**, o painel envia primeiro as imagens e depois o `data.json`.
- Se a publicação dos dados falhar depois do upload, o painel mantém o estado para permitir uma nova tentativa sem reenviar a mesma imagem.

## Fluxo do pedido

1. O cliente adiciona produtos ao carrinho.
2. Informa nome, entrega e forma de pagamento: Pix, cartão na maquineta ou dinheiro.
3. O sistema monta uma mensagem e abre o WhatsApp do estabelecimento.
4. Carrinho, favoritos e histórico do dia são mantidos apenas no navegador do cliente.

## Desenvolvimento

```bash
npm ci
npm run dev
```

Build de produção:

```bash
npm run build
```

O build gera cardápio, painel, `data.json` e service worker dentro de `dist/`.

## Segurança do painel

O projeto é totalmente estático, portanto não existe login em servidor. O token é enviado diretamente do navegador para a API oficial do GitHub e fica guardado somente em `sessionStorage`; ele é removido ao encerrar a sessão da aba ou ao clicar em **Sair**.

Use exclusivamente um token fine-grained restrito ao repositório e com a permissão mínima `Contents: Read and write`. Consulte `GITHUB_TOKEN_GUIDE.md`.
