import { Platform } from 'react-native';

import { API_ENDPOINTS } from '../../constants';
import GameballWidget from '../../GameballWidget';
import { iamLog } from '../log';
import { openDetailFor, type WidgetContent } from '../models/message';
import package_json from '../../../package.json';

/**
 * Builds the widget URL for a campaign an in-app message opens.
 *
 * The campaign supplies only which game to open. Everything identifying — api key, customer,
 * locale, platform, session token — comes from SDK state, which is why the campaign payload never
 * carries a URL.
 *
 * The host is whatever the integration configured for its profile widget. `showProfile` takes one
 * per call; messaging has no caller to take one from, so without reading the configured value a
 * host aimed at a non-production environment would get production here — which renders as "this
 * campaign is not available" and is indistinguishable from a campaign that does not exist.
 *
 * Navigation is hidden: the message is a card showing one campaign, not the profile, so the
 * widget's own chrome would offer a way out of the thing the customer was just handed.
 */
export function inAppWidgetUrl(widget: WidgetContent): string | null {
  const apiKey = GameballWidget.apiKey;
  if (!apiKey) {
    iamLog('cannot open a game campaign before the SDK has an api key');
    return null;
  }

  const base = GameballWidget.widgetUrlPrefix || API_ENDPOINTS.WIDGET_BASE_URL;
  const params = [
    `customerId=${encodeURIComponent(GameballWidget.customerId ?? '')}`,
    `apiKey=${encodeURIComponent(apiKey)}`,
    `lang=${encodeURIComponent(GameballWidget.lang ?? 'en')}`,
    `os=${Platform.OS}`,
    `sdk=React/${package_json.version}`,
    `openDetail=${encodeURIComponent(openDetailFor(widget))}`,
    'hideNavigation=true',
  ];
  if (GameballWidget.sessionToken) {
    params.push(`sessionToken=${encodeURIComponent(GameballWidget.sessionToken)}`);
  }

  const url = `${base}?${params.join('&')}`;
  // Logged because it is otherwise invisible: a campaign that opens on "this campaign is not
  // available" looks identical whether the id is wrong, the customer cannot play it, or the host
  // is pointed at a different widget environment than its api key belongs to.
  iamLog(`opening widget ${url}`);
  return url;
}
