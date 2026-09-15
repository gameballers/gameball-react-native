/* eslint-disable no-bitwise -- Packed colour values from the wire are unpacked with shifts and masks. */
import { iamLog } from '../log';
import type { Campaign } from '../models/campaign';
import {
  MAX_MODAL_BUTTONS,
  type ButtonStyle,
  type ClickAction,
  type InAppMessage,
  type MessageButton,
  type MessageLayout,
  type MessageOrientation,
  type MessageStyle,
  type MessageType,
  type SlidePosition,
  type TextAlign,
} from '../models/message';
import { parseOperator, type PropertyFilter } from '../models/property-filter';
import { parseQuietHours } from '../models/quiet-hours';
import type { MessageTrigger } from '../models/trigger';
import {
  DEFAULT_DISPLAY_COOLDOWN_MS,
  emptySyncResult,
  type SyncResult,
} from './sync-result';

/** How long a slideup stays when the campaign names no duration. */
export const DEFAULT_SLIDEUP_AUTO_DISMISS_MS = 8_000;

const MESSAGE_TYPE_NAMES: Record<number, string> = {
  1: 'slideup',
  2: 'modal',
  3: 'fullscreen',
  4: 'htmlFullscreen',
  5: 'emailCapture',
};

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const asString = (v: unknown): string | null =>
  typeof v === 'string' ? v : null;
const asBool = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;
function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number(v);
  return null;
}
function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function asUrl(v: unknown): string | null {
  const s = asString(v)?.trim();
  return s ? s : null;
}

/** Parses an `inapp-messages/sync` response. Never throws; drops what can never work, keeps-but-skips what a later SDK may render, logs every decision. */
export function parseSyncResponse(rawJson: string): SyncResult {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawJson);
  } catch (error) {
    iamLog(`sync parse failed: payload is not valid JSON (${String(error)})`);
    return emptySyncResult();
  }
  if (!isObject(decoded)) {
    iamLog('sync parse failed: payload root is not an object');
    return emptySyncResult();
  }
  const messages = decoded.messages;
  if (!Array.isArray(messages)) {
    iamLog('sync parse failed: "messages" is missing or not a list');
    return emptySyncResult();
  }

  const campaigns: Campaign[] = [];
  for (const entry of messages) {
    if (!isObject(entry)) {
      iamLog('campaign skipped: entry is not an object');
      continue;
    }
    const campaign = parseCampaign(entry);
    if (campaign) campaigns.push(campaign);
  }

  const cooldownSeconds = asInt(decoded.cooldownSeconds);
  return {
    campaigns,
    cooldownMs:
      cooldownSeconds === null || cooldownSeconds < 0
        ? DEFAULT_DISPLAY_COOLDOWN_MS
        : cooldownSeconds * 1000,
    quietHours: parseQuietHours(decoded.quietHours),
    rawJson,
  };
}

function parseCampaign(json: Json): Campaign | null {
  const campaignId = asInt(json.campaignId);
  if (campaignId === null) {
    iamLog('campaign dropped: missing or non-numeric "campaignId"');
    return null;
  }
  const name = asString(json.name);
  const label = name === null ? `${campaignId}` : `${campaignId} (${name})`;

  const contentMode = asString(json.contentMode);
  if (contentMode !== null && contentMode.toLowerCase() !== 'prerendered') {
    iamLog(
      `campaign ${label} skipped: unsupported contentMode "${contentMode}" (this SDK renders "prerendered" only)`
    );
    return null;
  }

  const trigger = parseTrigger(json.trigger, label);
  if (!trigger) return null;
  const message = parseMessage(
    json,
    label,
    campaignId,
    asBool(json.isTest) ?? false
  );
  if (!message) return null;

  const triggerJson = isObject(json.trigger) ? json.trigger : {};
  const minIntervalSeconds = asInt(triggerJson.minIntervalSeconds);
  return {
    campaignId,
    variationId: asInt(json.variationId),
    dispatchId: asString(json.dispatchId),
    name,
    trigger,
    priority: asInt(json.priority) ?? 0,
    message,
    expiresAt: parseTimestamp(json.expiresAt, label),
    isTest: asBool(json.isTest) ?? false,
    repeatable: asBool(triggerJson.repeatable) ?? false,
    minIntervalMs:
      minIntervalSeconds !== null && minIntervalSeconds > 0
        ? minIntervalSeconds * 1000
        : null,
  };
}

