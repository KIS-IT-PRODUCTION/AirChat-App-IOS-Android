const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
const { transformer, resolver } = config;

config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'),
};

const emptyModulePath = path.resolve(__dirname, 'empty-module.js');

config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  resolveRequest: (context, moduleName, platform) => {
    // Блокуємо OpenTelemetry
    if (moduleName.startsWith('@opentelemetry/')) {
      return { filePath: emptyModulePath, type: 'sourceFile' };
    }
    // Блокуємо Node.js модулі що тягне ws з @supabase/realtime-js
    const nodeModulesToBlock = ['stream', 'util', 'net', 'tls', 'fs', 
      'dns', 'http', 'https', 'zlib', 'os', 'path', 'crypto', 'assert',
      'buffer', 'url', 'querystring', 'string_decoder', 'punycode'];
    if (
      nodeModulesToBlock.includes(moduleName) &&
      context.originModulePath.includes('@supabase/realtime-js/node_modules/ws')
    ) {
      return { filePath: emptyModulePath, type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;