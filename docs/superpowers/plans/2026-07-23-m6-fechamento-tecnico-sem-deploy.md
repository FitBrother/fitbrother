# M6 — Fechamento técnico sem deploy

**Data:** 2026-07-23  
**Escopo:** backend LGPD, retenção, custos, métricas, observabilidade e runbook.  
**Fora do escopo:** Supabase PROD, Fly.io, TestFlight, Play Internal, Meta WABA,
publicação de Termos/Privacidade, provisionamento de Sentry/webhooks e PITR.

## 1. Objetivo

Encerrar o M6 no código e no banco local antes de iniciar o M10. Ao final:

- os consentimentos obrigatórios impedem a conclusão do onboarding quando
  ausentes;
- `ai_processing`, `terms` e `privacy` não podem ser revogados em uma conta
  ativa, porque o serviço depende desses consentimentos; em especial,
  `ai_processing` não possui toggle nem ação de desativação após a criação da
  conta;
- exportação LGPD entrega um ZIP JSON isolado por usuário;
- exclusão torna a conta imediatamente inativa e invisível, mas pode ser
  cancelada durante 30 dias após novo login;
- o hard delete D+30 elimina Auth, dados relacionais e objetos de Storage;
- áudios com mais de 30 dias são removidos;
- custo, sucesso, cache e latência são agregados diariamente em UTC;
- logs e Sentry carregam contexto consistente, sem dados sensíveis;
- validações destrutivas são executadas apenas contra o Supabase local;
- nenhum artefato temporário de teste é mantido no repositório.

## 2. Decisões fechadas

1. `terms`, `privacy` e `ai_processing` são obrigatórios.
2. Sem os três consentimentos, o onboarding não cria/conclui a conta de
   aplicação.
3. Os três consentimentos obrigatórios não podem ser revogados enquanto a conta
   estiver ativa. `ai_processing` faz parte do core do produto: depois de aceito
   na criação da conta, não existe opção de desativá-lo. A única alternativa
   para quem não deseja mais esse processamento é solicitar a exclusão da
   conta.
4. `marketing` continua opcional e revogável.
5. `data_export` pode ser auditado, mas não é requisito para exportar.
6. Exclusão é reversível até o hard delete D+30.
7. Para reativar, a pessoa faz login novamente por senha ou OAuth. O app detecta
   a exclusão pendente, pergunta se deseja reativar e chama o endpoint de
   cancelamento.
8. Durante a exclusão pendente, somente consulta do estado, cancelamento,
   exportação e conclusão da exclusão permanecem acessíveis.
9. O export é síncrono, ZIP apenas com JSON. Binários aparecem somente no
   manifesto.
10. Métricas fecham por dia UTC e não possuem dimensão de usuário.
11. `wa_messages` e alerta de webhook preso saem do M6 e voltam ao escopo do M4.
12. Integrações externas e todo deploy ficam para uma etapa posterior.
13. Testes adicionais do M6 são temporários: criados em `/tmp`, executados e
    removidos. Apenas correções, checks operacionais reutilizáveis já existentes
    e documentação final permanecem no repositório.

## 3. Definição de pronto do M6 técnico

O M6 técnico estará concluído somente quando todos os gates abaixo passarem:

### LGPD

- onboarding rejeita qualquer combinação sem os três consentimentos
  obrigatórios;
- consentimento opcional pode ser concedido, revogado e concedido novamente;
- consentimento obrigatório retorna conflito ao tentar revogar;
- export ZIP abre, possui todos os arquivos previstos e não contém dados de
  outro usuário;
- solicitação de exclusão bloqueia o uso normal e remove a conta das superfícies
  públicas;
- login continua possível durante a janela de retenção;
- cancelamento restaura integralmente os dados e o acesso;
- hard delete D+30 elimina Auth, tabelas dependentes e Storage;
- repetir request de exclusão, cancelamento ou worker não corrompe o estado.

### Retenção

- `purge-accounts` processa contas vencidas de maneira idempotente;
- `purge-audios` remove objetos antigos e registra o resultado;
- falha parcial pode ser repetida sem perder referência ao trabalho pendente;
- lotes maiores que o limite de uma consulta continuam sendo processados em
  execuções subsequentes.

### Métricas e custos