function parseTrigger(json: unknown, label: string): MessageTrigger | null {
  if (!isObject(json)) {
    iamLog(`campaign ${label} dropped: "trigger" is missing or not an object`);
    return null;
  }
  const type = asString(json.type)?.toLowerCase();
  switch (type) {
    case 'session_start':
      return { kind: 'session_start' };
    case 'event':
    case 'custom_event': {
      const eventName = asString(json.name);
      if (!eventName) {
        iamLog(
          `campaign ${label} dropped: event trigger has no "name" (eventId ${String(
            json.eventId
          )} cannot be resolved on the device)`
        );
        return null;
      }
      const filters = parseFilters(json.metadataFilters ?? json.filters, label);
      if (filters === null) return null;
      const logical = asString(json.metadataLogicalOperator)?.toLowerCase();
      if (logical !== undefined && logical !== 'and') {
        iamLog(
          `campaign ${label} dropped: metadataLogicalOperator "${logical}" is not supported (this SDK evaluates filters with AND)`
        );
        return null;
      }
      return { kind: 'event', eventName, filters };
    }
    default:
      iamLog(
        `campaign ${label} dropped: unsupported trigger type "${String(
          type
        )}" (this SDK supports session_start and event)`
      );
      return null;
  }
}

/** Null = skip the whole campaign (a filter we cannot name would silently widen it). */
function parseFilters(json: unknown, label: string): PropertyFilter[] | null {
  if (json === null || json === undefined) return [];
  if (!Array.isArray(json)) {
    iamLog(`campaign ${label}: filters are not a list, ignoring`);
    return [];
  }
  const filters: PropertyFilter[] = [];
  for (const entry of json) {
    if (!isObject(entry)) {
      iamLog(`campaign ${label}: filter skipped, entry is not an object`);
      continue;
    }
    const property = asString(entry.name);
    if (!property) {
      iamLog(
        `campaign ${label} dropped: filter has no metadata name (metadataId ${String(
          entry.metadataId
        )} cannot be resolved on the device)`
      );
      return null;
    }
    const operator = parseOperator(entry.operator);
    if (!operator) {
      iamLog(
        `campaign ${label}: filter on "${property}" dropped, unsupported operator "${String(
          entry.operator
        )}"`
      );
      continue;
    }
    if (entry.value === null || entry.value === undefined) {
      iamLog(`campaign ${label}: filter on "${property}" dropped, no "value"`);
      continue;
    }
    filters.push({ property, operator, value: entry.value });
  }
  return filters;
}

