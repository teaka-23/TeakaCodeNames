/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/routes/**/*.ts',
    '!src/server.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  coverageDirectory: 'coverage',
  testTimeout: 10000,
  // The WebSocket suite starts a real http server; give Node time to release handles
  openHandlesTimeout: 1000,
};
