# Como criar e usar o token do painel

O painel precisa de um token porque é ele que autoriza a atualização do arquivo `data.json` no seu repositório.

## Criar um token seguro

1. Entre na conta do GitHub proprietária do repositório.
2. Abra <https://github.com/settings/personal-access-tokens/new>.
3. Em **Token name**, use algo como `Painel Cardápio`.
4. Escolha uma expiração. Recomenda-se 90 dias e a renovação periódica.
5. Em **Resource owner**, selecione `arcelino-cavalcante`.
6. Em **Repository access**, escolha **Only select repositories**.
7. Selecione somente `novo-cardapio-git-cms`.
8. Em **Repository permissions**, abra **Contents** e selecione **Read and write**.
9. Não habilite outras permissões.
10. Clique em **Generate token** e copie o código exibido.

Tokens fine-grained normalmente começam com `github_pat_`.

O GitHub mostra o token completo apenas uma vez. Não coloque esse código em `data.json`, arquivos do projeto, commits, mensagens ou capturas de tela.

## Usar no painel

1. Abra `admin.html` no endereço publicado do cardápio.
2. Cole o token no campo **Token de Acesso**.
3. Clique em **Acessar Painel**.
4. Edite produtos, categorias, taxas ou informações.
   - Para imagens, você pode informar uma URL ou selecionar um arquivo JPG, PNG, WebP ou GIF de até 2 MB.
   - Arquivos selecionados serão gravados em `images/products/`; o `data.json` receberá apenas a URL pública.
5. Observe o aviso **Alterações pendentes de publicação**.
6. Clique em **Salvar e Publicar**.
7. Aguarde a confirmação de que o commit foi criado no GitHub.
8. Clique em **Sair** quando terminar.

## Como o token é armazenado

O token fica somente no `sessionStorage` do navegador. Ele não é gravado no repositório nem no `localStorage`. Ao clicar em **Sair**, ele é removido imediatamente.

Como o painel é um site estático, o token necessariamente passa pelo navegador para falar com a API do GitHub. A proteção prática é usar um token fine-grained, limitado a um único repositório, com apenas `Contents: Read and write` e prazo de expiração.

## Se der erro

- **Token inválido ou expirado:** gere um novo token e entre novamente.
- **Sem acesso de escrita:** confirme `Contents: Read and write`.
- **Repositório não encontrado:** confirme o proprietário e se o repositório foi selecionado no token.
- **Conflito ao publicar:** recarregue o painel para buscar a versão mais recente e refaça a alteração.
- **Site ainda não atualizou:** confira se a hospedagem vinculada ao GitHub concluiu uma nova publicação.

Se um token for exposto, revogue-o em <https://github.com/settings/personal-access-tokens> e crie outro.
