# Proposta: regras em três telas, e Layout vs Mapa do espaço

Status: proposta. Nenhuma decisão aqui autoriza implementação.

## Regras

Hoje existem três editores, e cada um grava uma coisa diferente.

- **Regras de reserva** (`/configuracoes/politica-reservas`) guarda o horizonte, o corte de cancelamento, o limite diário e o texto do tenant. O texto diz que um recurso pode substituir isso. A substituição fica no recurso, não nesta página.
- **Configurações de vendas** (`/catalogo/configuracoes`) guarda se o cliente cancela pedido ou solicitação, e até qual situação.
- **Preço** fica no produto, no assistente e no editor. Não é regra de reserva.

Nenhuma tela responde “o que este cliente pode fazer”.

Recomendação:

- Manter os três editores. Juntar os formulários misturaria reserva, venda e preço.
- Em Regras de reserva, trocar a frase solta por um link para o recurso onde a substituição é editada. Não mover esse formulário para a página do tenant.
- Se a navegação ainda confundir, agrupar Regras de reserva e Configurações de vendas sob um título Regras. O preço continua no produto.
- Uma ficha “o que este cliente pode fazer” seria só leitura, depois. Ela leria a regra do tenant, a substituição do recurso, o cancelamento de vendas e o preço. Isso precisa de decisão de produto antes de qualquer API.

## Layout e Mapa do espaço

O item da sidebar chama **Mapa do espaço**. A página em `/configuracoes/layout` chama **Layout**. A descrição já diz que a página arruma os espaços no mapa que o cliente vê. O mapa em que o cliente reserva também é chamado mapa do espaço.

Recomendação:

- Um nome só para a tela de staff: **Montagem do mapa**, na sidebar e no título. A descrição atual pode ficar.
- **Mapa do espaço** fica com a vista em que se reserva.
- Não reconstruir o mapa nem o editor de layout.
