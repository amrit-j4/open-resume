import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const config = {
  // Add more setup options before each test is run
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  testEnvironment: "jest-environment-jsdom",

  // tsconfig's catch-all path ("*": ["*"]) is what lets tests import "lib/..." , but it also makes the compiler rewrite packages that
  // aren't in src/app into relative paths ("../../mammoth"). Point those back at the packages.
  moduleNameMapper: {
    // Node built-ins can't be pointed at by name (the mapper would treat "dns" as a file), so they go through tiny shims.
    "^(?:\\.\\./)+(dns|http|https)$": "<rootDir>/jest/builtins/$1.cjs",
    "^(?:\\.\\./)+(mammoth|jszip|next/.*|react|react/.*|@[^/]+/.*)$": "$1",
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(config);