- `metrics_daily` recebe agregados do dia UTC anterior;
- o worker pode rodar novamente sem duplicar valores;
- custo é separado por provider/modelo;
- volume, sucesso, baixa confiança, cache hit e latência são separados por
  origem aplicável;
- p50 e p95 são calculados a partir de durações persistidas, não de logs;
- nenhuma linha de `metrics_daily` contém `user_id`, email, texto da refeição ou
  caminho de arquivo.

### Observabilidade

- cada request autenticada tem escopo Sentry próprio;
- erros possuem `user_id` e `request_id`;
- pipeline possui breadcrumbs para validação, transcrição, extração, catálogo e
  persistência;
- logs Pino do pipeline usam campos padronizados;
- tokens, payloads de provedores, texto bruto, email, telefone e conteúdo do
  export não são enviados a logs/Sentry;
- workers capturam exceções e registram contadores/resultados.

### Qualidade

- migrations aplicam do zero no Supabase local;
- typecheck e lint passam;
- matriz temporária de testes passa integralmente;
- runbook cobre falhas de LGPD, retenção, cotas, métricas, Sentry e RLS;
- PLAN/Trello refletem itens concluídos, removidos e deferidos.

## 4. Arquitetura da exclusão reversível

### 4.1 Estado

Manter `account_deletions` como fonte do estado, acrescentando:

- `cancelled_at timestamptz`;
- `cancelled_request_id text`;
- `purge_attempts integer not null default 0`;
- `last_purge_error text`;
- `last_purge_attempt_at timestamptz`.

Uma exclusão está pendente quando:

```sql
cancelled_at is null
and purged_at is null
and scheduled_purge_at > now()
```

Uma exclusão está vencida quando a mesma condição vale e
`scheduled_purge_at <= now()`.

Não apagar a linha ao cancelar. Ela é trilha operacional. Uma nova solicitação
de exclusão atualiza ou cria um novo ciclo de forma explicitamente auditável.
Se for necessário preservar múltiplos ciclos, trocar a PK por `id` e manter um
índice único parcial para somente um ciclo aberto por usuário.

### 4.2 Autenticação e autorização

Separar a autenticação atual em duas camadas:

- `authTokenRequired`: valida o JWT e preenche `req.user`;
- `activeAccountRequired`: rejeita conta com exclusão pendente.

Rotas normais usam as duas camadas. Rotas de recuperação usam apenas
`authTokenRequired`:

- `GET /account/deletion`;
- `POST /account/deletion/cancel`;
- `GET /account/export`;
- `DELETE /account` para repetição idempotente.

Resposta padronizada de conta inativa:

```json
{
  "error": "account_deletion_pending",
  "requested_at": "ISO-8601",
  "scheduled_purge_at": "ISO-8601",
  "can_reactivate": true
}
```

Essa resposta é o contrato que o M10 utilizará após login por senha ou OAuth.

### 4.3 Solicitar exclusão

O request deve ser transacional no banco sempre que envolver estado relacional.
Ao solicitar:

1. validar `confirm: true`;
2. travar o ciclo aberto da conta;
3. criar/atualizar `account_deletions`;
4. marcar `meals`, `posts` e `post_comments` com `deleted_at`, preservando o
   timestamp anterior quando já estavam deletados;
5. tornar perfil, likes, follows e contatos invisíveis sem destruir os dados;
6. revogar push tokens ou remover o registro do aparelho;
7. registrar auditoria;
8. confirmar a transação;
9. retornar sempre o mesmo estado em repetição idempotente.

Não limpar imediatamente nome, username, avatar ou telefone. Essa limpeza atual
é incompatível com reativação integral. Os campos permanecem protegidos por RLS
e pelo bloqueio de conta até cancelamento ou hard delete.

Para distinguir soft deletes anteriores da exclusão da conta, registrar as
linhas alteradas pelo ciclo, ou adicionar `account_deletion_id` aos registros
reversíveis. No cancelamento, restaurar somente linhas afetadas por aquele ciclo;
uma refeição que já estava apagada antes deve continuar apagada.

### 4.4 Invisibilidade pública durante retenção

Revisar todas as superfícies sociais:

- `public_profiles`;
- busca de usuários;
- feed;
- leaderboard;
- following/followers;
- contagem de likes e comentários;
- achievements publicados;
- reverse-match de contatos.