function parseMessage(
  json: Json,
  label: string,
  campaignId: number,
  isTest: boolean
): InAppMessage | null {
  const content: Json = isObject(json.content) ? json.content : {};
  const locale: Json = isObject(json.locale) ? json.locale : {};
  const variationId = asInt(json.variationId);
  const id =
    variationId === null ? `${campaignId}` : `${campaignId}/${variationId}`;

  const typeNumber = asInt(json.messageType);
  const type: MessageType =
    typeNumber === 1
      ? 'slideup'
      : typeNumber === 2
      ? 'modal'
      : typeNumber === 3
      ? 'fullscreen'
      : 'unsupported';
  if (type === 'unsupported') {
    iamLog(
      `campaign ${label} has messageType ${String(typeNumber)} (${
        MESSAGE_TYPE_NAMES[typeNumber ?? -1] ?? 'unknown'
      }) — kept, but this SDK version renders slideup, modal and fullscreen only`
    );
  }

  const header = asString(locale.header);
  const body = asString(locale.message) ?? asString(locale.body);
  const imageUrl = artworkUrl(content, type, label);
  const iconUrl = asUrl(content.iconUrl);
  const hasHeader = !!header;
  const hasBody = !!body;
  const hasImage = !!imageUrl;

  if (type === 'slideup') {
    if (!hasHeader && !hasBody) {
      iamLog(
        `campaign ${label} dropped: a slideup needs text, and this one has none`
      );
      return null;
    }
  } else if (!hasHeader && !hasBody && !hasImage) {
    iamLog(
      `campaign ${label} dropped: no header, message or imageUrl — nothing to render`
    );
    return null;
  }

  let buttons = parseButtons(content.buttons, locale.buttons, label);
  if (type === 'slideup' && buttons.length > 0) {
    iamLog(
      `campaign ${label}: ${buttons.length} button(s) ignored — a slideup has no buttons; its whole surface is the tap target`
    );
    buttons = [];
  }

  const autoSeconds = asNum(content.autoDismissSeconds);
  const close = parseCloseBehaviour(content.closeBehaviour, type, label);
  let autoDismissMs: number | null;
  if (autoSeconds === null) {
    autoDismissMs = type === 'slideup' ? DEFAULT_SLIDEUP_AUTO_DISMISS_MS : null;
    if (type === 'slideup')
      iamLog(
        `campaign ${label}: slideup has no autoDismissSeconds, applying the 8s default so it cannot sit over the host's app bar indefinitely`
      );
  } else {
    autoDismissMs = autoSeconds > 0 ? Math.round(autoSeconds * 1000) : null;
  }

  return {
    id,
    campaignId,
    variationId,
    isTest,
    type,
    header: hasHeader ? header : null,
    body: hasBody ? body : null,
    imageUrl: hasImage ? imageUrl : null,
    iconUrl,
    clickAction: parseOptionalAction(content.action, id),
    showCloseButton: close.showCloseButton,
    dismissOnScrimTap: close.dismissOnScrimTap,
    autoDismissMs,
    layout: resolveLayout(content.layout, type, label),
    orientation: parseOrientation(content.orientation, label),
    slidePosition: parseSlidePosition(content.slideFrom, label),
    buttons,
    extras: parseExtras(content.extras),
    style: parseMessageStyle(content.colors, content.textAlignment),
  };
}

function resolveLayout(
  declared: unknown,
  type: MessageType,
  label: string
): MessageLayout {
  const value = asString(declared)?.toLowerCase();
  switch (value) {
    case 'image_only':
      return 'image_only';
    case 'text_with_image':
    case 'image_and_text':
    case undefined:
      return 'text_with_image';
    default:
      iamLog(
        `campaign ${label}: unknown layout "${value}", rendering the default for a ${type}`
      );
      return 'text_with_image';
  }
}

function parseOrientation(value: unknown, label: string): MessageOrientation {
  switch (asString(value)?.toLowerCase()) {
    case 'portrait':
      return 'portrait';
    case 'landscape':
      return 'landscape';
    case 'any':
    case undefined:
      return 'any';
    default:
      iamLog(
        `campaign ${label}: unknown orientation "${String(
          value
        )}", allowing any`
      );
      return 'any';
  }
}

function parseSlidePosition(value: unknown, label: string): SlidePosition {
  switch (asString(value)?.toLowerCase()) {
    case 'top':
      return 'top';
    case 'bottom':
    case undefined:
      return 'bottom';
    default:
      iamLog(
        `campaign ${label}: unknown slideFrom "${String(value)}", using bottom`
      );
      return 'bottom';
  }
}

function parseCloseBehaviour(
  value: unknown,
  type: MessageType,
  label: string
): { showCloseButton: boolean; dismissOnScrimTap: boolean } {
  switch (asString(value)?.toLowerCase()) {
    case 'button':
      return { showCloseButton: true, dismissOnScrimTap: false };
    case 'swipe':
      if (type === 'fullscreen') {
        iamLog(
          `campaign ${label}: closeBehaviour "swipe" on a fullscreen message would leave no way out — offering the close button as well`
        );
        return { showCloseButton: true, dismissOnScrimTap: true };
      }
      return { showCloseButton: false, dismissOnScrimTap: true };
    case 'both':
    case undefined:
      return { showCloseButton: true, dismissOnScrimTap: true };
    default:
      iamLog(
        `campaign ${label}: unknown closeBehaviour "${String(
          value
        )}", offering both`
      );
      return { showCloseButton: true, dismissOnScrimTap: true };
  }
}

