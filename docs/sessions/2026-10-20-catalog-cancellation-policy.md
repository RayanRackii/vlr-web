# Política de cancelamento do catálogo por tenant

Implementação local em `feat/catalog-cancel-policy`, diretamente com Codex por autorização do usuário, sem agentes, skills, commit, push, merge, deploy ou aplicação de migration.

## Configuração administrativa

Menu Catálogo → Configurações, rota `/catalogo/configuracoes`. Usa `catalog.products.manage` e o contexto de tenant existente (incluindo Super-Admin dentro do ambiente). Nenhum tenantId é enviado no payload. Os clientes compartilhados de API e a autenticação não foram alterados.

`GET/PUT /api/catalog/policy`: flags independentes para pedidos e solicitações, limite inclusivo do pedido (`Requested`, `Approved`, `Preparing`, `Ready`), limite da solicitação (`Submitted`) e texto opcional até 2000 caracteres. PUT substitui os campos; texto vazio envia null. Formulário RHF/Zod, validity gate, bloqueio durante gravação, toast de sucesso/erro, retry de leitura e respeito ao trial read-only existente. Copy em pt-BR/en/es.

## Portal do cliente

Detalhes de pedidos e `/catalogo/solicitacoes/:requestId` consultam `GET /api/catalog/portal/policy`. Sem resposta válida, Cancelar fica oculto; erro oferece retry. Limites de pedidos são inclusivos; estados finais e desconhecidos nunca permitem cancelar. Solicitações permitem somente Submitted quando habilitadas.

O diálogo renderiza o texto da política como texto simples, preservando quebras de linha. Confirmar chama POST sem body no endpoint do item. HTTP 400/409 preserva a mensagem da API, mantém o diálogo e permite tentar novamente; clique duplicado em voo é ignorado. Sucesso atualiza o estado com a resposta, traduz Cancelled e oculta o botão. O cancelamento da solicitação usa o DTO de mutação, sem exigir URLs de arquivos, e preserva as URLs do read model já exibido. Troca de id/tenant descarta leituras anteriores do detalhe/política.

## Como testar

1. Admin do tenant ou Super-Admin no ambiente: abrir Catálogo → Configurações. Definir pedidos até Approved, habilitar solicitações e salvar um texto como “Sem reembolso.”; recarregar e conferir persistência. Desabilitar ambas as flags também deve persistir. Apagar o texto deve enviar null.
2. Cliente do mesmo tenant: pedido Requested/Approved mostra Cancelar; Preparing/Ready e estados finais não. Abrir a confirmação, conferir o texto e dispensar sem POST. Confirmar deve atualizar para Cancelled.
3. Em Minhas solicitações, abrir uma Submitted: habilitada mostra Cancelar solicitação e o texto; confirmar atualiza o status sem apagar links de arquivos. Desabilitada ou já cancelada não mostra a ação.
4. Alterar a política/status no servidor antes de confirmar: o 409/400 deve aparecer no diálogo com a mensagem retornada. Uma política indisponível não deve habilitar cancelamento por default.
5. Conferir os três idiomas e outro tenant com política diferente.

## Validação e próximos passos

Validação final: `npx vitest run --maxWorkers=2 && npm run build` passou: **181 arquivos, 1376 testes**, TypeScript e Vite concluídos. O build emitiu avisos de minificação CSS para `@theme`/`@utility`; não foram alterados CSS, dependências ou configuração do bundler nesta tarefa. `git diff --check` passou.

O comando solicitado `npx vitest run && npm run build` foi tentado: após corrigir uma suposição de wildcard no teste novo de navegação, uma execução falhou por timeout no teste existente da agenda `clears a rejected date when history returns to a valid day` (data continuou em 20/10 ao voltar, em vez de 15/10). Esse teste passou na execução completa anterior e na final com dois workers, sem alteração nos arquivos da agenda. O build foi executado com sucesso após a suíte final.

Cobertura Vitest: schemas/limites inclusivos e terminais, contratos e mensagens 400/409, configuração administrativa, permissões/navegação, confirmação e clique duplicado, atualização dos detalhes e preservação de arquivos.

O fetch de origin foi tentado e bloqueado pelo sandbox: metadados Git da worktree fora da área gravável. A branch já existia e a working tree estava limpa antes da implementação; nenhum metadado foi alterado.

Próximo WEB: validação integrada em DEV com a API e migration disponíveis. Próximo API: suíte completa com sockets habilitados, validação PostgreSQL e aplicação da migration `20261020131737_AddCatalogPolicy` somente em etapa autorizada. O contrato da API é o diário de mesmo nome no repo irmão `wtf6-api`.
