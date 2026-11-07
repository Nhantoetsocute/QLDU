const { withAndroidManifest } = require('expo/config-plugins');

// Android debug manifests may opt into local HTTP; a release manifest is strict by default.
module.exports = function withSecureTransport(config, { development = false } = {}) {
  return withAndroidManifest(config, (result) => {
    const applications = result.modResults.manifest.application || [];
    for (const application of applications) {
      application.$ = application.$ || {};
      application.$['android:usesCleartextTraffic'] = development ? 'true' : 'false';
    }
    return result;
  });
};
