/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "mjs"],
  testMatch: ["**/tests/**/*.test.js"],
  verbose: true,
  testTimeout: 60000,
};
