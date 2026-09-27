/**
 * Which sequence an id belongs to.
 *
 * Not cosmetic. The backend's contract states that challenge ids and message campaign ids are
 * separate sequences that overlap numerically, so a bare number cannot identify a campaign once
 * both kinds share one list.
 */
export type CampaignKind = 'message' | 'game';

/**
 * Identifies one campaign across both kinds, as its storage form.
 *
 * A string rather than an object, because it is used as a `Map` key and JavaScript maps compare
 * objects by reference — two structurally identical keys would be two entries, which is exactly
 * the bug this type exists to prevent.
 *
 * Every game entry arrives with `campaignId: 0` — the field is deliberately left empty rather than
 * filled with a challenge id — so a game's identity is its `gameCampaignId`.
 */
export type CampaignKey = string & { readonly __campaignKey: unique symbol };

export function messageKey(id: number): CampaignKey {
  return `message:${id}` as CampaignKey;
}

export function gameKey(id: number): CampaignKey {
  return `game:${id}` as CampaignKey;
}

/**
 * Reads a storage key, and also a bare number.
 *
 * A bare number is how every history written before this change looks, and all of those are
 * message campaigns — games did not exist yet. Reading them as messages is what stops an update
 * re-showing every once-ever campaign.
 */
export function parseCampaignKey(raw: string): CampaignKey | null {
  if (/^-?\d+$/.test(raw)) return messageKey(Number(raw));

  const separator = raw.indexOf(':');
  if (separator <= 0) return null;

  const kind = raw.slice(0, separator);
  const id = raw.slice(separator + 1);
  if (kind !== 'message' && kind !== 'game') return null;
  if (!/^-?\d+$/.test(id)) return null;

  return `${kind}:${Number(id)}` as CampaignKey;
}
