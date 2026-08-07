module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./src/assets/fonts/'],
  // Sunmi printers are Android-only; linking the iOS stub breaks the build
  // (missing RNPrinterSunmiSpec.h under New Architecture).
  dependencies: {
    'react-native-printer-sunmi': {
      platforms: {
        ios: null,
      },
    },
  },
};
