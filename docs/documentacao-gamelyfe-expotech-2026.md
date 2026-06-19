# Documentação Acadêmica — Fitbrother

## Dados da entrega

**Aluno:** preencher  
**Curso:** preencher  
**Disciplina:** preencher  
**Professor(a):** preencher  
**Instituição:** preencher  
**Data:** preencher  

## 1. Identificação do projeto

**Nome:** Fitbrother  
**Tipo:** Aplicativo mobile com backend próprio  
**Área:** Saúde, nutrição, inteligência artificial e gamificação  
**Tecnologias principais:** React Native, Expo, TypeScript, Node.js, Fastify, Supabase, PostgreSQL, Gemini, OpenAI Whisper  

O Fitbrother é um aplicativo de acompanhamento nutricional que permite ao usuário registrar refeições por texto ou áudio em linguagem natural. A partir desse registro, o sistema utiliza inteligência artificial para identificar alimentos, estimar calorias e macronutrientes e atualizar o progresso diário do usuário.

Além do registro alimentar, o projeto inclui recursos de engajamento, como streaks, conquistas, ranking semanal e conexão com contatos. O objetivo é reduzir a fricção comum em aplicativos de dieta, nos quais o usuário precisa pesquisar alimentos manualmente e preencher muitos campos.

## 2. Problema

Muitos aplicativos de controle alimentar exigem que o usuário pesquise alimentos em catálogos extensos, informe porções manualmente e registre cada refeição em várias etapas. Esse processo é demorado e aumenta a chance de abandono.

O problema central tratado pelo Fitbrother é:

> Como facilitar o registro nutricional diário usando linguagem natural, áudio e recursos de motivação para tornar o acompanhamento alimentar mais simples e recorrente?

## 3. Objetivos

### 3.1 Objetivo geral

Desenvolver um aplicativo mobile capaz de registrar refeições de forma simples, usando texto ou áudio, processar essas informações com inteligência artificial e apresentar ao usuário seu progresso nutricional diário.

### 3.2 Objetivos específicos

- Permitir cadastro, autenticação e onboarding do usuário.
- Coletar dados básicos para cálculo de metas nutricionais, como peso, altura, objetivo e nível de atividade.
- Registrar refeições por texto em linguagem natural.
- Registrar refeições por áudio com transcrição automática.
- Identificar alimentos e estimar calorias, proteínas, carboidratos e gorduras.
- Exibir resumo diário de calorias e macronutrientes.
- Permitir edição, confirmação e exclusão de refeições.
- Manter histórico de dias anteriores.
- Implementar gamificação com streaks, conquistas e ranking semanal.
- Sincronizar dados em tempo real usando Supabase Realtime.
- Aplicar boas práticas de segurança, autenticação e privacidade.

## 4. Público-alvo

O público-alvo são usuários que desejam acompanhar sua alimentação sem depender de cadastros manuais complexos. O aplicativo é especialmente útil para pessoas que:

- Buscam perder peso, manter peso, ganhar massa ou recompor o corpo.
- Têm dificuldade em registrar refeições em aplicativos tradicionais.
- Preferem falar ou escrever livremente o que comeram.
- Precisam de feedback rápido sobre calorias e macros.
- Sentem-se motivadas por metas, sequências de dias e ranking com amigos.

## 5. Escopo do sistema

### 5.1 Funcionalidades implementadas

- Aplicativo mobile em React Native com Expo Router.
- Autenticação via Supabase Auth.
- Onboarding com coleta de perfil e metas.
- Cálculo de metas nutricionais iniciais.
- Registro de refeições por texto.
- Registro de refeições por áudio.
- Transcrição de áudio usando OpenAI Whisper.
- Extração nutricional usando Gemini.
- Catálogo de alimentos com base TACO.
- Resumo diário com calorias e macronutrientes.
- Atualização em tempo real de refeições e resumo diário.
- Edição e exclusão de refeições.
- Histórico semanal e visualização de dias anteriores.
- Streaks de metas atingidas.
- Conquistas desbloqueáveis.
- Notificações push.
- Conexão social por contatos do telefone.
- Ranking semanal da rede do usuário.
- Backend em Node.js com Fastify.
- Banco PostgreSQL gerenciado via Supabase.
- Row Level Security no banco.
- Observabilidade com Sentry e logs estruturados.

