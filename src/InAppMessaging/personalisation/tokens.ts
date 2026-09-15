import { buttonWithText, withText, type InAppMessage } from '../models/message';

/** `{token_name}` — a single brace pair around a bare identifier. Deliberately strict. */
const TOKEN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const hasToken = (text: string | null): boolean =>
  !!text && text.includes('{') && new RegExp(TOKEN.source).test(text);

export function messageHasTokens(message: InAppMessage): boolean {
  return (
    hasToken(message.header) ||
    hasToken(message.body) ||
    message.buttons.some((b) => hasToken(b.text))
  );
}

export function tokensIn(message: InAppMessage): Set<string> {
  const found = new Set<string>();
  for (const text of [
    message.header,
    message.body,
    ...message.buttons.map((b) => b.text),
  ]) {
    if (!text || !text.includes('{')) continue;
    for (const match of text.matchAll(TOKEN)) found.add(match[1]!);
  }
  return found;
}

/** One pass; unknown tokens are left exactly as written so a caller can tell resolved from unresolved. */
export function substituteTokens(
  text: string,
  values: Record<string, string>
): string {
  if (!text.includes('{') || Object.keys(values).length === 0) return text;
  return text.replace(TOKEN, (whole, name: string) =>
    name in values ? values[name]! : whole
  );
}

export function substituteInto(
  message: InAppMessage,
  values: Record<string, string>
): InAppMessage {
  if (Object.keys(values).length === 0) return message;
  return withText(message, {
    header:
      message.header === null ? null : substituteTokens(message.header, values),
    body: message.body === null ? null : substituteTokens(message.body, values),
    buttons: message.buttons.map((b) =>
      buttonWithText(b, substituteTokens(b.text, values))
    ),
  });
}

/** The last step before display, on every path: nothing reaches the screen with braces in it. */
export function clearUnresolvedTokens(message: InAppMessage): InAppMessage {
  if (!messageHasTokens(message)) return message;
  const blank = (text: string) =>
    text.includes('{') ? text.replace(TOKEN, '') : text;
  return withText(message, {
    header: message.header === null ? null : blank(message.header),
    body: message.body === null ? null : blank(message.body),
    buttons: message.buttons.map((b) => buttonWithText(b, blank(b.text))),
  });
}
