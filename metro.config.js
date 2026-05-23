const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const { transformer, resolver } = config;

// 1. Налаштування трансформера для SVG
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve('react-native-svg-transformer/expo'), 
};

// Шлях до нашої власної локальної заглушки
const emptyModulePath = path.resolve(__dirname, 'empty-module.js');

// 2. Блокуємо OpenTelemetry за допомогою нашого файлу
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== 'svg'),
  sourceExts: [...resolver.sourceExts, 'svg'],
  
  // Перенаправляємо проблемний пакет на наш пустий файл
  extraNodeModules: {
    '@opentelemetry/api': emptyModulePath,
  }
};

module.exports = config;