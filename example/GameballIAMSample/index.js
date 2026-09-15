/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// React Native's development warning banner sits at the bottom of the screen, which is exactly
// where a bottom slide-up draws — so every screenshot of one was a screenshot of the banner. The
// warnings still reach the console, and the QA panel still forwards the SDK's own log lines.
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
