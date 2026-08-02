const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const opSqliteEntry = path.resolve(
  __dirname,
  'node_modules/@op-engineering/op-sqlite/lib/module/index.js',
);

const config = {
  resolver: {
    /**
     * op-sqlite's package.json sets "react-native": "src/index", which makes Metro
     * bundle TypeScript sources and fail to resolve ./Storage on some setups.
     * Use the prebuilt lib/module entry instead.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@op-engineering/op-sqlite') {
        return {
          filePath: opSqliteEntry,
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
