#!/usr/bin/env node
// Gera um package.json isolado (só com as dependências reais do
// apps/server) pro pacote da Lambda. Rodar `npm install` com ISSO em vez
// de copiar o node_modules hoisted do monorepo evita puxar as dependências
// gigantes do apps/mobile (React Native/Expo) — foi o que estourou o
// limite de 250MB descompactado da Lambda.
//
// Uso: node scripts/lambda-package-json.mjs <server-package.json> <saida.json>

import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("uso: lambda-package-json.mjs <server-package.json> <saida.json>");
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(inputPath, "utf8"));

const dependencies = { ...pkg.dependencies };
// Os dois pacotes de workspace viram dependências de arquivo local, apontando
// pro dist/ já compilado que o Makefile copia pro mesmo lugar relativo.
dependencies["@fitbrother/shared"] = "file:./packages/shared";
dependencies["@fitbrother/db-types"] = "file:./packages/db-types";

writeFileSync(
  outputPath,
  JSON.stringify(
    {
      name: "fitbrother-server-lambda",
      version: "0.0.0",
      private: true,
      type: "module",
      dependencies,
    },
    null,
    2,
  ),
);
