# Compartilhar como stories do Instagram — Design

> Data: 2026-10-31. Status: rascunho, aguardando aprovação do dono. Sucede `2026-10-11-camera-ao-vivo-share-design.md`.
>
> Marcações: **[dono]** foi decidido pelo dono do produto. **[builder-call]** é decisão do autor deste documento, que o dono ainda pode derrubar.

## Intenção

O dono testou a câmera ao vivo no iPhone e ela funcionou. Agora quer que compartilhar pareça o que as pessoas já sabem usar: a câmera de stories do Instagram. Quem abre a tela não deve precisar aprender nada. A referência é um print da câmera de stories: imagem em tela cheia com cantos arredondados, botão de disparo redondo no centro, fila de filtros ao redor dele, galeria embaixo à esquerda e virar câmera embaixo à direita.

A tela atual é um carrossel de cards pequenos, com um editor de enquadramento separado, e foi pensada como "gerar uma imagem". A nova é "montar um story".

## Objetivos

1. Na refeição, **Compartilhar** abre a câmera em tela cheia, no molde do Instagram. Se a refeição já tem foto, antes pergunta se a pessoa quer usar a foto salva ou tirar outra. **[dono]**
2. Os presets ficam em bolinhas ao redor do botão de disparo, e o selecionado vai para o centro, como os filtros do Instagram (opção 1B do mockup). **[dono]**
3. O HUD oferece foto da galeria e compartilhar sem foto. **[dono]**
4. Depois da foto, a imagem se ajusta com dois dedos: pinça para zoom, giro e arrasto de posição. **[dono]**
5. Os elementos do card funcionam como stickers: arrastam e redimensionam. **[dono]**
6. Qualquer elemento pode ser removido, menos o logo, que fica sempre na imagem. **[dono]**
7. Os gradientes coloridos saem dos presets. Fica só um gradiente preto igual ao do Discreto. **[dono]**
8. Um botão liga e desliga essa vinheta. **[dono]**
9. O editor tem **Baixar**, e **Compartilhar** quando o navegador ou aparelho puder compartilhar arquivos. **[dono]**
10. **Novo post** abre um fluxo parecido, com a câmera no formato do post. **[dono]**

## Fora do escopo

- Um único botão para feed e para fora. O dono descartou o toggle "publicar no feed": a refeição mantém dois botões. **[dono]**
- Publicar no feed a partir do editor de story.
- Texto livre, desenho, música, filtros de cor e sticker novo. Só existem os elementos que o card já tem.
- Flash. O navegador não controla o flash em todo celular. **[builder-call]**
- Guardar o arranjo dos stickers para reabrir depois. Vive só na visita à tela.

## O que seria falha mesmo funcionando

- O logo sair, sumir ou ficar escondido por algum caminho: encolhendo até não aparecer, arrastando para fora do quadro ou cobrindo com outro sticker.
- Qualquer gradiente colorido sobreviver em algum preset.
- A refeição sem foto não ganhar a foto da imagem exportada, ou a refeição com foto perder a original.
- A imagem exportada diferir do que a pessoa viu no editor.
- A tela parecer um clone sem marca: a cor de destaque, as fontes e o logo têm que ser do Fitbrother, e nada do Instagram (nome, logo, cores do gradiente dele) aparece.
- O gesto de stickers travar no celular. O dono já reclamou de travamento nesta família de telas.

## O fluxo

```
Refeição ─ Compartilhar ─┬─ Câmera story ── disparo ─┐
                         ├─ Galeria ─────────────────┼─ Editor ─ Baixar / Compartilhar
                         ├─ Sem foto ────────────────┤
                         └─ Foto salva (se houver) ──┘

Refeição ─ Novo post ─── Câmera 4:5 (ou galeria, ou sem foto) ─ tela Novo post ─ Publicar
```

### Entradas

