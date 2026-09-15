# Gameball in-app messaging — React Native sample

A plain React Native app that integrates the SDK's in-app messaging and carries the QA driver
panel the web and Ionic samples use, so one driver runs the same case list against every SDK.

## Setup

```bash
cp src/config.local.example.ts src/config.local.ts   # then add the alpha API key
npm install --legacy-peer-deps
npm run pods                                          # iOS only
npm run ios
```

`src/config.local.ts` is gitignored: the key never enters a tracked file.

## What to look at

- `App.tsx` — `<GameballInAppMessages />` mounted once near the root. That component is where
  messages are drawn; without it the SDK holds them rather than counting impressions nobody could
  see.
- `src/gameball.ts` — `init` at module load, and the promise it returns. `init` is asynchronous and
  every network-facing method refuses until it resolves, so starting it from a component effect
  leaves a window in which the app is interactive and the SDK is not ready. A child's effect runs
  before its parent's, which is how the QA panel found that window.
- `src/QaPanel.tsx` — identify, start, stop and fire, plus the command names the simulator driver
  sends (`ping`, `identify`, `start`, `fire`, `orientation`, `probe`, `overlay`, `purchase`).
- `src/qa-channel.ts` — the HTTP channel to the driver: log lines out, commands in. Lines are
  buffered because iOS suspends the app mid-post when it backgrounds, which is exactly the
  evidence a session case needs to read afterwards.

Everything in `src/qa-*.ts` and `src/QaPanel.tsx` exists for the QA run. An app integrating the SDK
needs the two calls in `src/gameball.ts` and `App.tsx`, and nothing else.

## About `react-native-safe-area-context`

Installed here on purpose. The SDK reads the device's safe-area insets from it when an app has it,
so messages clear the notch and the home indicator without the app doing anything. It is optional:
without it the SDK falls back to the status-bar height on Android and to zero elsewhere, and an app
can always pass exact insets to `<GameballInAppMessages />` instead.
