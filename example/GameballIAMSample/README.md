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

- `App.tsx` — `init` at start-up, and `<GameballInAppMessages />` mounted once near the root.
  That component is where messages are drawn; without it the SDK holds them rather than counting
  impressions nobody could see.
- `src/QaPanel.tsx` — identify, start, stop and fire, plus the command names the simulator driver
  sends (`ping`, `identify`, `start`, `fire`, `orientation`, `probe`, `overlay`, `purchase`).
- `src/qa-channel.ts` — the HTTP channel to the driver: log lines out, commands in. Lines are
  buffered because iOS suspends the app mid-post when it backgrounds, which is exactly the
  evidence a session case needs to read afterwards.

Everything in `src/qa-*.ts` exists for the QA run. An app integrating the SDK needs `App.tsx`'s
two calls and nothing else.
