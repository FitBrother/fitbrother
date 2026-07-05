# Guia de CNPJ — abrindo a empresa do Fitbrother

> Pesquisa de referência (2025–2026) para os 4 sócios. **Não é aconselhamento jurídico/contábil** — valide os números e o enquadramento com um contador e um advogado de startup antes de agir. Custos e alíquotas mudam; confirme na hora. Perfil considerado: 4 jovens sócios, pouco dinheiro, startup de app de nutrição com IA.

## TL;DR — recomendação para o perfil

1. **Não abra o CNPJ antes de precisar.** Desenvolva e teste com conta de desenvolvedor pessoa física (Google US$ 25 único; Apple US$ 99/ano). Abra a empresa quando monetização ou captação estiver a semanas de distância.
2. **Abra uma LTDA** (MEI e SLU não servem para 4 sócios), com capital social simbólico e quotas proporcionais.
3. **Opte pelo Simples Nacional** e estruture o pró-labore para manter o **Fator R ≥ 28%** e pagar **6% (Anexo III)** em vez de 15,5% (Anexo V).
4. **CNAE primário 6203-1/00** (SaaS/app), secundário 6201-5/01.
5. **Use contabilidade online** (Contabilizei ~R$ 195 ou Agilize ~R$ 249/mês) — muitas abrem o CNPJ de graça.
6. **Invista em advogado só no essencial**: um **acordo de sócios com vesting (4 anos / cliff 1 ano)** e cláusulas good/bad leaver, tag/drag-along e valuation. É o gasto que mais protege capital.
7. **Endereço**: residencial (grátis) ou escritório virtual (~R$ 90/mês).
8. **Orce ~R$ 550-700/mês de custo fixo** mínimo de manutenção + custo de abertura único de R$ 500-3.000, e reavalie o regime tributário todo ano.

---

## 1. Quando abrir o CNPJ — já ou esperar receita?

