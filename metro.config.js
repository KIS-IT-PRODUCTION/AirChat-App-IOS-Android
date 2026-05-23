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
  extraNodeModules: {
    '@opentelemetry/api': emptyModulePath,
  },
  // Додай це — для EAS збірки
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName.startsWith('@opentelemetry/')) {
      return { filePath: emptyModulePath, type: 'sourceFile' };
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;