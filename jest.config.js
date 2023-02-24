const isCI = !!process.env.CI

/**
 * @type {import('ts-jest').JestConfigWithTsJest}
 */
const config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  roots: ["tests", "src"],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  collectCoverageFrom: ['./src/**'],
  coverageReporters: isCI ? ['text', 'cobertura'] : ['html'],
}

export default config
