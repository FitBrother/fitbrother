/**
 * build-legal.mjs — gera as páginas legais estáticas a partir dos markdowns.
 *
 * Roda depois do `vite build`, lendo `content/legal/*.md` e escrevendo
 * `dist/<slug>.html`. O `cleanUrls` do Vercel serve esses arquivos sem a
 * extensão, então `privacidade.html` responde em `/privacidade` — que é
 * exatamente a URL já configurada em apps/mobile/app.json.
 *
 * O markdown é a fonte da verdade; este script só o veste com os tokens
 * visuais da landing. `marked` é devDependency: nada disso chega ao cliente
 * como JavaScript, a saída é HTML puro.
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, "..", "content", "legal");
const OUT_DIR = join(__dirname, "..", "dist");

/** Extrai o bloco de frontmatter YAML simples (chave: valor) do topo do arquivo. */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    throw new Error("markdown sem frontmatter");
  }

  const meta = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }

  return { meta, body: raw.slice(match[0].length) };
}

function renderPage({ meta, body }) {
  // Tabelas largas precisam rolar dentro do próprio container — sem isso a
  // página inteira rola horizontalmente no celular.
  const html = marked
    .parse(body)
    .replaceAll("<table>", '<div class="table-scroll"><table>')
    .replaceAll("</table>", "</table></div>");

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${meta.title} — FitBrother</title>
    <meta name="description" content="${meta.title} do FitBrother, app de acompanhamento nutricional com IA." />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
    />
    <style>
      :root {
        --menta: #06d59f;
        --ink: #04100c;
        --canvas: #f6f7f5;
        --surface: #ffffff;
        --text-muted: rgba(4, 16, 12, 0.6);
        --border: rgba(4, 16, 12, 0.1);
        --radius-lg: 20px;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--canvas);
        color: var(--ink);
        font-family: "Inter", sans-serif;
        line-height: 1.7;
        -webkit-font-smoothing: antialiased;
      }
      .topbar {
        border-bottom: 1px solid var(--border);
        background: var(--surface);
        padding: 18px 24px;
      }
      .topbar a { display: inline-flex; align-items: center; }
      .topbar img { height: 28px; }
      .wrap {
        max-width: 760px;
        margin: 0 auto;
        padding: 56px 24px 96px;
      }
      h1 {
        font-family: "Space Grotesk", sans-serif;
        font-size: clamp(2rem, 5vw, 2.75rem);
        line-height: 1.15;
        letter-spacing: -0.02em;
        margin: 0 0 32px;
      }
      h2 {
        font-family: "Space Grotesk", sans-serif;
        font-size: 1.5rem;
        letter-spacing: -0.01em;
        margin: 56px 0 16px;
        padding-top: 8px;
      }
      h3 {
        font-family: "Space Grotesk", sans-serif;
        font-size: 1.15rem;
        margin: 36px 0 12px;
      }
      p, li { font-size: 1.02rem; }
      a { color: #05a87e; text-decoration: underline; text-underline-offset: 3px; }
      strong { font-weight: 600; }
      ul, ol { padding-left: 22px; }
      li { margin: 8px 0; }
      hr { border: 0; border-top: 1px solid var(--border); margin: 48px 0; }
      blockquote {
        margin: 28px 0;
        padding: 16px 22px;
        background: var(--surface);
        border-left: 3px solid var(--menta);
        border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
      }
      blockquote p { margin: 0; }
      .table-scroll { overflow-x: auto; margin: 24px 0; }
      table {
        width: 100%;
        border-collapse: collapse;
        background: var(--surface);
        border-radius: var(--radius-lg);
        overflow: hidden;
        font-size: 0.95rem;
      }
      th, td {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        vertical-align: top;
      }
      th { font-weight: 600; background: rgba(6, 213, 159, 0.08); }
      tr:last-child td { border-bottom: 0; }
      .footer {
        max-width: 760px;
        margin: 0 auto;
        padding: 0 24px 72px;
        color: var(--text-muted);
        font-size: 0.9rem;
      }
      .footer a { color: var(--text-muted); }
    </style>
  </head>
  <body>
    <nav class="topbar">
      <a href="/" aria-label="Voltar para a página inicial do FitBrother">
        <img src="/brand/logo-horizontal-menta.png" alt="FitBrother" />
      </a>
    </nav>
    <main class="wrap">
${html}
    </main>
    <div class="footer">
      <p>
        <a href="/">Início</a> &middot;
        <a href="/termos">Termos</a> &middot;
        <a href="/privacidade">Privacidade</a> &middot;
        <a href="/exclusao-de-dados">Exclusão de dados</a> &middot;
        <a href="/aviso-de-saude">Saúde e IA</a> &middot;
        <a href="/cookies">Cookies</a>
      </p>
      <p>© 2026 FitBrother</p>
    </div>
  </body>
</html>
`;
}

const files = readdirSync(CONTENT_DIR).filter((name) => name.endsWith(".md"));

if (files.length === 0) {
  console.error("Nenhum markdown encontrado em content/legal — nada a gerar.");
  process.exit(1);
}

for (const file of files) {
  const parsed = parseFrontmatter(readFileSync(join(CONTENT_DIR, file), "utf8"));
  const { slug } = parsed.meta;

  if (!slug) {
    throw new Error(`${file}: frontmatter sem "slug"`);
  }

  writeFileSync(join(OUT_DIR, `${slug}.html`), renderPage(parsed), "utf8");
  console.error(`  ✓ /${slug}  ←  ${file}`);
}

console.error(`${files.length} páginas legais geradas em dist/.`);
