import { Platform } from 'react-native';

import { API_ENDPOINTS } from '../../constants';
import { iamLog } from '../log';
import { openDetailFor, type WidgetContent } from '../models/message';
import { SDK_VERSION } from '../version';

/**
 * What a game's url is composed from: in-app messaging's own configuration, and the customer it
 * runs for.
 *
 * Never the profile widget's. Its state is set only by `showProfile`, so an app that never opened
 * the profile had no api key to open a game with, and one that had opened it would open the game
 * for whichever customer the profile last showed.
 */
export interface GameUrlContext {
  apiKey: string;
  customerId: string;
  lang: string;
  /** Production when absent. */
  widgetUrlPrefix?: string | null;
  sessionToken?: string | null;
}

/**
 * Builds the widget URL for a campaign an in-app message opens.
 *
 * The campaign supplies only which game to open. Everything identifying — api key, customer,
 * locale, platform, session token — comes from SDK state, which is why the campaign payload never
 * carries a URL.
 *
 * The host is the one the SDK was configured with. Messaging has no `showProfile` call to take one
 * from, so without it a host aimed at a non-production environment would get production here —
 * which renders as "this campaign is not available" and is indistinguishable from a campaign that
 * does not exist.
 *
 * Navigation is hidden: the message is a card showing one campaign, not the profile, so the
 * widget's own chrome would offer a way out of the thing the customer was just handed.
 */
export function inAppWidgetUrl(
  widget: WidgetContent,
  context: GameUrlContext
): string | null {
  if (!context.apiKey) {
    iamLog(
      'cannot open a game campaign: the SDK was configured without an api key'
    );
    return null;
  }

  const base = context.widgetUrlPrefix || API_ENDPOINTS.WIDGET_BASE_URL;
  const params = [
    `customerId=${encodeURIComponent(context.customerId)}`,
    `apiKey=${encodeURIComponent(context.apiKey)}`,
    `lang=${encodeURIComponent(context.lang)}`,
    `os=${Platform.OS}`,
    `sdk=React/${SDK_VERSION}`,
    `openDetail=${encodeURIComponent(openDetailFor(widget))}`,
    'hideNavigation=true',
  ];
  if (context.sessionToken) {
    params.push(`sessionToken=${encodeURIComponent(context.sessionToken)}`);
  }

  const url = `${base}?${params.join('&')}`;
  // Logged because it is otherwise invisible: a campaign that opens on "this campaign is not
  // available" looks identical whether the id is wrong, the customer cannot play it, or the host
  // is pointed at a different widget environment than its api key belongs to.
  iamLog(`opening widget ${url}`);
  return url;
}
