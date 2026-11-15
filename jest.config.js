/**
 * Two projects, because the module under test decides which runtime it needs.
 *
 * `iam` runs the in-app messaging core: plain TypeScript, node environment, no React Native jest
 * setup. That setup replaces the global timers, which stops jest's async fake timers from ever
 * resolving — the analytics and service suites drive 30 s batch intervals and 30 s session
 * timeouts through exactly those.
 *
 * `native` runs anything that renders, on React Native's own preset (which moved package with
 * 0.87: `react-native` no longer ships one at its root).
 */
const ignore = ['<rootDir>/example/', '<rootDir>/lib/'];

module.exports = {
  projects: [
    {
      displayName: 'iam',
      rootDir: __dirname,
      testEnvironment: 'node',
      transform: { '^.+\\.(js|ts|tsx)$': 'babel-jest' },
      testMatch: ['<rootDir>/src/InAppMessaging/__tests__/**/*.test.ts'],
      moduleNameMapper: {
        '^react-native$':
          '<rootDir>/src/InAppMessaging/__tests__/support/react-native-stub.ts',
      },
      modulePathIgnorePatterns: ignore,
    },
    {
      displayName: 'native',
      rootDir: __dirname,
      preset: '@react-native/jest-preset',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.tsx'],
      modulePathIgnorePatterns: ignore,
    },
  ],
};
