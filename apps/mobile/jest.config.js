module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@fitbrother/shared$": "<rootDir>/../../packages/shared/src",
    // O `packages/shared/src/index.ts` reexporta com extensão explícita
    // (`export * from "./schemas.js"`), estilo ESM, e o jest não resolve isso
    // contra os `.ts` de verdade. Até agora nenhum teste do mobile importava
    // VALOR do shared — só tipos, que são apagados na compilação — então a
    // lacuna nunca apareceu. `lib/storage.ts` passou a importar `mealPhotoPath`
    // e a trouxe à tona.
    //
    // O padrão só casa com import relativo terminando em `.js`, e não existe
    // nenhum no código do mobile: o alcance é o shared, de propósito.
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