| Onde | Hoje | Depois |
|---|---|---|
| Detalhe da refeição | "Compartilhar no feed" + "Gerar imagem" | **Compartilhar** + **Novo post** **[dono]** |
| Home: prompt após registrar e deslize do card | "Gerar imagem" | Mesmo fluxo de Compartilhar, com o rótulo **Compartilhar** **[builder-call]** |
| Análise (`InsightCard`) | "Gerar imagem" | Vai direto para o Editor, fundo preto **[builder-call]** |
| Post do feed (`PostCard`) | Ícone "Compartilhar fora do Fitbrother" | Vai direto para o Editor, com a foto do post **[builder-call]** |

A rota continua `/(app)/share/[type]/[id]`, e o fluxo do post continua em `/(app)/post/new`. Hoje a tela de compartilhar abre como `modal`. Ela passa a `fullScreenModal`, porque a câmera ocupa a tela toda. **[builder-call]**

### Refeição que já tem foto

Quando a refeição foi registrada com foto, a tela de compartilhar pergunta antes de abrir a câmera: **Usar a foto salva** ou **Tirar outra**. **[dono]**

- A pergunta usa `useDialog().confirm`, porque `Alert.alert` não existe na web. Sair do diálogo sem escolher conta como **Tirar outra**. **[builder-call]**
- Ela vem antes da câmera, para quem escolhe a foto salva não ver o pedido de permissão à toa. **[builder-call]**
- **Usar a foto salva** abre o Editor com ela. Voltar leva à câmera, então dá para mudar de ideia.
- **Tirar outra** abre a câmera normalmente, com galeria e "Sem foto" disponíveis.
- A foto nova só entra na imagem exportada. A original da refeição continua intacta (ver Exportação). **[builder-call]**
- Só aparece em `type === "meal"`, e só quando a foto carrega. Se `meals.image_path` existir mas a foto não carregar, a tela abre a câmera sem perguntar.
- Vale para todas as entradas de refeição: detalhe, prompt e deslize da Home.

## Câmera de story

Base visual: o print do Instagram, com tokens do Fitbrother.

- Fundo `ink` nas áreas fora da imagem. Esta tela é superfície de câmera, não dark mode do app: não usa `dark:`.
- Quadro 9:16 de ponta a ponta na largura, com cantos arredondados, e a barra inferior abaixo dele.
- **Topo:** fechar (✕) à esquerda, vinheta à direita.
- **Lateral esquerda:** "Sem foto", com ícone e rótulo. **[builder-call]** Corrige o mockup: lá apareciam dois ícones, e a galeria só fica na barra inferior.
- **Por cima da imagem:** logo e elementos do preset selecionado, ao vivo, por cima do vídeo.
- **Parte de baixo do quadro:** fila de presets e disparo (abaixo).
- **Barra inferior:** galeria à esquerda, nome da etapa ao centro, virar câmera à direita. **[builder-call]** Virar câmera é novo e veio do print. Exige passar `facing` ao `CameraLive`. Na web a miniatura da galeria é um ícone, porque o navegador não dá acesso à última foto.

### Fila de presets (1B)

- Bolinhas numa fila horizontal que desliza. A do preset selecionado fica centralizada, por trás do disparo.
- Arrastar a fila troca o preset. Tocar numa bolinha lateral também. Tocar no centro tira a foto.
- O anel do disparo usa `primary-400`. **[builder-call]**
- A troca atualiza os elementos sobre a câmera. O vídeo é um só e nunca desmonta, a mesma regra de "uma câmera" da feature anterior.

## Presets

Sem gradiente colorido, vários presets ficam iguais. **Preset passa a ser arranjo inicial dos elementos, não cor.** **[builder-call]**

| Hoje | Com a regra nova |
|---|---|
| Noturno | Fica, como **Completo**: número grande, barra e legenda de macros |
| Etiqueta | Fica |
| Discreto | Fica. É a origem do gradiente preto |
| Claro | Sai. Só se distinguia pelo fundo e pelo scrim claro |
| Menta | Sai. Só se distinguia pelo gradiente verde |
| Moldura | Sai. Depende de foto presa em retângulo interno, o que conflita com a foto livre do editor |
| Pôster | Vira o arranjo do **Sem foto** |

