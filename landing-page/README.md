# FitBrother — Landing Page

Landing page do FitBrother (React + Vite). Direção visual **Dark Premium**, aplicando a marca real (logo FB, menta `#06D59F` sobre quase-preto).

## Rodar

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção em dist/
npm run lint
```

## Estrutura

- `src/index.css` — design tokens da marca + estilos de todas as seções.
- `src/components/` — seções (Navbar, Hero, Features, HowItWorks, AppPreview, Faq, FinalCta, Footer).
- `src/components/brand/` — primitivas reutilizáveis (CalorieRing, MacroChips, DottedChart, LeaderboardRow).
- `src/components/Icon.jsx` — ícones SVG de linha.
- `public/brand/` — logo e ícone da marca.

## Telas do app (prints reais)

Os mockups de tela usam **componentes de UI construídos em CSS** na marca, como placeholder de alta qualidade. Os pontos de troca estão marcados no JSX com `data-screenshot="..."`:

- `data-screenshot="dashboard"` — Hero ([Hero.jsx](src/components/Hero.jsx)) e Preview ([AppPreview.jsx](src/components/AppPreview.jsx))
- `data-screenshot="whatsapp"` / `"ai-flow"` / `"gamification"` — passos do [HowItWorks.jsx](src/components/HowItWorks.jsx)

Para usar prints reais: capture as telas no seu device/simulador (onde você já está logado e com dados), salve em `public/images/` e troque o conteúdo do slot por `<img src="/images/..." alt="..." />`.

> Nota: a captura automática via Expo web não foi possível neste ambiente — o app exige `EXPO_PUBLIC_SUPABASE_URL` + usuário autenticado, onboarding e chaves de IA para popular o dashboard. Por isso os componentes CSS seguem como visual padrão (e ficam ótimos).

## CTA / lojas

Os badges de App Store / Google Play ([StoreBadges.jsx](src/components/StoreBadges.jsx)) usam `href="#"` placeholder — procure por `TODO: link real da loja` para preencher quando o app publicar.
