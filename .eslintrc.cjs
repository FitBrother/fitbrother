/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
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
