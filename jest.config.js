const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/__tests__/**/*.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  // Playwright specs (T1.9) run via `npm run e2e`, not jest.
  // lib/ops/parse test fixtures are shared data modules, not suites.
  //
  // 🔴 FA-002 (full-app audit 2026-07-30). These were written as
  // `'<rootDir>/e2e/'`. Jest treats each entry as a REGEX, and on Windows
  // rootDir expands to a path with backslashes — so a checkout whose path
  // contains a dot (this repo's worktrees live under `…/.claude/worktrees/…`)
  // turned `\.claude` into "any character followed by claude", the pattern
  // stopped matching, and four suites that must never run under jest ran and
  // failed. The whole suite reported "5 failed" and a REAL red test was sitting
  // in that noise.
  //
  // Separator-neutral, rootDir-free patterns cannot be broken by where the
  // repo happens to live. Guarded by __tests__/audit/jestIgnorePatterns.test.ts.
  testPathIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\]',
    '[/\\\\]e2e[/\\\\]',
    '[/\\\\]lib[/\\\\]ops[/\\\\]parse[/\\\\]__tests__[/\\\\]fixtures[/\\\\]',
  ],
  collectCoverageFrom: [
    'lib/**/*.{js,jsx,ts,tsx}',
    'app/api/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)