Todas devem excluir usuários com ciclo de exclusão aberto. Likes, follows e
contact links podem permanecer armazenados para reativação, mas não podem afetar
queries, contadores ou descoberta.

Preferir uma função/view única `active_profiles` ou predicado SQL reutilizável
para evitar regras divergentes.

### 4.5 Cancelar exclusão

`POST /account/deletion/cancel`:

1. exige JWT válido;
2. bloqueia o ciclo aberto;
3. rejeita conta já purgada;
4. marca `cancelled_at`;
5. restaura somente soft deletes vinculados ao ciclo;
6. libera novamente identidade, relações e descoberta;
7. registra auditoria;
8. responde de forma idempotente se já cancelado.

Push token não precisa ser recuperado: o app deve registrá-lo novamente após a
reativação.

### 4.6 Hard delete D+30

O worker:

1. seleciona lote com `FOR UPDATE SKIP LOCKED` ou RPC equivalente;
2. incrementa tentativa;
3. remove todos os objetos paginados de `meal-audios` e `post-images`;
4. chama `auth.admin.deleteUser`;
5. confia nas FKs `ON DELETE CASCADE/SET NULL`, previamente auditadas;
6. registra sucesso ou erro sanitizado;
7. permite repetição segura caso Storage já esteja vazio ou Auth já não exista.

Como `account_deletions` atualmente usa FK `ON DELETE CASCADE`, `purged_at` não
sobrevive ao delete de Auth. Decidir entre:

- manter apenas `account_audit_log` como prova mínima; ou
- mudar a FK do histórico para `ON DELETE SET NULL` com um identificador
  operacional não pessoal.

Preferência: manter o mínimo necessário em `account_audit_log`, sem preservar
UUID pessoal desnecessariamente.

## 5. Consentimento obrigatório

### 5.1 Onboarding

Garantir no servidor, não somente no mobile:

- `terms = true`;
- `privacy = true`;
- `ai_processing = true`;
- cada registro inclui `policy_version`;
- a criação do perfil e dos consentimentos ocorre na mesma transação;
- repetição do onboarding é idempotente.

### 5.2 Conta ativa

`POST /account/consent`:

- revogar `terms`, `privacy` ou `ai_processing` retorna `409`;
- `ai_processing` não é apresentado como consentimento gerenciável na UI e não
  possui operação de desativação no contrato do M10;
- revogar `marketing` funciona;
- conceder novamente `marketing` cria nova entrada no ledger;
- a leitura do estado escolhe deterministicamente o evento mais recente;
- não deixar múltiplos grants ativos ambíguos.

Usar o erro:

```json
{
  "error": "consent_required_for_service",
  "scope": "ai_processing"
}
```

### 5.3 Auditoria

O ledger deve ser append-only sempre que possível. Em vez de modificar todas as
linhas ativas no revoke, avaliar eventos explícitos de grant/revoke ou garantir
que apenas a concessão ativa mais recente seja revogada. Política e timestamp
devem ser preservados.

## 6. Exportação LGPD

### 6.1 Conteúdo

Manter ZIP JSON com:

- Auth mínimo;
- profiles e profiles_private;
- anthropometrics e nutrition_goals;
- subscriptions e consent_log;
- meals e meal_items;
- daily_summaries e streaks;
- ai_usage, ai_extraction_hits e ai_insights;
- user_achievements;
- follows dos dois lados;
- contact_links do usuário;
- posts, likes e comentários do usuário;
- notifications e push_tokens;
- account deletion/audit sanitizado;
- manifesto de `meal-audios` e `post-images`.

Revisar toda migration criada depois da lista original. Qualquer tabela com dado
pessoal ou vínculo por `user_id` deve estar incluída ou ter exclusão documentada.

### 6.2 Segurança e robustez

- checar erro de `auth.admin.getUserById`;
- não registrar conteúdo do ZIP;
- definir limite de volume e estratégia futura assíncrona;
- paginar tabelas/Storage quando necessário;
- escapar nomes e garantir arquivos determinísticos;
- impedir cache HTTP;
- usar `Content-Disposition` seguro;
- permitir export durante exclusão pendente.

## 7. Métricas diárias

### 7.1 Persistência de eventos

Criar uma tabela operacional de eventos/etapas, com retenção definida, contendo:

- `occurred_at`;
- `request_id`;
- `meal_id` quando existir;
- `source`: `text`, `audio`, `photo`, `barcode`, futuramente `whatsapp`;
- `stage`: `transcription`, `extraction`, `catalog`, `persistence`, `total`;
- `provider`;
- `model`;
- `duration_ms`;
- `success`;
- `cache_hit`;
- `confidence`;
- tokens e custo;
- código de erro sanitizado.

Não persistir texto bruto, email, telefone, URL assinada ou payload do modelo.
Se `request_id` e `meal_id` não forem necessários após agregação, aplicar
retenção curta.

### 7.2 `metrics_daily`

Schema recomendado:

```text
day date
metric text
source text nullable
stage text nullable
provider text nullable
model text nullable
value numeric
sample_count bigint
computed_at timestamptz
```

Chave única nas dimensões normalizadas. Evitar `NULL` em chave de conflito usando
valores sentinela ou `NULLS NOT DISTINCT`, conforme suporte do Postgres local.

Métricas:

- `requests_total`;
- `success_rate`;
- `low_confidence_rate`;
- `cache_hit_rate`;
- `latency_p50_ms`;
- `latency_p95_ms`;
- `input_tokens`;
- `output_tokens`;
- `cost_cents`;
- `transcription_seconds`.

### 7.3 Worker

Criar `metrics-daily` agendado depois dos workers de retenção, calculando o dia
UTC anterior. Reprocessamento recebe `day` opcional e faz upsert completo,
permitindo backfill e correção.

Validar:

- bordas exatamente `00:00:00Z`;
- amostra vazia;
- um único valor;
- percentis com várias amostras;
- separação provider/model/source;
- recomputação idempotente;
- soma reconciliada com `ai_usage`, `ai_extractions` e transcriptions.

## 8. Observabilidade

### 8.1 Sentry

- criar escopo por request;
- setar `user.id` somente após autenticação;
- limpar escopo ao terminar;
- adicionar `request_id`, rota, source e stage como tags/contexto;
- breadcrumbs antes/depois das etapas;
- capturar exceções de rotas e workers;
- aplicar `beforeSend` para remover headers, JWT, cookies, email, telefone,
  texto bruto e payloads.

### 8.2 Pino

Adotar campos:

```text
request_id, user_id, meal_id, source, stage, provider, model,
duration_ms, cache_hit, success, error_code
```

`wa_message_id` deixa de ser obrigatório enquanto M4 estiver pausado.

Não logar:

- bearer token;
- email/telefone;
- texto ou áudio transcrito;
- prompts/respostas;
- buffers ZIP;
- URLs assinadas;
- secrets de provider.

### 8.3 Falhas de workers

Cada worker deve:

- logar início/fim, duração, processados, falhas e pendentes;
- emitir exceção Sentry sanitizada quando configurado;
- continuar no-op sem DSN em ambiente local;
- não derrubar o servidor HTTP por falha de agendamento.

## 9. Runbook

Consolidar ou indexar os runbooks cobrindo:

1. export falhou;
2. exclusão ficou em estado parcial;
3. reativação falhou;
4. purge D+30 falhou;
5. áudio não foi removido;
6. cota global/por usuário de IA;
7. divergência entre `ai_usage` e `metrics_daily`;
8. Sentry sem `user_id`/`request_id`;
9. suspeita de vazamento em logs;
10. erro de RLS;
11. recuperação possível e impossível de áudio;
12. execução manual e idempotente de cada worker.

Webhook WA deve aparecer apenas como “deferido para M4”.

## 10. Estratégia de testes temporários

### 10.1 Regra

Os testes específicos desta auditoria serão gerados em diretório retornado por
`mktemp -d` dentro de `/tmp`. Nenhum framework ou arquivo de teste será
adicionado ao `package.json` ou commitado.

Podem ser usados:

- shell + `curl`/Node para HTTP e ZIP;
- `psql` para asserts SQL;
- Fastify via processo local real;
- Supabase local;
- service role somente do ambiente local;
- usuários e objetos descartáveis.

Ao final:

1. salvar somente um relatório Markdown com cenários e resultados, se desejado;
2. remover o diretório temporário;
3. confirmar `git status` sem artefatos de teste;
4. nunca executar testes destrutivos contra URL que não seja local.

### 10.2 Preflight de segurança