### 5.2 Funcionalidades planejadas ou pausadas

- Integração completa com WhatsApp Cloud API.
- Exportação e exclusão de conta por LGPD.
- Builds finais de produção para lojas.

A integração com WhatsApp foi pausada porque a verificação empresarial da Meta foi recusada em maio de 2026. O projeto foi reorganizado para continuar com app mobile, IA, gamificação e social por contatos enquanto a dependência externa é resolvida.

## 6. Requisitos funcionais

| Código | Requisito |
|---|---|
| RF01 | O usuário deve conseguir criar uma conta e autenticar-se. |
| RF02 | O usuário deve preencher um onboarding com dados pessoais e nutricionais. |
| RF03 | O sistema deve calcular metas diárias de calorias e macronutrientes. |
| RF04 | O usuário deve registrar uma refeição por texto. |
| RF05 | O usuário deve registrar uma refeição por áudio. |
| RF06 | O sistema deve transcrever áudio para texto. |
| RF07 | O sistema deve interpretar a refeição usando IA. |
| RF08 | O sistema deve persistir refeições e itens de refeição no banco. |
| RF09 | O usuário deve visualizar o resumo nutricional do dia. |
| RF10 | O usuário deve editar ou excluir refeições. |
| RF11 | O sistema deve recalcular o resumo diário após alterações. |
| RF12 | O usuário deve consultar histórico de dias anteriores. |
| RF13 | O sistema deve calcular streaks de metas atingidas. |
| RF14 | O sistema deve liberar conquistas conforme critérios definidos. |
| RF15 | O usuário deve conectar contatos e visualizar ranking semanal. |
| RF16 | O sistema deve enviar notificações push quando aplicável. |

## 7. Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | O sistema deve usar TypeScript para reduzir erros de tipagem. |
| RNF02 | O backend deve validar entradas com schemas compartilhados. |
| RNF03 | O banco deve proteger dados por usuário com Row Level Security. |
| RNF04 | As APIs devem exigir autenticação nas rotas privadas. |
| RNF05 | O sistema deve aplicar limite de uso de IA por usuário/dia. |
| RNF06 | O aplicativo deve funcionar em ambiente mobile com Expo. |
| RNF07 | O sistema deve registrar logs e erros para observabilidade. |
| RNF08 | O código deve ser organizado em monorepo para separar mobile, backend e pacotes compartilhados. |
| RNF09 | O processamento de IA deve usar cache para evitar chamadas repetidas. |
| RNF10 | O sistema deve considerar privacidade e minimização de dados pessoais. |

## 8. Arquitetura

O projeto usa uma arquitetura em monorepo, separando cliente mobile, servidor, pacotes compartilhados e banco de dados.

```text
fitbrother/
├── apps/
│   ├── mobile/        Aplicativo React Native com Expo
│   └── server/        API Fastify, serviços e workers
├── packages/
│   ├── shared/        Schemas Zod e tipos compartilhados
│   └── db-types/      Tipos gerados a partir do PostgreSQL
├── supabase/
│   ├── migrations/    Estrutura versionada do banco
│   └── seed/          Scripts de carga de dados
└── docs/              Documentação e planejamento
```

### 8.1 Fluxo principal de registro por texto

```text
Usuário digita refeição
        ↓
App mobile envia POST /meals/text
        ↓
Backend valida payload e autenticação
        ↓
Serviço de IA extrai alimentos e macros
        ↓
Catálogo de alimentos melhora estimativas
        ↓
Banco salva meal e meal_items
        ↓
Triggers recalculam resumo diário
        ↓
App recebe atualização em tempo real
```

### 8.2 Fluxo principal de registro por áudio

```text
Usuário grava áudio
        ↓
App envia áudio para Supabase Storage
        ↓
Backend recebe caminho do arquivo
        ↓
OpenAI Whisper transcreve o áudio
        ↓
Gemini interpreta a refeição
        ↓
Banco salva refeição e itens
        ↓
Resumo diário é recalculado
        ↓
Interface mobile é atualizada
```

## 9. Tecnologias utilizadas