**Regra prática:** formalize quando sair da ideação e entrar em **validação/comercialização**. A lei só permite "atos de comércio" (vender produto/serviço, emitir nota, receber de gateway) com CNPJ. Enquanto você só desenvolve, testa e não fatura, **não é obrigatório** ter empresa aberta ([Sebrae PR](https://sebraepr.com.br/comunidade/artigo/vou-empreender-e-agora-preciso-de-cnpj); [SLAP.law](https://slap.law/formalizar-cnpj-startup/); [Sebrae Startups SC](https://www.startupsc.com.br/quando-e-a-hora-de-formalizar-minha-startup-com-um-cnpj/)).

**Dá para lançar o app antes do CNPJ?** Sim, com ressalvas por loja:
- **Google Play**: conta **Individual** (pessoa física) custa **US$ 25, pagamento único** e sem renovação. Para monetizar como empresa depois, migra-se para conta **Organização** (exige CNPJ) ([Fabapp – Google Individual](https://ajuda.fabapp.com/pt-br/article/como-criar-conta-google-developer-individual-1cspgn5/)).
- **Apple**: conta **Individual** custa **US$ 99/ano**. A conta de **Organização** exige CNPJ + **número D-U-N-S** (identificador internacional emitido pela Dun & Bradstreet) + e-mail e site corporativos ([Fabapp – Apple Individual](https://ajuda.fabapp.com/pt-br/article/conta-desenvolvedor-individual-apple-av8nx8/); [Fabapp – Apple Empresarial](https://ajuda.fabapp.com/pt-br/article/conta-desenvolvedor-empresarial-apple-3c26bc/)).

**Atenção:** você pode publicar e testar (TestFlight, beta) com conta pessoa física, mas **assim que houver receita** (assinatura, in-app purchase, recebimento de gateway/investidor) o CNPJ passa a ser obrigatório — e receber de investidor/anjo praticamente sempre exige empresa constituída.

**Trade-off central:** manter a empresa aberta custa **fixo mensal** (contador + pró-labore/INSS + DAS mínimo → ~**R$ 550-700/mês** mínimo mesmo faturando zero, ver seção 5), então abrir cedo demais queima caixa. Abrir tarde demais impede receber legalmente. O ponto ótimo é **quando a monetização/captação está iminente** (semanas, não meses).

## 2. Tipo societário para 4 sócios

**Recomendado: Sociedade Limitada (LTDA).** Formato mais usado por startups em estágio inicial pela simplicidade de abertura, flexibilidade do contrato social e tributação menos complexa ([StartLaw](https://thestartlaw.com/tipos-societarios-e-regimes-tributarios-para-startups/); [EJUDI](https://ejudi.com.br/startup-tipo-societario/)).

- **MEI não serve:** não admite sócios — é titular único.
- **SLU não serve:** a Sociedade Limitada Unipessoal também é de **um único sócio** ([Cora](https://www.cora.com.br/blog/sociedade-limitada-com-um-socio/); [Barbieri Advogados](https://barbieriadvogados.com/en/sociedade-limitada-unipessoal-slu-guia-completo-para-empreendedores-em-2025/)).
- **Capital social:** **não há mínimo legal** para LTDA; comum registrar valores simbólicos, mas o ideal reflete o aporte real ([Asaas](https://blog.asaas.com/capital-social-para-abrir-empresa/); [Cora](https://www.cora.com.br/blog/capital-social-minimo-para-abrir-uma-sociedade-limitada/)).
- **Quotas:** proporcionais ao aporte, no contrato social. Cuidado com dividir 25/25/25/25 sem vesting (ver seção 7).

## 3. Regime tributário

**Recomendado para começar: Simples Nacional.** Guia única, menos burocracia, limite de **R$ 4,8 mi/ano** ([Contabilidade.com](https://contabilidade.com/blog/simples-nacional-2026-guia-completo-de-anexos-fator-r-limites-e-das/)).

**Anexo III vs V e o Fator R** (crítico para software):
- Desenvolvimento de software cai por natureza no **Anexo V** (alíquota inicial **15,5%**).
- Se o **Fator R ≥ 28%**, migra para o **Anexo III** (alíquota inicial **6%**) ([e-Auditoria](https://www.e-auditoria.com.br/blog/anexo-iii-ou-anexo-v-simples-nacional/); [Wetax](https://wetax.com.br/anexo-3-simples-nacional-2025-2026)).
- **Fator R** = folha 12 meses ÷ receita bruta 12 meses. A folha inclui salários, 13º, **pró-labore dos sócios**, INSS patronal e FGTS ([Contabilidade.com – Fator R](https://contabilidade.com/blog/fator-r-no-simples-nacional-2026-como-calcular-exemplos-praticos-e-quando-servicos-migram-do-anexo-v-para-o-iii/)).

**Implicação:** com receita baixa no início, um pró-labore modesto já pode empurrar o Fator R acima de 28% e garantir os **6%**. Planeje com o contador desde o mês 1.

**Simples vs Lucro Presumido:** Simples é melhor para **começar** (simplicidade + 6% com Fator R); Lucro Presumido (presunção 32% para serviços) só compensa quando faturamento/margens crescem. **Reavalie anualmente** ([Wetax](https://wetax.com.br/simples-nacional-vs-lucro-presumido-desenvolvedor-pj); [Blog Conte](https://blog.sejaconte.com.br/post/simples-nacional-ou-lucro-presumido-para-empresas-de-tecnologia)).

## 4. CNAEs adequados

- **6201-5/01** — Desenvolvimento de software **sob encomenda**.
- **6202-3/00** — Desenvolvimento e licenciamento de software **customizável**.
- **6203-1/00** — Desenvolvimento e licenciamento de software **não-customizável** → CNAE típico de **SaaS/app padronizado por assinatura** (caso do Fitbrother).
- Complementares: **6209-1/00** (suporte/serviços TI), **6311-9/00** (tratamento de dados/hospedagem), **6319-4/00** (portais/conteúdo).

**Prática:** primário = atividade que mais fatura (**6203-1/00** para SaaS), secundários para cobrir consultoria/sob encomenda ([IBGE Concla](https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=6203100&view=subclasse); [Meu Contador Online](https://www.meucontadoronline.com.br/blog/cnae-desenvolvimento-software-programadores-startups/); [Contabilidade.com](https://contabilidade.com/blog/cnae-6203100-desenvolvimento-e-licenciamento-de-programas-de-computador-nao-customizaveis-simples-nacional-fator-r-e-abertura-de-empresa/)).

## 5. Custos reais de abertura e manutenção

**Abertura (uma vez):**
- Taxa da **Junta Comercial**: ~**R$ 100 a R$ 500** (varia por estado).
- Total com honorários: ~**R$ 500 a R$ 3.000** ([Cora](https://www.cora.com.br/blog/quanto-custa-abrir-cnpj-2025/); [Contabilizei](https://www.contabilizei.com.br/contabilidade-online/quanto-custa-abrir-empresa-no-brasil-descubra-tudo/)). Muitas contabilidades online **abrem grátis** se você assina a mensalidade. Certificado digital (e-CNPJ) geralmente incluso.

**Manutenção mensal (mesmo faturando pouco/zero):**
- **Contabilidade online:** a partir de ~**R$ 195/mês** (seção 6).
- **Pró-labore do sócio administrador:** sem mínimo legal, mas o correto é ≥ **1 salário mínimo (R$ 1.518 em 2025)**; INSS de 11% (~R$ 167/mês) ([Contabilizei – INSS](https://www.contabilizei.com.br/contabilidade-online/inss-pro-labore/); [ContaJá](https://contaja.com.br/blog/inss-pro-labore/)).
- **DAS:** incide sobre faturamento. Faturando zero, DAS de imposto = zero, mas INSS do pró-labore e as declarações continuam.

**Custo fixo mínimo mensal** (empresa aberta, faturando pouco, 1 pró-labore mínimo): **≈ R$ 550-700/mês** (contador ~R$ 195-260 + INSS ~R$ 167 + pró-labore ~R$ 1.518 se realmente pago). *(Composição de faixas das fontes; some com o contador conforme plano e política de pró-labore.)*

## 6. Contabilidade online vs contador tradicional

Para pouco dinheiro, **online é a escolha natural**: mais barata, padronizada, digital.
- **Contabilizei** — a partir de **R$ 195/mês** (Simples); R$ 239 (Lucro Presumido) ([fonte](https://www.contabilizei.com.br/quanto-custa-contabilizei/)).
- **Agilize** — ~**R$ 249-259/mês**; plano básico inclui CNPJ grátis + certificado ([fonte](https://agilize.com.br/quanto-custa-agilize/)).
- Faixa de mercado: **R$ 289 a R$ 629/mês** conforme porte ([fonte](https://negociocerto.org/quanto-custa-uma-contabilidade-online/)).

**Prós online:** preço, abertura grátis, plataforma. **Contras:** atendimento menos personalizado. Para cap table complexo (vesting, stock options), vale contratar **advogado especializado** pontualmente para contrato social + acordo de sócios, mantendo a contabilidade online no dia a dia. Contador tradicional faz sentido quando a estrutura fica complexa (Lucro Presumido/Real, folha grande).

## 7. Acordo de sócios / contrato social — CRÍTICO com 4 sócios

O item que mais evita a morte da empresa por conflito. Distinção ([StartLaw](https://thestartlaw.com/acordo-de-socios/); [Comece com o Direito](https://www.comececomopedireito.com.br/blog/acordo-de-socios/)):
- **Contrato social:** institucional/público (sócios, capital, quotas, administração) — registrado na Junta.
- **Acordo de sócios:** privado, regula **como os sócios se relacionam** (decisões, saída, impasse, entrada de investidor).

**Cláusulas essenciais** ([Economia SC](https://economiasc.com/2026/07/03/acordo-de-socios-o-documento-que-decide-se-sua-startup-sobrevive-a-um-conflito-entre-fundadores/); [Garrastazu Adv.](https://www.garrastazu.adv.br/acordo-de-socios-na-pratica-clausulas-essenciais-para-proteger-a-empresa-e-os-socios); [Jusbrasil – vesting](https://www.jusbrasil.com.br/artigos/contrato-de-vesting-para-startups-do-conceito-a-estrategia-juridica-guia-completo/1994854641)):
- **Vesting** — o mais importante para 4 fundadores. Padrão: **4 anos com cliff de 1 ano**. Quem sai antes do cliff não leva quotas. Evita o clássico "sócio sai no mês 3 e continua com 25%".
- **Good leaver / bad leaver** — saída legítima recebe valor justo; saída por violação recebe valor reduzido/perde não-vestido.
- **Direito de preferência, tag-along e drag-along** — proteção de minoritários e viabilização de exit.
- **Cláusula shotgun** — desempate para comprar/vender participação (deadlock).
- **Dedicação exclusiva e não-competição**.
- **Metodologia de valuation pré-definida** — decidir *antes* como se calcula o valor de quem sai.

**Boas práticas:** ter o acordo **antes** de qualquer captação (due diligence vai exigir); não usar contrato genérico da internet; advogado especializado em startups.

## 8. Erros comuns e como evitar

([O Imparcial](https://oimparcial.com.br/negocios/2025/08/erros-comuns-ao-abrir-cnpj-o-que-evitar-para-nao-prejudicar-seu-negocio/); [Sebrae](https://sebrae.com.br/sites/PortalSebrae/artigos/saiba-quais-os-perfis-e-condicoes-para-abrir-e-formalizar-sua-empresa,61750680787ed710VgnVCM100000d701210aRCRD); [Serasa](https://www.serasaexperian.com.br/blog-pme/abrir-uma-empresa-com-socio/)):
1. **Estrutura jurídica errada** → consultar contador antes.
2. **CNAE incompatível** → usar 6203-1/00 + secundários corretos.
3. **Contrato social genérico** → redigir sob medida + acordo de sócios.
4. **Endereço sem viabilidade urbana** → checar prefeitura/condomínio.
5. **Ignorar Fator R** → pagar 15,5% em vez de 6%. Alinhar folha/pró-labore.
6. **Negligenciar contabilidade** → rotina mensal desde o dia 1.
7. **Dividir quotas igual sem vesting** → risco de sócio-fantasma.
8. **Falta de planejamento** — Sebrae aponta 17% fechando por isso.

## 9. Endereço

- **Residencial:** permitido (empresa domiciliar), **mais barato (R$ 0)**. Riscos: condomínio pode proibir; precisa de **viabilidade urbana** na prefeitura; expõe endereço pessoal. Para software (sem atendimento presencial), costuma ser aceito ([Contabilidade.com](https://contabilidade.com/blog/escritorio-virtual-ou-endereco-residencial-qual-e-melhor-para-abrir-empresa/); [BCLASS](https://bclass.com.br/escritorio-virtual-coworking/posso-abrir-empresa-no-endereco-da-minha-casa/)).
- **Escritório virtual:** endereço fiscal + caixa postal a partir de ~**R$ 90/mês** (SP); com sala de reunião **R$ 280-300/mês** ([Contaja](https://contaja.com.br/blog/coworking-endereco-virtual-e-endereco-fiscal-qual-escolher/); [Soluzione](https://soluzionenegociosdigitais.com.br/como-abrir-uma-empresa-em-escritorio-virtual/)).
- **Coworking:** básico **R$ 300-800/mês**.

**Para o perfil:** comece no **residencial** (checando condomínio + viabilidade); se houver restrição, **escritório virtual (~R$ 90/mês)**.

---

## Passo a passo recomendado

1. **Agora:** publiquem como **PF** (Apple Individual, Google Individual), desenvolvam e validem.
2. **Perto de monetizar/captar:** abram **LTDA** via **contabilidade online**.
3. **Simples Nacional** + pró-labore calibrado para **Fator R ≥ 28%** (6% em vez de 15,5%).
4. **CNAE 6203-1/00** (primário) + 6201-5/01 (secundário).
5. **Acordo de sócios com vesting** (4a/cliff 1a) redigido por advogado — antes de captar.
6. **Endereço** residencial ou escritório virtual (~R$ 90/mês).
7. Após **CNPJ + D-U-N-S**: migrar contas Apple/Google para **Organização**.
8. Reavaliar regime tributário **anualmente**.

## Ressalvas sobre números

O custo fixo mensal mínimo (~R$ 550-700) é composição de faixas das fontes (contador + INSS + pró-labore), não valor único — depende do plano contábil e da política de pró-labore. Taxas de Junta variam por estado (R$ 100-500). Salário mínimo usado: R$ 1.518 (2025); confirme 2026 com o contador. Taxas Apple/Google em dólar podem ter mudado — confirme nos consoles oficiais.

## Fontes

**Tipo societário / capital / abertura**
- https://blog.asaas.com/capital-social-para-abrir-empresa/
- https://www.cora.com.br/blog/capital-social-minimo-para-abrir-uma-sociedade-limitada/
- https://www.cora.com.br/blog/sociedade-limitada-com-um-socio/
- https://barbieriadvogados.com/en/sociedade-limitada-unipessoal-slu-guia-completo-para-empreendedores-em-2025/
- https://thestartlaw.com/tipos-societarios-e-regimes-tributarios-para-startups/
- https://ejudi.com.br/startup-tipo-societario/

**Tributação / Simples / Fator R / Lucro Presumido**
- https://www.e-auditoria.com.br/blog/anexo-iii-ou-anexo-v-simples-nacional/
- https://wetax.com.br/anexo-3-simples-nacional-2025-2026
- https://contabilidade.com/blog/simples-nacional-2026-guia-completo-de-anexos-fator-r-limites-e-das/
- https://contabilidade.com/blog/fator-r-no-simples-nacional-2026-como-calcular-exemplos-praticos-e-quando-servicos-migram-do-anexo-v-para-o-iii/
- https://wetax.com.br/simples-nacional-vs-lucro-presumido-desenvolvedor-pj
- https://blog.sejaconte.com.br/post/simples-nacional-ou-lucro-presumido-para-empresas-de-tecnologia

**CNAE**
- https://concla.ibge.gov.br/busca-online-cnae.html?subclasse=6203100&view=subclasse
- https://www.meucontadoronline.com.br/blog/cnae-desenvolvimento-software-programadores-startups/
- https://contabilidade.com/blog/cnae-6203100-desenvolvimento-e-licenciamento-de-programas-de-computador-nao-customizaveis-simples-nacional-fator-r-e-abertura-de-empresa/

**Custos / contabilidade / pró-labore / INSS**
- https://www.contabilizei.com.br/quanto-custa-contabilizei/
- https://agilize.com.br/quanto-custa-agilize/
- https://negociocerto.org/quanto-custa-uma-contabilidade-online/
- https://www.contabilizei.com.br/contabilidade-online/inss-pro-labore/
- https://contaja.com.br/blog/inss-pro-labore/
- https://www.cora.com.br/blog/quanto-custa-abrir-cnpj-2025/
- https://www.contabilizei.com.br/contabilidade-online/quanto-custa-abrir-empresa-no-brasil-descubra-tudo/

**Timing / lançar app / contas de desenvolvedor**
- https://sebraepr.com.br/comunidade/artigo/vou-empreender-e-agora-preciso-de-cnpj
- https://slap.law/formalizar-cnpj-startup/
- https://www.startupsc.com.br/quando-e-a-hora-de-formalizar-minha-startup-com-um-cnpj/
- https://ajuda.fabapp.com/pt-br/article/como-criar-conta-google-developer-individual-1cspgn5/
- https://ajuda.fabapp.com/pt-br/article/conta-desenvolvedor-individual-apple-av8nx8/
- https://ajuda.fabapp.com/pt-br/article/conta-desenvolvedor-empresarial-apple-3c26bc/

**Acordo de sócios / vesting**
- https://thestartlaw.com/acordo-de-socios/
- https://economiasc.com/2026/07/03/acordo-de-socios-o-documento-que-decide-se-sua-startup-sobrevive-a-um-conflito-entre-fundadores/
- https://www.jusbrasil.com.br/artigos/contrato-de-vesting-para-startups-do-conceito-a-estrategia-juridica-guia-completo/1994854641
- https://www.garrastazu.adv.br/acordo-de-socios-na-pratica-clausulas-essenciais-para-proteger-a-empresa-e-os-socios
- https://www.comececomopedireito.com.br/blog/acordo-de-socios/

**Endereço / erros comuns**
- https://contabilidade.com/blog/escritorio-virtual-ou-endereco-residencial-qual-e-melhor-para-abrir-empresa/
- https://contaja.com.br/blog/coworking-endereco-virtual-e-endereco-fiscal-qual-escolher/
- https://bclass.com.br/escritorio-virtual-coworking/posso-abrir-empresa-no-endereco-da-minha-casa/
- https://oimparcial.com.br/negocios/2025/08/erros-comuns-ao-abrir-cnpj-o-que-evitar-para-nao-prejudicar-seu-negocio/
- https://sebrae.com.br/sites/PortalSebrae/artigos/saiba-quais-os-perfis-e-condicoes-para-abrir-e-formalizar-sua-empresa,61750680787ed710VgnVCM100000d701210aRCRD
