import type { Campaign } from '../../models/campaign';
import type { InAppMessage } from '../../models/message';

export const T0 = Date.parse('2026-09-06T12:00:00Z');

export function message(over: Partial<InAppMessage> = {}): InAppMessage {
  return {
    id: '1',
    campaignId: 1,
    variationId: null,
    isTest: false,
    type: 'modal',
    header: 'H',
    body: 'B',
    imageUrl: null,
    iconUrl: null,
    clickAction: null,
    showCloseButton: true,
    dismissOnScrimTap: true,
    autoDismissMs: null,
    layout: 'text_with_image',
    orientation: 'any',
    slidePosition: 'bottom',
    buttons: [],
    extras: {},
    style: {},
  widget: null,
    ...over,
  };
}

export function campaign(id: number, over: Partial<Campaign> = {}): Campaign {
  return {
    campaignId: id,
    variationId: null,
    dispatchId: `d-${id}`,
    name: null,
    trigger: { kind: 'session_start' },
    priority: 0,
    message: message({ id: String(id), campaignId: id }),
    expiresAt: null,
    isTest: false,
    repeatable: false,
    minIntervalMs: null,
    ...over,
  };
}

/**
 * A game entry as the parser builds it: `campaignId` 0 like every game, no copy, and the game
 * named by its own id. The message id is only for reading test output.
 */
export function game(gameId: number, over: Partial<Campaign> = {}): Campaign {
  return campaign(0, {
    dispatchId: null,
    message: message({
      id: `game-${gameId}`,
      campaignId: 0,
      header: null,
      body: null,
      widget: { gameCampaignId: gameId, gameCampaignType: 'wheel' },
    }),
    ...over,
  });
}
