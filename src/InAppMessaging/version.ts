const packageJson = require('../../package.json');

/** Sent on every request as `react-native/<version>`, so the wire says which SDK spoke. */
export const SDK_VERSION: string = packageJson.version;
