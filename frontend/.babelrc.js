module.exports = {
  presets: [
    "@babel/preset-env", // Converts modern JS into compatible versions
    "@babel/preset-react" // Transforms JSX into JavaScript
  ],
  plugins: [
    "@babel/plugin-transform-runtime", // Adds support for async/await and generators
    "@babel/plugin-proposal-class-properties", // Support for class property declarations
    "@babel/plugin-proposal-private-methods" // Support for private methods in classes
  ]
};