/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  // Sem `env`, o `no-undef` acusa qualquer global do browser. Isso nunca
  // apareceu nos .ts/.tsx porque o @typescript-eslint desliga `no-undef` neles
  // — quem checa identificador solto lá é o próprio TypeScript. Só os .js
  // sentiam, e eram justamente os que a varredura não alcançava.
  env: { browser: true, es2022: true },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    ".expo",
    "supabase/migrations",
    "*.config.js",
    "*.config.cjs",
    "metro.config.js",
    "babel.config.js",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    {
      // Scripts de build/empacotamento e a própria config rodam no Node, não
      // no browser — inclusive este arquivo, que é CommonJS.
      files: ["scripts/**/*.{js,mjs,cjs,ts}", "**/scripts/**/*.{js,mjs,cjs,ts}", ".eslintrc.cjs"],
      env: { browser: false, node: true },
    },
    {
      // O service worker roda fora da janela: `self` é o escopo global dele, e
      // `window`/`document` não existem lá. Declarar o env certo é o que
      // separa "usa a API do SW" de "esqueceu que não tem DOM aqui".
      files: ["**/public/sw.js"],
      env: { browser: false, serviceworker: true },
    },
    {
      files: ["apps/mobile/**/*.{ts,tsx}"],
      plugins: ["react", "react-hooks"],
      extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
      settings: { react: { version: "detect" } },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
  ],
};