O que a fila mostra: **[builder-call]**

| Situação | Fila |
|---|---|
| Com foto e macros | Completo, Etiqueta, Discreto |
| Com foto, sem macros | Completo |
| Sem foto (inclui análise) | Pôster, Completo |

Etiqueta e Discreto seguem exigindo foto e macros, como hoje em `presetsFor`. Pôster só aparece sem foto. Análise abre em Pôster.

## Editor

Abre depois do disparo, da galeria ou de "Sem foto". Mesma moldura visual da câmera, sem o disparo.

- **Topo:** voltar à esquerda (volta à câmera e descarta), vinheta à direita.
- **Base:** fila de presets, porque quem veio da galeria ou de "Sem foto" não passou por ela. **[builder-call]** Trocar de preset refaz o arranjo e devolve elementos removidos. Tocar no preset já selecionado faz o mesmo, o que garante restaurar mesmo com um preset só na fila. **[builder-call]**
- **Ações:** Baixar (ícone) e Compartilhar (botão principal). Compartilhar só aparece se `navigator.canShare({ files })` for verdadeiro, como `lib/share-card.ts` já checa. Sem ele, fica só Baixar. **[dono]** No nativo, a dupla é Salvar na galeria e Compartilhar.

### Foto

Dois dedos sobre a imagem aplicam zoom, giro e posição ao mesmo tempo, como no Instagram. **[dono]** Um dedo fora de um sticker não faz nada. **[builder-call]**

O modelo de `lib/media/crop.ts` não serve: ele prende a foto em `cover` e não tem rotação. O editor precisa de um estado novo, normalizado pelo tamanho do card: escala, rotação e deslocamento. A foto pode deixar o quadro descoberto, e o que aparece é o fundo `ink`. **[builder-call]** `Enquadramento` continua existindo para `PhotoAdjuster` e para o Novo post.

### Stickers

| Elemento | Refeição | Análise | Remove? |
|---|---|---|---|
| Logo | sim | sim | **Não** **[dono]** |
| Calorias | sim | — | sim |
| Macros (barra + legenda) | sim | — | sim |
| Itens da refeição | sim | — | sim |
| Data | sim | sim | sim |
| Título, resumo, tópicos, nota | — | sim | sim |

- **Gestos:** um dedo arrasta. Dois dedos sobre o sticker redimensionam e giram. **[dono: arrastar e redimensionar; giro é builder-call, por ser o comportamento do Instagram]**
- **Remover:** ao arrastar, uma lixeira aparece embaixo. Soltar sobre ela remove. **[dono: pode remover; forma é builder-call]** Com o logo, a lixeira não aparece.
- **Logo:** sticker próprio em todos os presets, sempre na camada de cima, com escala mínima e o retângulo inteiro dentro do quadro. Usa a variante branca com sombra suave, para ler sobre qualquer foto com a vinheta desligada. Girar é permitido. **[builder-call]**
- **Etiqueta:** a placa branca vira um sticker com os números. O logo sai de dentro dela, então remover a placa não remove o logo. **[builder-call]**
- **Vinheta:** segue a do preset, ligada por padrão. Em Etiqueta vem desligada, porque o chip tem contraste próprio. Fica ativa ou inativa na imagem exportada igual ao que se vê. **[builder-call]**

### No desktop

O dono já aceitou que o desktop fique só com Baixar, então o editor abre lá com mouse, sem dois dedos. **[builder-call]** Arrastar com o mouse move a foto ou o sticker sob o cursor, a roda aproxima e afasta o que estiver sob o cursor, e a lixeira funciona igual. Girar fica só no toque.

## Vinheta