Antes de qualquer teste destrutivo:

- confirmar hostname local de Supabase/Postgres;
- rejeitar execução se URL contiver domínio remoto;
- criar IDs com prefixo/metadata de teste;
- registrar os UUIDs descartáveis;
- não reutilizar conta de desenvolvimento;
- conferir worktree e preservar alterações existentes do usuário.

### 10.3 Matriz A — migrations e schema

1. reset completo do Supabase local;
2. todas as migrations aplicam sem erro;
3. constraints, índices e RLS esperados existem;
4. auditoria de todas as FKs ligadas a Auth;
5. nenhuma FK impede hard delete;
6. índices dos workers suportam queries de vencimento;
7. schema gerado/types compilam.

### 10.4 Matriz B — onboarding e consentimento

Casos:

- nenhum consentimento → rejeita;
- cada obrigatório ausente isoladamente → rejeita;
- três obrigatórios presentes → conclui;
- marketing ausente → conclui;
- revogar marketing → sucesso;
- revogar marketing novamente → idempotência definida;
- conceder marketing novamente → sucesso;
- revogar terms/privacy/ai_processing → `409`;
- policy version ausente/inválida → comportamento contratado;
- usuário A não lê/altera consentimento de B.

### 10.5 Matriz C — export

Criar usuários A e B com dados em todas as tabelas e Storage.

Asserts:

- status e headers;
- ZIP íntegro;
- lista exata de arquivos;
- JSON válido;
- registros de A presentes;
- registros exclusivos de B ausentes;
- follows envolvendo A presentes;
- follows apenas entre terceiros ausentes;
- contact links corretos;
- M7/M8 incluídos;
- manifesto contém apenas metadados;
- nenhum binário no ZIP;
- audit log sanitizado;
- export funciona com exclusão pendente;
- request inválida/não autenticada falha;
- duas exportações concorrentes não misturam usuários.

### 10.6 Matriz D — exclusão e reativação

Preparar conta com perfil, telefone, meals, posts, comments, likes, follows,
contacts, achievements, notifications, push e Storage.

Após solicitar:

- retorna datas corretas;
- repetir retorna mesmo ciclo;
- rotas normais retornam `account_deletion_pending`;
- estado e cancelamento continuam acessíveis;
- export continua acessível;
- conta some de busca/feed/ranking/follows/contadores;
- dados retidos continuam no banco sob service role;
- token de login por senha/OAuth pode autenticar;
- push deixa de ser utilizável.

Após cancelar:

- conta volta a acessar rotas;
- identidade e relações reaparecem;
- refeições/posts/comments anteriores voltam;
- itens apagados antes do pedido continuam apagados;
- repetir cancelamento é seguro;
- worker não purga ciclo cancelado.

### 10.7 Matriz E — hard delete D+30

- conta com 29d23h59m não é removida;
- conta exatamente vencida é elegível;
- conta cancelada não é removida;
- conta vencida é removida do Auth;
- cascatas removem todas as tabelas pessoais;
- audit mínimo não contém UUID pessoal quando não necessário;
- todos os objetos paginados de ambos os buckets são removidos;
- mais de 1.000 objetos são tratados;
- Storage vazio é sucesso;
- Auth já ausente é tratado de forma idempotente;
- falha de Storage impede conclusão e permite retry;
- falha do Auth registra tentativa e permite retry;
- dois workers concorrentes não processam a mesma conta.

### 10.8 Matriz F — purge de áudios

- áudio com menos de 30 dias permanece;
- exatamente 30 dias segue a regra de corte documentada;
- mais antigo é removido;
- `audio_deleted_at` é preenchido somente após remoção;
- objeto ausente é tratado de forma idempotente;
- falha no Storage não marca como removido;
- lote acima de 500 converge em execuções seguintes;
- áudio de refeição já soft-deletada segue a mesma retenção;
- paths de outro usuário nunca são removidos por engano.

### 10.9 Matriz G — métricas

Popular eventos sintéticos com valores conhecidos:

- dias em ambos os lados da meia-noite UTC;
- providers/modelos diferentes;
- sources diferentes;
- sucesso/falha;
- confiança acima/abaixo de `0.6`;
- cache hit/miss;
- latências conhecidas;
- tokens/custos conhecidos.

Asserts:

