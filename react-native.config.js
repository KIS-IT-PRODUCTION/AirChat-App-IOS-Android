module.exports = {
  dependencies: {
    'react-native-maps': {
      platforms: {
        android: null, // вимикає нову архітектуру СУТО для карт на Android
        ios: null,     // вимикає нову архітектуру СУТО для карт на iOS
      },
    },
  },
};