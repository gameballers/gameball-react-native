/**
 * The driver's channel into this app.
 *
 * A simulator cannot be typed into, so the QA run talks HTTP: the panel posts every log line to a
 * collector on the developer's machine and polls the same collector for commands. Both halves
 * live in this sample; the SDK knows nothing about either.
 *
 * Lines are buffered rather than posted directly, because iOS suspends the app mid-post when it
 * goes to the background — and the app-state evidence is exactly what a session case needs to
 * read afterwards.
 */
export type CommandHandler = (params: URLSearchParams) => unknown;

export interface QaChannel {
  report(line: string): void;
  stop(): void;
}

export function startQaChannel(options: {
  reportUrl?: string;
  log: (line: string) => void;
  handlers: Record<string, CommandHandler>;
}): QaChannel {
  const { reportUrl, log, handlers } = options;
  const outbox: { t: number; line: string }[] = [];
  let draining = false;
  let stopped = false;

  const drain = async (): Promise<void> => {
    if (draining || !reportUrl) {
      return;
    }
    draining = true;
    try {
      while (outbox.length > 0) {
        const entry = outbox[0]!;
        const response = await fetch(`${reportUrl}/log`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entry),
        });
        if (!response.ok) {
          break;
        }
        outbox.shift();
      }
    } catch {
      // Suspended, or no collector listening: the lines wait for the next drain.
    } finally {
      draining = false;
    }
  };

  const dispatch = async (
    name: string,
    params: URLSearchParams
  ): Promise<void> => {
    const handler = handlers[name];
    if (!handler) {
      log(`cmd unknown ${name}`);
      return;
    }
    log(`cmd ${name} ${params.toString()}`.trim());
    try {
      await handler(params);
    } catch (error) {
      log(`cmd ${name} failed (${String(error)})`);
    }
  };

  const poll = async (): Promise<void> => {
    if (!reportUrl || stopped) {
      return;
    }
    void drain();
    try {
      const response = await fetch(`${reportUrl}/cmd`);
      if (response.status !== 200) {
        return;
      }
      const command = (await response.json()) as {
        name?: string;
        query?: string;
      };
      if (command?.name) {
        await dispatch(command.name, new URLSearchParams(command.query ?? ''));
      }
    } catch {
      // No collector on the other end; this sample still works by hand.
    }
  };

  const timer = reportUrl ? setInterval(() => void poll(), 500) : null;
  if (reportUrl) {
    log('cmd channel polling the QA collector');
  }

  return {
    report(line: string) {
      if (!reportUrl) {
        return;
      }
      outbox.push({ t: Date.now(), line });
      if (outbox.length > 500) {
        outbox.splice(0, outbox.length - 500);
      }
      void drain();
    },
    stop() {
      stopped = true;
      if (timer) {
        clearInterval(timer);
      }
    },
  };
}
