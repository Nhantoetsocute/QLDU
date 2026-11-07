const base = require('./app.json').expo;

module.exports = () => {
  // Expo Go retains its own native networking settings. Only an explicitly marked local
  // development build may allow HTTP; the default and store builds block cleartext.
  const development = process.env.APP_VARIANT === 'development';
  return {
    ...base,
    android: {
      ...base.android,
      allowBackup: false,
    },
    ios: {
      ...base.ios,
      infoPlist: {
        ...base.ios?.infoPlist,
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: development,
          NSAllowsArbitraryLoadsInWebContent: development,
          NSAllowsArbitraryLoadsForMedia: false,
          NSAllowsLocalNetworking: development,
        },
      },
    },
    plugins: [
      ...(base.plugins || []),
      // Our custom backup exclusions include all shared preferences, including SecureStore.
      ['expo-secure-store', { configureAndroidBackup: false }],
      './plugins/withPrivateStorage',
      ['./plugins/withSecureTransport', { development }],
    ],
  };
};