function parseButtons(
  contentJson: unknown,
  localeJson: unknown,
  label: string
): MessageButton[] {
  if (!Array.isArray(contentJson)) return [];
  const labels = new Map<string, string>();
  if (Array.isArray(localeJson)) {
    for (const entry of localeJson) {
      if (!isObject(entry)) continue;
      const id = asString(entry.id);
      const text = asString(entry.text);
      if (id && text) labels.set(id, text);
    }
  }
  const buttons: MessageButton[] = [];
  for (const entry of contentJson) {
    if (!isObject(entry)) {
      iamLog(`campaign ${label}: button skipped, entry is not an object`);
      continue;
    }
    const id = asString(entry.id);
    if (!id) {
      iamLog(
        `campaign ${label}: button dropped, missing "id" — there is no way to pair it with a label or report a click for it`
      );
      continue;
    }
    const text = labels.get(id) ?? asString(entry.text);
    if (!text) {
      iamLog(
        `campaign ${label}: button "${id}" dropped, no label for it in the locale block`
      );
      continue;
    }
    buttons.push({
      id,
      text,
      action: parseAction(entry.action, label),
      style: parseButtonStyle(entry.colors ?? entry.style),
    });
  }
  if (buttons.length > MAX_MODAL_BUTTONS) {
    iamLog(
      `campaign ${label}: ${buttons.length} buttons provided, keeping the first ${MAX_MODAL_BUTTONS}`
    );
    return buttons.slice(0, MAX_MODAL_BUTTONS);
  }
  return buttons;
}

function parseTimestamp(value: unknown, label: string): number | null {
  const raw = asString(value);
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    iamLog(`campaign ${label}: ignoring unparseable timestamp "${raw}"`);
    return null;
  }
  return ms;
}

function parseNavigate(json: Json, messageId: string): ClickAction | null {
  const route = asString(json.route);
  if (!route) {
    iamLog(`message "${messageId}": navigate action has no "route"`);
    return null;
  }
  let args: Record<string, unknown> | undefined;
  if (isObject(json.arguments)) {
    args = {};
    for (const [k, v] of Object.entries(json.arguments))
      if (v !== null && v !== undefined) args[k] = v;
  }
  return { type: 'navigate', route, arguments: args };
}

/** A button must do something: an unusable action degrades to dismiss. */
function parseAction(json: unknown, messageId: string): ClickAction {
  if (!isObject(json)) return { type: 'dismiss' };
  const type = asString(json.type)?.toLowerCase();
  switch (type) {
    case 'dismiss':
      return { type: 'dismiss' };
    case 'open_url': {
      const url = asString(json.url);
      if (!url) {
        iamLog(
          `message "${messageId}": open_url action has no "url", using dismiss`
        );
        return { type: 'dismiss' };
      }
      return {
        type: 'open_url',
        url,
        external: asBool(json.external) ?? false,
      };
    }
    case 'navigate':
      return parseNavigate(json, messageId) ?? { type: 'dismiss' };
    case 'request_push_permission':
      return { type: 'request_push_permission' };
    default:
      iamLog(
        `message "${messageId}": unsupported action type "${String(
          type
        )}", using dismiss`
      );
      return { type: 'dismiss' };
  }
}

/** The message-level action: absent or unusable means "not tappable". */
function parseOptionalAction(
  json: unknown,
  messageId: string
): ClickAction | null {
  if (json === null || json === undefined) return null;
  if (!isObject(json)) {
    iamLog(`message "${messageId}": "action" is not an object, ignoring`);
    return null;
  }
  const type = asString(json.type)?.toLowerCase();
  switch (type) {
    case 'dismiss':
      return { type: 'dismiss' };
    case 'open_url': {
      const url = asString(json.url);
      if (!url) {
        iamLog(
          `message "${messageId}": message action open_url has no "url", leaving the message untappable`
        );
        return null;
      }
      return {
        type: 'open_url',
        url,
        external: asBool(json.external) ?? false,
      };
    }
    case 'navigate':
      return parseNavigate(json, messageId);
    case 'request_push_permission':
      return { type: 'request_push_permission' };
    default:
      iamLog(
        `message "${messageId}": unsupported message action type "${String(
          type
        )}", leaving the message untappable`
      );
      return null;
  }
}

