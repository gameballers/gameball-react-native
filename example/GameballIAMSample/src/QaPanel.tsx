import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import GameballApp, {
  inAppMessaging,
  type InAppMessage,
} from 'react-native-gameball';
import { config } from './config';
import { gameballReady } from './gameball';
import { startQaChannel, type QaChannel } from './qa-channel';

/**
 * The same QA driver panel the web and Ionic samples carry, in React Native: the same command
 * names, the same log lines, so one driver runs the case list against every SDK.
 */
export function QaPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [status, setStatus] = useState('Messages off');
  const [customer, setCustomer] = useState(config?.customerId ?? '');
  const [eventName, setEventName] = useState('');
  const channel = useRef<QaChannel | null>(null);
  const latest = useRef({ customer, eventName });
  latest.current = { customer, eventName };

  const log = useCallback((line: string) => {
    const stamped = `${new Date().toISOString().slice(11, 23)} ${line}`;
    channel.current?.report(stamped);
    setLines((prev) => [...prev.slice(-199), stamped]);
  }, []);

  useEffect(() => {
    const cfg = config;
    if (!cfg) {
      log(
        'src/config.local.ts is missing — copy config.local.example.ts and add the alpha key'
      );
      return;
    }

    // Mirror the SDK's diagnostics into the panel and out to the collector.
    const nativeLog = console.log.bind(console);
    console.log = (...args: unknown[]) => {
      nativeLog(...args);
      if (typeof args[0] === 'string' && args[0].startsWith('[GameballIAM]')) {
        log(args.join(' ').replace('[GameballIAM] ', ''));
      }
    };

    const off = GameballApp.getInstance().onInAppMessage((m: InAppMessage) => {
      log(`selected ${m.type} ${m.id}: ${m.header ?? ''} ${m.body ?? ''}`.trim());
    });

    const appStateSub = AppState.addEventListener('change', (s) =>
      log(`app state ${s}`)
    );

    const app = GameballApp.getInstance();
    // A driver cannot tap a simulator, so the panel observes the presenter and acts through the
    // callbacks the view would have called. Observing is not a surface: the SDK still needs the
    // mounted host to draw.
    let showing: {
      type: string;
      buttons: { id: string }[];
      tapSurface: () => void;
      tapButton: (index: number) => void;
    } | null = null;
    const stopObserving = inAppMessaging.presenter.observe((entry) => {
      showing = entry
        ? {
            type: entry.message.type,
            buttons: entry.message.buttons,
            tapSurface: () => entry.callbacks.onMessagePressed(),
            tapButton: (index: number) => {
              const button = entry.message.buttons[index];
              if (button) {
                entry.callbacks.onButtonPressed(button);
              }
            },
          }
        : null;
    });

    const identify = async (id: string) => {
      // Nothing here may run before init has resolved; see src/gameball.ts.
      await gameballReady;
      await app.initializeCustomer({
        customerId: id,
        customerAttributes: { preferredLanguage: cfg.lang },
      });
      log(`identified ${id}`);
    };
    const fire = async (name: string, meta: Record<string, unknown>) => {
      await gameballReady;
      log(`fire ${name} ${JSON.stringify(meta)}`);
      await app.sendEvent({
        customerId: latest.current.customer.trim(),
        events: { [name]: meta },
      });
    };

    channel.current = startQaChannel({
      reportUrl: cfg.reportUrl,
      log,
      handlers: {
        ping: () => log('pong'),
        orientation: () => {
          const { width, height } = Dimensions.get('window');
          return log(
            `orientation ${width > height ? 'landscape' : 'portrait'} ${Math.round(width)}x${Math.round(height)}`
          );
        },
        probe: () =>
          log(
            `probe started=${String(app.isInAppMessagingStarted)} customer=${latest.current.customer}`
          ),
        identify: async (p) => {
          const who = (p.get('customer') ?? latest.current.customer).trim();
          setCustomer(who);
          latest.current.customer = who;
          await identify(who);
        },
        start: async (p) => {
          await gameballReady;
          const who = (p.get('customer') ?? latest.current.customer).trim();
          await app.startInAppMessaging({
            customerId: who,
            onNavigate: (route, args) =>
              log(`onNavigate ${route} ${JSON.stringify(args ?? {})}`),
            onAction: (m, button, action) => {
              log(
                `onAction ${m.id} ${button ? `button ${button.id}` : 'surface'} → ${action.type}`
              );
              return false;
            },
            beforeDisplay: (m) => {
              log(`beforeDisplay ${m.id} → show`);
              return 'show';
            },
            requestPushPermission: async () => {
              log('push permission requested by the campaign');
              return false;
            },
          });
        },
        stop: () => app.stopInAppMessaging(),
        fire: async (p) => {
          const name = (p.get('event') ?? latest.current.eventName).trim();
          const meta: Record<string, unknown> = {};
          for (const entry of (p.get('meta') ?? '').split(',').filter(Boolean)) {
            const [k, ...rest] = entry.split(':');
            const value = rest.join(':').trim();
            if (k?.trim()) {
              meta[k.trim()] =
                value !== '' && !Number.isNaN(Number(value))
                  ? Number(value)
                  : value;
            }
          }
          await fire(name, meta);
        },
        purchase: async (p) =>
          fire('purchase', { price: Number(p.get('price') ?? 120) }),
        dismiss: () => {
          if (inAppMessaging.presenter.isShowing) {
            inAppMessaging.presenter.dismiss();
          }
        },
        'probe-dom': () => log(`probe-dom layer=${showing?.type ?? 'none'}`),
        'tap-surface': () => {
          if (showing) {
            showing.tapSurface();
          } else {
            log('tap-surface found nothing');
          }
        },
        'tap-button': (p) => {
          const index = Number(p.get('index') ?? 0);
          if (showing) {
            showing.tapButton(index);
          } else {
            log('tap-button found nothing');
          }
        },
        // Links leave for the system browser on this platform; the driver foregrounds the app.
        'browser-close': () => log('browser-close: nothing to close on React Native'),
        clear: async () => {
          const storage = require('@react-native-async-storage/async-storage').default;
          const keys: string[] = await storage.getAllKeys();
          await storage.multiRemove(keys.filter((k) => k.startsWith('gameball_iam_')));
          log('SDK storage cleared');
        },
        overlay: (p) => {
          const open = p.get('open') !== '0';
          app.setOverlayOpen(open);
          log(`host overlay ${open ? 'open' : 'closed'}`);
        },
      },
    });

    const tick = setInterval(
      () => setStatus(app.isInAppMessagingStarted ? 'Messages on' : 'Messages off'),
      1000
    );
    log('ready — Identify, then Start');

    return () => {
      console.log = nativeLog;
      off();
      stopObserving();
      appStateSub.remove();
      clearInterval(tick);
      channel.current?.stop();
    };
  }, [log]);

  const app = GameballApp.getInstance();

  return (
    <View style={styles.panel}>
      <View style={styles.row}>
        <Text style={styles.chip} testID="qa-status">
          {status}
        </Text>
        <TextInput
          testID="qa-customer"
          style={styles.input}
          value={customer}
          onChangeText={setCustomer}
          autoCapitalize="none"
        />
        <Button
          id="qa-identify"
          label="Identify"
          onPress={async () => {
            await gameballReady;
            await app.initializeCustomer({
              customerId: customer.trim(),
              customerAttributes: { preferredLanguage: config?.lang ?? 'en' },
            });
            log(`identified ${customer.trim()}`);
          }}
        />
        <Button
          id="qa-start"
          label="Start"
          onPress={async () => {
            await gameballReady;
            await app.startInAppMessaging({ customerId: customer.trim() });
          }}
        />
        <Button
          id="qa-stop"
          label="Stop"
          onPress={() => app.stopInAppMessaging()}
        />
      </View>
      <View style={styles.row}>
        <TextInput
          testID="qa-event-name"
          style={styles.input}
          placeholder="qa_show"
          value={eventName}
          onChangeText={setEventName}
          autoCapitalize="none"
        />
        <Button
          id="qa-fire"
          label="Fire"
          onPress={async () => {
            await gameballReady;
            log(`fire ${eventName.trim()} {}`);
            await app.sendEvent({
              customerId: customer.trim(),
              events: { [eventName.trim()]: {} },
            });
          }}
        />
      </View>
      <ScrollView style={styles.log} testID="qa-log">
        <Text style={styles.logText}>{lines.join('\n')}</Text>
      </ScrollView>
    </View>
  );
}

function Button({
  id,
  label,
  onPress,
}: {
  id: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable testID={id} onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1, padding: 12, borderTopWidth: 2, borderTopColor: '#bbb' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, alignItems: 'center' },
  chip: {
    backgroundColor: '#ece8ff',
    color: '#5a3fe0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 140,
    fontSize: 14,
  },
  button: {
    backgroundColor: '#5a3fe0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  log: { flex: 1, backgroundColor: '#13161c', borderRadius: 8, padding: 10 },
  logText: { color: '#d7dbe3', fontFamily: 'Menlo', fontSize: 11, lineHeight: 16 },
});