| Camada | Tecnologia | Uso no projeto |
|---|---|---|
| Mobile | React Native | Desenvolvimento do aplicativo |
| Mobile | Expo | Execução, build e APIs nativas |
| Navegação | Expo Router | Rotas e telas do app |
| Linguagem | TypeScript | Tipagem no app, servidor e pacotes |
| Estilo | NativeWind | Estilização com classes utilitárias |
| Backend | Node.js | Ambiente de execução do servidor |
| Backend | Fastify | Criação da API HTTP |
| Banco | PostgreSQL | Persistência relacional |
| Plataforma | Supabase | Auth, banco, storage e realtime |
| IA texto | Gemini | Extração de alimentos e macros |
| IA áudio | OpenAI Whisper | Transcrição de áudio |
| Validação | Zod | Schemas compartilhados entre camadas |
| Jobs | pg-boss | Workers e tarefas agendadas |
| Push | Expo Notifications | Notificações mobile |
| Observabilidade | Sentry | Monitoramento de erros |

## 10. Banco de dados

O banco é versionado por migrations SQL em `supabase/migrations`. As principais entidades são:

| Tabela | Finalidade |
|---|---|
| `profiles` | Perfil do usuário, telefone, fuso horário e preferências |
| `anthropometrics` | Histórico de peso, altura, BMR e TDEE |
| `nutrition_goals` | Metas diárias versionadas |
| `foods` | Catálogo canônico de alimentos |
| `meals` | Refeições registradas pelo usuário |
| `meal_items` | Alimentos dentro de cada refeição |
| `daily_summaries` | Resumo nutricional diário |
| `streaks` | Sequências de dias com meta atingida |
| `achievements` | Conquistas disponíveis |
| `user_achievements` | Conquistas liberadas por usuário |
| `push_tokens` | Tokens de notificação do dispositivo |
| `notifications` | Histórico/outbox de notificações |
| `follows` | Relações sociais de seguir usuários |
| `contact_links` | Contatos processados por hash |
| `ai_usage` | Controle diário de uso de IA |
| `transcriptions` | Cache de transcrições de áudio |
| `ai_extractions` | Cache de extrações feitas por IA |

### 10.1 Modelo lógico simplificado

```text
auth.users
   ├── profiles
   ├── anthropometrics
   ├── nutrition_goals
   ├── meals
   │     └── meal_items
   ├── daily_summaries
   ├── streaks
   ├── user_achievements
   ├── follows
   ├── contact_links
   ├── push_tokens
   ├── notifications
   ├── ai_usage
   ├── transcriptions
   └── ai_extractions
```

## 11. Segurança e privacidade

O projeto adota algumas medidas importantes:

- Autenticação centralizada via Supabase Auth.
- Rotas privadas protegidas por JWT.
- Row Level Security nas tabelas sensíveis.
- Separação entre cliente autenticado e service role no backend.
- Validação de payloads com Zod antes do processamento.
- Limite diário de uso de IA para reduzir abuso e custo.
- Cache de IA para evitar reprocessamento desnecessário.
- Contatos trafegam como hashes SHA-256, sem envio de números em claro para a API de sincronização.
- Dados nutricionais de terceiros não são expostos no ranking social; o ranking usa apenas dados agregados.

## 12. Principais telas do aplicativo

| Tela | Descrição |
|---|---|
| Welcome | Entrada do app e direcionamento para login/cadastro |
| Sign in / Sign up | Autenticação por email e senha |
| Onboarding | Coleta de dados físicos, objetivo e preferências |
| Home | Resumo diário e lista de refeições |
| Composer | Campo fixo para registrar refeição por texto ou áudio |
| Detalhe da refeição | Visualização e edição de uma refeição |
| Histórico | Lista de dias anteriores e seus resumos |
| Amigos | Verificação de telefone, contatos e ranking semanal |
| Conquistas | Lista de conquistas do usuário |
| Perfil | Dados do usuário e atalhos de configuração |

