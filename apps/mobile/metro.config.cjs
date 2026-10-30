const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// Three r186's CommonJS entry calls Node-only process.emitWarning. Both our
// imports and Fiber's require("three") must resolve to the same native-safe ESM.
const threeModule = path.join(
  path.dirname(require.resolve("three")),
  "three.module.js",
);
config.resolver.resolveRequest = (context, name, platform) => {
  if (name === "three") return { type: "sourceFile", filePath: threeModule };
  return context.resolveRequest(context, name, platform);
};

module.exports = config;