function parseButtonStyle(json: unknown): ButtonStyle {
  if (!isObject(json)) return {};
  const style: ButtonStyle = {};
  const bg = parseColor(json.background ?? json.backgroundColor);
  const text = parseColor(json.text ?? json.textColor);
  const border = parseColor(json.border ?? json.borderColor);
  if (bg) style.backgroundColor = bg;
  if (text) style.textColor = text;
  if (border) style.borderColor = border;
  return style;
}

/** `content.colors` = {background, text, header, closeButton, border, frame}; `frame` is read as the scrim. */
function parseMessageStyle(
  colorsJson: unknown,
  alignJson: unknown
): MessageStyle {
  const colors: Json = isObject(colorsJson) ? colorsJson : {};
  const align: Json = isObject(alignJson) ? alignJson : {};
  const style: MessageStyle = {};
  const set = (key: keyof MessageStyle, value: string | null) => {
    if (value) (style as Record<string, string>)[key] = value;
  };
  set(
    'backgroundColor',
    parseColor(colors.background ?? colors.backgroundColor)
  );
  set('headerColor', parseColor(colors.header ?? colors.headerColor));
  set('bodyColor', parseColor(colors.text ?? colors.bodyColor));
  set('scrimColor', parseColor(colors.frame ?? colors.scrimColor));
  set(
    'closeButtonColor',
    parseColor(colors.closeButton ?? colors.closeButtonColor)
  );
  const h = parseAlign(align.header ?? align.headerAlign);
  const b = parseAlign(align.body ?? align.bodyAlign);
  if (h) style.headerAlign = h;
  if (b) style.bodyAlign = b;
  return style;
}

function parseAlign(value: unknown): TextAlign | null {
  switch (asString(value)?.toLowerCase()) {
    case 'left':
      return 'left';
    case 'right':
      return 'right';
    case 'center':
      return 'center';
    case 'start':
      return 'start';
    case 'end':
      return 'end';
    default:
      return null;
  }
}

function parseExtras(json: unknown): Record<string, string> {
  if (!isObject(json)) return {};
  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(json))
    if (v !== null && v !== undefined)
      extras[k] = typeof v === 'string' ? v : String(v);
  return extras;
}

/** Fullscreen artwork lives in `content.media`, modals in `content.imageUrl`; each falls back to the other. Video is ignored. */
function artworkUrl(
  content: Json,
  type: MessageType,
  label: string
): string | null {
  const direct = asUrl(content.imageUrl);
  let fromMedia: string | null = null;
  if (isObject(content.media)) {
    const mediaType = asString(content.media.type)?.toLowerCase();
    if (mediaType === undefined || mediaType === 'image')
      fromMedia = asUrl(content.media.url);
    else
      iamLog(
        `campaign ${label}: ignoring "${mediaType}" media — this SDK version renders images only`
      );
  }
  return type === 'fullscreen' ? fromMedia ?? direct : direct ?? fromMedia;
}

/** `#RRGGBB` / `#AARRGGBB` (hash optional) or a packed ARGB int → CSS colour. */
export function parseColor(value: unknown): string | null {
  let argb: number;
  if (typeof value === 'number' && Number.isInteger(value)) {
    argb = value >>> 0;
  } else if (typeof value === 'string') {
    let hex = value.trim();
    if (hex.startsWith('#')) hex = hex.slice(1);
    if (hex.length === 6) hex = `FF${hex}`;
    if (hex.length !== 8 || !/^[0-9a-fA-F]{8}$/.test(hex)) {
      iamLog(`ignoring malformed colour "${value}"`);
      return null;
    }
    argb = parseInt(hex, 16) >>> 0;
  } else {
    return null;
  }
  const a = (argb >>> 24) & 0xff;
  const r = (argb >>> 16) & 0xff;
  const g = (argb >>> 8) & 0xff;
  const b = argb & 0xff;
  const hex2 = (n: number) => n.toString(16).padStart(2, '0');
  if (a === 0xff) return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
}
