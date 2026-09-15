const path = require('path');
const escape = require('escape-string-regexp');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const root = path.resolve(__dirname, '../..');
const pkg = require('../../package.json');

/**
 * The SDK lives outside this app, linked from the repository root.
 *
 * Metro does not follow a link out of the project on its own, so the library's folder is watched
 * explicitly and its package name is mapped to it. The library's own copies of react and
 * react-native are blocked and resolved to the app's: two Reacts in one bundle is the classic
 * "invalid hook call", and the peers belong to the app.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
/**
 * The app's copies of these belong to the app, not to the library.
 *
 * Peers, plus the packages the SDK resolves optionally at runtime: those live in the app, and a
 * library linked from outside `node_modules` cannot walk up to find them the way an installed one
 * would.
 */
const optional = ['react-native-safe-area-context'];
const peers = [...Object.keys(pkg.peerDependencies ?? {}), ...optional];

const config = {
  watchFolders: [root],
  resolver: {
    // A plain list: metro-config no longer exports its exclusionList helper.
    blockList: peers.map(
      (name) =>
        new RegExp(`^${escape(path.join(root, 'node_modules', name))}\\/.*$`)
    ),
    extraNodeModules: peers.reduce(
      (acc, name) => {
        acc[name] = path.join(__dirname, 'node_modules', name);
        return acc;
      },
      { [pkg.name]: root }
    ),
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
