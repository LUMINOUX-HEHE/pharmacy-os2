import type { Config } from "jest";

const config: Config = {
  clearMocks: true,
  collectCoverageFrom: ["src/**/*.ts", "!src/server.ts", "!src/config/**"],
  coverageDirectory: "coverage",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^@pharmacy-os/types$": "<rootDir>/../../packages/types/src/index.ts",
    "^@pharmacy-os/utils$": "<rootDir>/../../packages/utils/src/index.ts",
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  preset: "ts-jest/presets/default-esm",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/**/*.test.ts"]
};

export default config;