- p50/p95 exatos;
- taxas corretas;
- custo por modelo correto;
- total reconciliado;
- dia UTC correto;
- execução repetida não duplica;
- backfill substitui valores;
- nenhuma dimensão pessoal;
- dados do dia atual incompleto não entram no fechamento anterior.

### 10.10 Matriz H — observabilidade

Com transportes locais/mocks temporários:

- requests concorrentes não trocam `user_id`;
- erro de cada estágio possui request e stage;
- breadcrumbs respeitam ordem;
- logs são JSON parseável;
- campos obrigatórios aparecem;
- redaction remove Authorization, email, telefone e texto;
- worker registra resumo;
- ausência de DSN não quebra boot;
- falha do Sentry não altera resposta funcional.

### 10.11 Regressão

- typecheck de todos os workspaces;
- lint;
- checks SQL existentes;
- smoke de onboarding;
- criação por texto, áudio, foto e barcode;
- feed, busca, following e leaderboard com contas ativas;
- server boot com workers;
- server boot sem Sentry configurado.

## 11. Ordem de implementação

### Bloco 1 — Corrigir modelo LGPD

1. migration de ciclo reversível;
2. separar autenticação de conta ativa;
3. tornar exclusão transacional/idempotente;
4. adicionar estado e cancelamento;
5. corrigir invisibilidade social;
6. ajustar export para conta pendente;
7. atualizar contratos compartilhados e documentação.

**Gate:** matrizes A–E passam.

### Bloco 2 — Consentimento obrigatório

1. endurecer transação do onboarding;
2. bloquear revoke dos três obrigatórios;
3. tornar ledger determinístico;
4. atualizar contrato M10.

**Gate:** matriz B passa.

### Bloco 3 — Retenção

1. tornar purge de conta paginado, concorrente e recuperável;
2. tornar purge de áudio idempotente;
3. revisar cascatas;
4. registrar falhas operacionais.

**Gate:** matrizes E–F passam.

### Bloco 4 — Métricas

1. migration de eventos operacionais;
2. instrumentar pipeline;
3. migration `metrics_daily`;
4. worker UTC e backfill;
5. reconciliação de custo.

**Gate:** matriz G passa.

### Bloco 5 — Observabilidade

1. escopo Sentry por request;
2. breadcrumbs;
3. logs Pino padronizados;
4. redaction;
5. captura dos workers.

**Gate:** matriz H passa.

### Bloco 6 — Encerramento

1. executar regressão completa;
2. expandir runbook;
3. registrar relatório dos testes temporários;
4. remover artefatos temporários;
5. atualizar PLAN/Trello;
6. declarar M6 técnico concluído;
7. iniciar M10.

## 12. Atualização proposta do checklist M6

Permanecem no M6:

- export;
- exclusão reversível + hard delete D+30;
- consentimentos;
- purge accounts;
- purge audios;
- metrics_daily;
- instrumentação e cron de métricas;
- Sentry;
- Pino;
- runbook.

Movidos para M10:

- Perfil;
- Settings;
- UI de consentimento/export/delete/reativação;
- Sobre;
- links e navegação interna.

Removido do M6 e devolvido ao M4:

- alerta de `wa_messages` preso.

Deferidos para etapa de produção/deploy:

- Supabase PROD;
- Fly.io;
- Sentry e webhook externos;
- TestFlight;
- Play Internal;
- Meta WABA;
- Termos/Privacidade publicados;
- PITR.

## 13. Gate de entrada do M10

M10 pode começar quando:

- blocos 1–6 estiverem concluídos;
- contratos de profile/settings/consent/export/delete/deletion/cancel estiverem
  congelados;
- relatório local comprovar todas as matrizes;
- não houver artefatos temporários;
- itens externos estiverem marcados como deferidos, sem serem confundidos com
  falha do M6 técnico.

O M10 então implementará a experiência de login de conta pendente:

```text
login senha/OAuth
  → backend informa account_deletion_pending
  → app pergunta “Deseja reativar?”
  → confirmar chama POST /account/deletion/cancel
  → perfil e sessão normal são restaurados
```

Na tela de consentimentos do M10, `ai_processing` pode aparecer apenas como
informação obrigatória já aceita, nunca como toggle. Somente consentimentos
opcionais, como `marketing`, podem ser alterados.
