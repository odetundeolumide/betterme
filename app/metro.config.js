const { getDefaultConfig } = require('expo/metro-config');

module.exports = (function () {
  const defaultConfig = getDefaultConfig(__dirname);
  const { transformer, resolver } = defaultConfig;

  // Rewrite the broken expo-sqlite web import to our memory store
  resolver.blockList = resolver.blockList || [];
  resolver.blockList.push(
    // Block the default wasm import so Metro doesn't try to fetch it
    './wa-sqlite/wa-sqlite.wasm'
  );

  // Alias it to our web store instead
  resolver.alias = resolver.alias || {};
  resolver.alias['./wa-sqlite/wa-sqlite.js'] = './offline.web.js';

  return {
    ...defaultConfig,
    transformer: {
      ...transformer,
      // Enable CSS and image processing for the web build
      experimentalImportSupport: false,
    },
    resolver,
  };
})();