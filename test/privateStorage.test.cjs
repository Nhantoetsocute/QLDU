const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { parseStringPromise } = require('xml2js');
const plugin = require('../plugins/withPrivateStorage');

test('native config disables Android backup in every variant and lets custom rules own SecureStore backup handling', () => {
  const previous = process.env.APP_VARIANT;
  try {
    for (const variant of [undefined, 'development']) {
      if (variant === undefined) delete process.env.APP_VARIANT;
      else process.env.APP_VARIANT = variant;
      const config = require('../app.config')();
      assert.equal(config.android.allowBackup, false);
      assert.ok(config.plugins.some(entry => entry === './plugins/withPrivateStorage'));
      assert.deepEqual(config.plugins.find(entry => Array.isArray(entry) && entry[0] === 'expo-secure-store'), ['expo-secure-store', { configureAndroidBackup: false }]);
      assert.equal(config.plugins.at(-1)[0], './plugins/withSecureTransport');
    }
  } finally {
    if (previous === undefined) delete process.env.APP_VARIANT;
    else process.env.APP_VARIANT = previous;
  }
});

test('manifest backup controls replace permissive flags while preserving unrelated application attributes', () => {
  const manifest = { manifest: { application: [
    { $: { 'android:name': '.MainApplication', 'android:allowBackup': 'true', 'android:fullBackupContent': '@xml/old_rules', 'android:usesCleartextTraffic': 'false' } },
    { $: { 'android:name': '.OtherApplication' } },
  ] } };
  const result = plugin.applyPrivateStorageManifest(manifest);
  for (const application of result.manifest.application) {
    assert.equal(application.$['android:allowBackup'], 'false');
    assert.equal(application.$['android:fullBackupContent'], 'false');
    assert.equal(application.$['android:dataExtractionRules'], '@xml/' + plugin.RESOURCE_NAME);
  }
  assert.equal(result.manifest.application[0].$['android:name'], '.MainApplication');
  assert.equal(result.manifest.application[0].$['android:usesCleartextTraffic'], 'false');
  assert.throws(() => plugin.applyPrivateStorageManifest({ manifest: {} }));
});

test('generated XML excludes every app storage domain from cloud backup and device transfer', async () => {
  const xml = await parseStringPromise(plugin.DATA_EXTRACTION_XML);
  const rules = xml['data-extraction-rules'];
  const expected = [...plugin.BACKUP_DOMAINS].sort();
  for (const section of ['cloud-backup', 'device-transfer']) {
    assert.equal(rules[section].length, 1);
    const exclusions = rules[section][0].exclude;
    assert.deepEqual(exclusions.map(entry => entry.$.domain).sort(), expected);
    assert.ok(exclusions.every(entry => entry.$.path === '.'));
    assert.equal(rules[section][0].include, undefined);
  }
  assert.equal(rules['cloud-backup'][0].$['disableIfNoEncryptionCapabilities'], 'true');
  assert.ok(expected.includes('sharedpref')); // Includes all SecureStore preferences, not a brittle filename-specific exception.
  assert.ok(expected.includes('device_sharedpref'));
});

test('resource writer targets only generated Android XML and uses no file contents from the environment', async () => {
  const writes = [], directories = [];
  const root = path.resolve('/private/tmp/qldu-test-android-project');
  const fileSystem = {
    mkdir: async (directory, options) => directories.push({ directory, options }),
    writeFile: async (file, content, encoding) => writes.push({ file, content, encoding }),
  };
  await plugin.writeDataExtractionRules(root, fileSystem);
  assert.deepEqual(directories, [{ directory: path.join(root, 'app/src/main/res/xml'), options: { recursive: true } }]);
  assert.deepEqual(writes, [{ file: path.join(root, 'app/src/main/res/xml', plugin.RESOURCE_NAME + '.xml'), content: plugin.DATA_EXTRACTION_XML, encoding: 'utf8' }]);
  await assert.rejects(plugin.writeDataExtractionRules('', fileSystem));
  await assert.rejects(plugin.writeDataExtractionRules('relative/path', fileSystem));
  assert.equal(writes.length, 1);
});

test('Expo manifest mod actually applies the private storage controls without invoking filesystem writes', async () => {
  const config = plugin({ name: 'QLDU', slug: 'qldu-test' });
  const result = await config.mods.android.manifest({
    ...config,
    modResults: { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } },
    modRequest: { platformProjectRoot: '/private/tmp/not-created-by-test', projectRoot: '/private/tmp/not-created-by-test' },
  });
  assert.equal(result.modResults.manifest.application[0].$['android:allowBackup'], 'false');
  assert.equal(result.modResults.manifest.application[0].$['android:fullBackupContent'], 'false');
  assert.equal(typeof config.mods.android.dangerous, 'function');
});

test('SecureStore custom-backup mode preserves our extraction rules and the transport policy', async () => {
  const imported = require('expo-secure-store/app.plugin');
  const secureStore = imported.default || imported;
  let config = secureStore({ name: 'QLDU', slug: 'qldu-test' }, { configureAndroidBackup: false });
  config = plugin(config);
  config = require('../plugins/withSecureTransport')(config, { development: false });
  const result = await config.mods.android.manifest({
    ...config,
    modResults: { manifest: { application: [{ $: { 'android:name': '.MainApplication' } }] } },
    modRequest: { platformProjectRoot: '/private/tmp/not-created-by-test', projectRoot: '/private/tmp/not-created-by-test' },
  });
  const attrs = result.modResults.manifest.application[0].$;
  assert.equal(attrs['android:allowBackup'], 'false');
  assert.equal(attrs['android:fullBackupContent'], 'false');
  assert.equal(attrs['android:dataExtractionRules'], '@xml/' + plugin.RESOURCE_NAME);
  assert.equal(attrs['android:usesCleartextTraffic'], 'false');
});
