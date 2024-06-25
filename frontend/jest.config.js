module.exports = {
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest", // Ensure Babel processes JSX and JS files
  },
  transformIgnorePatterns: [
    'node_modules/(?!(axios)/)' // Transforms axios even though it's inside node_modules
  ],
  moduleNameMapper: {
    '\\.(css|jpg|png)$': '<rootDir>/__mocks__/fileMock.js'
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js']
};