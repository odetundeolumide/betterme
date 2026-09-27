const { getDefaultConfig } = require('expo/metro-config');

module.exports = (function () {
  const defaultConfig = getDefaultConfig(__dirname);
  const { transformer, resolver } = defaultConfig;

  // Alias the broken expo-sqlite wasm import to our web memory store
  // This way Metro resolves './wa-sqlite/wa-sqlite.wasm' → our offline.web.js instead of trying to fetch the wasm file
  const alias = resolver.alias || {};
  alias['./wa-sqlite/wa-sqlite.wasm'] = './offline.web.js';
  alias['./wa-sqlite/wa-sqlite'] = './offline.web.js';
  resolver.alias = alias;

  return {
    ...defaultConfig,
    resolver,
  };
})();