Um único gradiente de `ink` com alpha, igual ao scrim do Discreto (paradas `0.4 / 0.72 / 1`, opacidades `0 / 0.28 / 0.8`). Vale na câmera, no editor e no export. O estado passa da câmera para o editor.

## Sem foto

Fundo `ink` chapado, sem gradiente, com o arranjo do Pôster. **[builder-call]** Mantém o logo.

## Novo post

Mesma câmera, sem presets e sem stickers, com quadro `FEED_PHOTO_ASPECT` (4:5). **[dono: fluxo parecido com a câmera no formato do post; o resto é builder-call]**

- Disparo ou galeria leva à tela `post/new` já com a foto, onde seguem legenda, ajuste com `PhotoAdjuster` e publicar.
- "Sem foto" leva à mesma tela sem foto, que já é permitido.
- Calorias e macros continuam no card do feed, abaixo da foto.
- Sem a pergunta da foto salva: o Novo post já não reaproveita a foto da refeição hoje, e isso não muda. **[builder-call]**

## Exportação

- PNG 1080×1920, gerado no toque, sem pré-captura. A feature anterior mediu o custo disso.
- A foto é salva na refeição no primeiro Baixar ou Compartilhar, sem bloquear, via `persistirFoto`, e só em `type === "meal"` com `meals.image_path` vazio. Vale para câmera e galeria. Hoje ela sobe na captura, mas o editor agora tem voltar e descartar, e o path é fixo com `upsert`: subir antes gravaria fotos rejeitadas, e subir com uma foto já salva apagaria a original. O teste é sobre `image_path`, não sobre a foto ter carregado, para uma falha de leitura não virar sobrescrita. Quem sai sem exportar descarta a foto, como no Instagram. **[builder-call]**
- **Risco a validar antes de construir o resto:** a web exporta com html2canvas, e rotação de foto e de sticker nunca foi exercitada nele. O primeiro passo do plano é medir isso. Se o resultado divergir do editor, a web compõe a imagem com canvas 2D próprio.

## Restrições

- **Regras de UI do `CLAUDE.md`:** famílias `font-sans-*` e `font-display-*`, `tabular-nums`, cores por token, 44×44pt, `accessibilityLabel`, `lucide-react-native`, sem tags HTML (a exceção de `<video>` continua restrita).
- **Dependências:** `react-native-gesture-handler` e `reanimated` já existem. Sem lib nova de gesto ou editor.
- **Plataformas:** web/PWA primeiro, que é o que foi validado. O código é compartilhado e só `CameraLive` difere. O nativo entra na mesma entrega, mas exige adicionar a permissão de câmera ao `app.json`, que hoje não tem `NSCameraUsageDescription` nem o plugin `expo-camera`.
- **Câmera web:** manter `PEDIDO_INICIAL` e a reabertura de `frameDeitado`. Vale para os dois quadros, e o Novo post pede o mesmo stream.
- **Ambiente:** `dev.fitbrother.app` aponta para Supabase e Lambda de produção, e as migrations 0081/0082 e o servidor não subiram. Até isso ser corrigido pelo dono, a foto não fica salva na refeição durante os testes.

## Limpeza junto com esta entrega

- Registrar em `docs/PLAN.md` o gate da Task 6: iPhone (Safari e Vivaldi) entrega 1080×1920 pedindo 1920×1080. D1 de pé. Android não medido.
- Apagar `apps/mobile/app/debug-camera.tsx`.

## Fica a critério de quem constrói

- Tamanhos, espaçamentos e ícones exatos, desde que sigam `DESIGN_SYSTEM.md`.
- Estrutura de componentes e rotas internas da tela.
- Linhas-guia de área segura durante o arrasto, usando `STORY_SAFE_TOP` e `STORY_SAFE_BOTTOM`.
- Limites de zoom da foto e dos stickers, salvo o mínimo do logo.
- Como os elementos atuais do `ShareCard` viram stickers independentes.
