#!/usr/bin/env node
// Copia um package.json removendo `devDependencies` e `scripts` — usado pro
// package.json de packages/shared dentro do pacote isolado da Lambda.
//
// O Makefile copiava esse arquivo verbatim (`cp`). Isso incluía o
// devDependencies do pacote (typescript, vitest) mesmo esse install rodando
// com `--omit=dev`: a flag só corta as devDependencies do package.json
// RAIZ do install (o gerado por lambda-package-json.mjs), não as de um
// dependency `file:` referenciado — o npm ainda lê o manifest inteiro de
// packages/shared pra resolver a árvore. `vitest` carrega uma cadeia de
// peerDependencies (@vitest/browser-playwright e afins) que, resolvida
// dentro da árvore de diretórios do monorepo (o install roda aninhado sob o
// package-lock.json/workspaces da raiz), bate num bug conhecido do
// @npmcli/arborist (`Cannot read properties of null (reading 'edgesOut')`
// em `#loadPeerSet`) — reproduzido localmente e confirmado corrigido
// removendo esse devDependencies daqui.
//
// Uso: node scripts/strip-dev-only-fields.mjs <entrada.json> <saida.json>

import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("uso: strip-dev-only-fields.mjs <entrada.json> <saida.json>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(inputPath, "utf8"));
delete pkg.devDependencies;
delete pkg.scripts;

writeFileSync(outputPath, JSON.stringify(pkg, null, 2));
