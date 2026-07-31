module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/**/*.test.ts", "<rootDir>/**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^@fitbrother/shared$": "<rootDir>/../../packages/shared/src",
  },
};