## 13. APIs principais

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Verifica se o backend está online |
| `POST` | `/onboarding/complete` | Finaliza onboarding e cria dados iniciais |
| `GET` | `/me` | Retorna perfil, meta e antropometria |
| `GET` | `/me/daily-summary` | Retorna resumo nutricional do dia |
| `GET` | `/me/daily-summaries` | Retorna resumos em intervalo de datas |
| `GET` | `/me/streak` | Retorna streak atual e risco de quebra |
| `POST` | `/me/verify-phone` | Confirma telefone via Supabase Auth |
| `POST` | `/meals/text` | Cria refeição a partir de texto |
| `POST` | `/meals/audio` | Cria refeição a partir de áudio |
| `GET` | `/meals` | Lista refeições por dia |
| `GET` | `/meals/:id` | Detalha uma refeição |
| `PATCH` | `/meals/:id` | Edita refeição |
| `POST` | `/meals/:id/confirm` | Confirma refeição que exigia revisão |
| `DELETE` | `/meals/:id` | Remove refeição por soft delete |
| `GET` | `/achievements` | Lista conquistas disponíveis |
| `GET` | `/me/achievements` | Lista conquistas do usuário |
| `POST` | `/push-tokens` | Registra token de push |
| `POST` | `/contacts/sync` | Sincroniza contatos por hash |
| `GET` | `/following` | Lista usuários seguidos |
| `GET` | `/leaderboard/weekly` | Retorna ranking semanal |

## 14. Como executar o projeto

### 14.1 Pré-requisitos

- Node.js 20 ou superior.
- Docker instalado e em execução.
- Conta no Supabase.
- Chaves de API para Gemini e OpenAI.
- Expo Go ou dev build para testar o app mobile.

### 14.2 Instalação

```bash
npm install
```

### 14.3 Variáveis de ambiente

O projeto possui exemplos de configuração em:

- `.env.example`
- `apps/mobile/.env.example`
- `apps/server/.env.example`

As chaves reais não devem ser commitadas no repositório.

### 14.4 Banco local

```bash
npm run db:start
npm run db:reset
```

### 14.5 Backend

```bash
npm run dev:server
```

Por padrão, o servidor Fastify roda na porta configurada no `.env`, normalmente `3000`.

### 14.6 Aplicativo mobile

```bash
npm run dev:mobile
```

Esse comando inicia o Expo Metro Bundler para abrir o aplicativo em emulador, dispositivo físico ou Expo Go, conforme a configuração do projeto.

## 15. Qualidade e verificação

O projeto inclui scripts para verificação:

```bash
npm run typecheck
npm run lint
```

Esses comandos verificam tipos TypeScript e regras de lint nos workspaces.

Também existem validações complementares por SQL e workers descritas no plano de desenvolvimento, especialmente para streaks, ranking, triggers de resumo diário e notificações.

## 16. Status atual

| Módulo | Status |
|---|---|
| Fundação do monorepo | Implementado |
| App mobile Expo | Implementado |
| Backend Fastify | Implementado |
| Supabase local e migrations | Implementado |
| Auth e onboarding | Implementado |
| Registro por texto | Implementado |
| Registro por áudio | Implementado |
| Transcrição com Whisper | Implementado |
| Extração nutricional com Gemini | Implementado |
| Dashboard diário em tempo real | Implementado |
| Histórico e edição | Implementado |
| Streaks | Implementado |
| Conquistas e push | Implementado |
| Social por contatos e ranking | Implementado |
| WhatsApp Cloud API | Pausado por dependência externa |
| LGPD export/delete | Planejado |
| Produção em lojas | Planejado |

## 17. Limitações conhecidas

- As estimativas nutricionais dependem da qualidade da entrada do usuário e da interpretação da IA.
- O cálculo de macros pode exigir revisão manual em casos ambíguos.
- Notificações push e contatos precisam de dispositivo real para testes completos.
- A integração com WhatsApp depende de aprovação da Meta.
- As rotinas finais de exportação e exclusão de conta ainda fazem parte do escopo planejado.

## 18. Considerações finais

O Fitbrother demonstra a aplicação prática de tecnologias modernas em um problema real de usabilidade: o registro alimentar. A solução combina aplicativo mobile, backend, banco relacional, inteligência artificial, atualização em tempo real e gamificação.

Do ponto de vista acadêmico, o projeto explora conceitos importantes de engenharia de software, como arquitetura em camadas, validação de dados, autenticação, segurança no banco, integração com APIs externas, processamento assíncrono e experiência do usuário.

O resultado é um sistema funcional e extensível, com base técnica suficiente para evoluir para uma versão de produção após a conclusão dos módulos pendentes de LGPD, WhatsApp e publicação.
