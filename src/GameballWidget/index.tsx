import * as React from 'react';
import {
  SafeAreaView,
  View,
  Image,
  TouchableOpacity,
  Platform,
  Share,
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import styles from './styles';
import { LanguageUtils } from './languageUtils';
import { API_ENDPOINTS, WEBVIEW_CONFIG } from '../constants';
import type { WidgetEventCallback } from '../types/Common';
const package_json = require('../../package.json');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  modal?: boolean;
  openDetail?: string;
  hideNavigation?: boolean;
  showCloseButton?: boolean;
  externalLinkCallback?: (url: string) => void;
  widgetEventCallback?: WidgetEventCallback;
}

interface State {
  api: string;
  refreshing: boolean;
  visible: boolean;
  hasBeenOpened: boolean;
}
type initFunctionParams = {
  apiKey: string;
  lang: string;
  shop?: string;
  platform?: string;
  sessionToken?: string;
  openDetail?: string;
  apiPrefix?: string;
  widgetUrlPrefix?: string;
  customerId?: string;
  hideNavigation?: boolean;
  modal?: boolean;
  mainColor?: string;
  showCloseButton?: boolean;
  closeButtonColor?: string;
  mobile?: string;
  email?: string;
  externalLinkCallback?: (url: string) => void;
  widgetEventCallback?: WidgetEventCallback;
};
class GameballWidget extends React.Component<Props, State> {
  static apiPrefix: string = '';
  static widgetUrlPrefix: string = '';
  static apiKey: string = '';
  static lang: string = '';
  /** Optional customer identifier. When not provided, opens the guest view */
  static customerId: string | null = null;
  static shop?: string = '';
  static platform?: string = '';
  static sessionToken?: string = '';
  static openDetail?: string = '';
  static hideNavigation?: boolean = false;
  static modal?: boolean = true;
  static mainColor: string | null = null;
  static showCloseButton?: boolean = true;
  static closeButtonColor: string | null = null;
  static mobile?: string = '';
  static email?: string = '';
  static externalLinkCallback?: (url: string) => void;
  static widgetEventCallback?: WidgetEventCallback;

  // Host that identifies Gameball widget content. Any subdomain of this (m., www.,
  // app., alpha., …) loads in-webview; everything else is treated as a cross-host link.
  private static readonly GAMEBALL_HOST = 'gameball.app';
  private static readonly GAMEBALL_HOST_SUFFIX = '.gameball.app';
  // Query marker the widget appends to a link it wants opened in the device browser.
  private static readonly EXTERNAL_BROWSER_FLAG = 'gbExternalBrowser=true';
  // Prefix of the postMessage the injected bridge sends for window.WidgetEvent.postEvent.
  private static readonly WIDGET_EVENT_PREFIX = 'widgetEvent:';
  // postMessage the injected bridge sends for window.GameballWidget.closeWidget().
  private static readonly CLOSE_WIDGET_MESSAGE = 'closeWidget:';

  // Most recently mounted widget, so GameballApp.showProfile/hideProfile can reach it.
  private static activeInstance: GameballWidget | null = null;

  private _isMounted: boolean = false;
  private _slideAnim = new Animated.Value(SCREEN_HEIGHT);
  private _webViewRef: any = React.createRef();

  constructor(props: Props) {
    super(props);
  }
  state: State = {
    api: '',
    refreshing: false,
    visible: false,
    hasBeenOpened: false,
  };

  static async init({
    apiKey,
    lang,
    shop,
    platform,
    sessionToken,
    openDetail,
    apiPrefix = API_ENDPOINTS.BASE_URL,
    widgetUrlPrefix = API_ENDPOINTS.WIDGET_BASE_URL,
    customerId,
    hideNavigation,
    modal = true,
    mainColor,
    showCloseButton = true,
    closeButtonColor,
    mobile,
    email,
    externalLinkCallback,
    widgetEventCallback,
  }: initFunctionParams) {
    Object.assign(GameballWidget, {
      apiKey,
      lang,
      shop,
      platform,
      openDetail,
      apiPrefix,
      widgetUrlPrefix,
      hideNavigation,
      modal,
      showCloseButton,
      customerId: customerId ?? null,
      mobile,
      email,
      externalLinkCallback,
      widgetEventCallback,
    });

    if (sessionToken) {
      GameballWidget.sessionToken = sessionToken;
    }
    if (mainColor) {
      GameballWidget.mainColor = mainColor;
    }
    if (closeButtonColor) {
      GameballWidget.closeButtonColor = closeButtonColor;
    }
  }
  static initializeCustomer(customerId: string) {
    GameballWidget.customerId = customerId;
  }

  /** Shows the mounted widget. Returns false when no <GameballWidget /> is mounted. */
  static showActiveProfile(): boolean {
    if (!GameballWidget.activeInstance) return false;
    GameballWidget.activeInstance.showProfile();
    return true;
  }

  /**
   * Dismisses the mounted widget, if any. Backs both the widget-initiated
   * window.GameballWidget.closeWidget() bridge and GameballApp.hideProfile().
   */
  static closeWidget() {
    GameballWidget.activeInstance?.hideProfile();
  }

  componentDidMount() {
    this._isMounted = true;
    GameballWidget.activeInstance = this;
    // When the widget is used as a component (e.g. <GameballWidget externalLinkCallback={…}/>
    // + widgetRef.showProfile()), surface the prop to the static the nav handler reads.
    // Left untouched when the prop is absent so a callback set via GameballApp.init/showProfile
    // is not clobbered.
    if (this.props.externalLinkCallback) {
      GameballWidget.externalLinkCallback = this.props.externalLinkCallback;
    }
    if (this.props.widgetEventCallback) {
      GameballWidget.widgetEventCallback = this.props.widgetEventCallback;
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (GameballWidget.activeInstance === this) {
      GameballWidget.activeInstance = null;
    }
  }

  onMessage = async (e: WebViewMessageEvent) => {
    const { data } = e.nativeEvent;
    if (data.startsWith(GameballWidget.WIDGET_EVENT_PREFIX)) {
      this.handleWidgetEvent(data.slice(GameballWidget.WIDGET_EVENT_PREFIX.length));
      return;
    }
    if (data === GameballWidget.CLOSE_WIDGET_MESSAGE) {
      // Widget-initiated close, posted via window.GameballWidget.closeWidget().
      this.hideProfile();
      return;
    }
    if (Platform.OS === 'ios') return;
    if (data.startsWith('share:')) {
      try {
        const param = JSON.parse(data.slice('share:'.length));
        if (param.url == null && param.text == null) {
          return;
        }
        await Share.share(
          {
            title: param.title,
            message: [param.text, param.url].filter(Boolean).join(' '),
            url: param.url,
          },
          {
            dialogTitle: param.title,
            subject: param.title,
          }
        );
      } catch (e: unknown) {
        console.error(e);
      }
    }
  };

  // Widget → host events (e.g. game completion), posted via window.WidgetEvent.postEvent.
  handleWidgetEvent(raw: string) {
    const callback = GameballWidget.widgetEventCallback;
    if (!callback) return;
    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch (error) {
      callback(null, error instanceof Error ? error : new Error(String(error)));
      return;
    }
    if (event !== null && typeof event === 'object' && !Array.isArray(event)) {
      callback(event as Record<string, any>);
    } else {
      callback(null, new Error('Unexpected widget event payload'));
    }
  }

  // Extracts the lowercased host from a URL or bare authority, dropping any userinfo and
  // :port (e.g. "https://m.gameball.app:443/x" and "m.gameball.app/x" both → "m.gameball.app"),
  // matching the native URL.host behaviour used by the other SDKs. Returns '' if none.
  private static hostOf(url: string): string {
    const authority = url.replace(/^[a-zA-Z]+:\/\//, '').split(/[/?#]/)[0] ?? '';
    const host = authority.split('@').pop() ?? ''; // drop user:pass@
    return (host.split(':')[0] ?? '').toLowerCase(); // drop :port
  }

  // True when the URL should load inside the webview rather than be treated as an
  // external link. Non-http(s) schemes (about:blank/srcdoc, data:, blob:, file:) are the
  // webview's own internal frames — always in-webview, never delegated. Otherwise it is a
  // Gameball link when the host is "gameball.app" or ends with ".gameball.app" (so
  // m./www./app./alpha. etc. match; the leading-dot suffix rejects "evilgameball.app").
  isGameballHost(url: string): boolean {
    if (!/^https?:\/\//i.test(url)) {
      return true; // about:/data:/blob:/file: etc. → internal, stay in-webview
    }
    const host = GameballWidget.hostOf(url);
    if (!host) {
      return true;
    }
    return (
      host === GameballWidget.GAMEBALL_HOST ||
      host.endsWith(GameballWidget.GAMEBALL_HOST_SUFFIX)
    );
  }

  // Handle a cross-host link (never loads in-widget):
  //   1) gbExternalBrowser=true → device browser (flag outranks the callback)
  //   2) else if externalLinkCallback set → delegate to it
  //   3) else → device browser (safety net)
  handleExternalBrowserLink(url: string): void {
    if (url.includes(GameballWidget.EXTERNAL_BROWSER_FLAG)) {
      Linking.openURL(url).catch(() => {});
    } else if (GameballWidget.externalLinkCallback) {
      GameballWidget.externalLinkCallback(url);
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }

  renderWidgetComponent({
    params,
    scrollEnabled,
  }: {
    params: string;
    scrollEnabled: boolean;
  }) {
    const originWhitelist: string[] = [
      // '*' lets every origin reach onShouldStartLoadWithRequest, making that handler the
      // single navigation decision point. A restrictive originWhitelist would otherwise
      // open any non-matching origin in the device browser BEFORE the handler runs —
      // bypassing the externalLinkCallback delegation and the in-webview load of
      // *.gameball.app. The original entries below are kept as documented trusted origins.
      '*',
      ...WEBVIEW_CONFIG.ALLOWED_ORIGINS,
      ...(GameballWidget.openDetail ? [GameballWidget.openDetail] : []),
    ];

    return (
      <WebView
        ref={this._webViewRef}
        scrollEnabled={scrollEnabled}
        source={{ uri: `${GameballWidget.widgetUrlPrefix}?${params}` }}
        originWhitelist={originWhitelist}
        showsVerticalScrollIndicator={false}
        onMessage={this.onMessage}
        // Route target="_blank" / window.open links back through onShouldStartLoadWithRequest
        // instead of letting the OS open a new window externally (iOS default is true).
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) => {
          if (this.isGameballHost(request.url)) {
            return true; // load in-webview
          }
          this.handleExternalBrowserLink(request.url);
          return false; // cross-host link consumed externally
        }}
        androidHardwareAccelerationDisabled={false}
        injectedJavaScriptBeforeContentLoaded="
        if (navigator.share == null) {
          navigator.share = (param) => {
             window.ReactNativeWebView.postMessage('share:' + JSON.stringify(param));
          };
        };
        // Bridge widget → host events: the widget calls window.WidgetEvent.postEvent(rawJson).
        window.WidgetEvent = window.WidgetEvent || {};
        window.WidgetEvent.postEvent = function (raw) {
          window.ReactNativeWebView.postMessage(
            'widgetEvent:' + (typeof raw === 'string' ? raw : JSON.stringify(raw))
          );
        };
        // Bridge widget-initiated close: window.GameballWidget.closeWidget() dismisses the widget.
        window.GameballWidget = window.GameballWidget || {};
        window.GameballWidget.closeWidget = function () {
          window.ReactNativeWebView.postMessage('closeWidget:');
        };
        true;
        "
      />
    );
  }

  showProfile() {
    if (this._isMounted) {
      if (this.state.hasBeenOpened) {
        this._webViewRef.current?.reload();
      }
      this.setState({ visible: true, hasBeenOpened: true }, () => {
        Animated.spring(this._slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      });
    }
  }

  hideProfile() {
    if (!this.state.visible) return;
    Animated.timing(this._slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      if (this._isMounted) {
        this.setState({ visible: false });
      }
    });
  }

  render() {
    const {
      customerId,
      apiKey,
      lang,
      shop,
      platform,
      sessionToken,
      openDetail,
      hideNavigation,
      modal,
      showCloseButton,
      mobile,
      email,
    } = GameballWidget;

    const mainColor = GameballWidget.mainColor;

    const enc = encodeURIComponent;
    const params =
      `customerId=${enc(customerId ?? '')}&apiKey=${enc(apiKey)}&lang=${enc(lang)}` +
      `${shop ? `&shop=${enc(shop)}` : ''}` +
      `${platform ? `&platform=${enc(platform)}` : ''}` +
      `${sessionToken ? `&sessionToken=${enc(sessionToken)}` : ''}` +
      `&os=${Platform.OS}` +
      `&sdk=React/${package_json.version}` +
      `${mainColor ? `&main=${enc(mainColor)}` : ''}` +
      `${openDetail ? `&openDetail=${enc(openDetail)}` : ''}` +
      `${hideNavigation != null ? `&hideNavigation=${hideNavigation}` : ''}` +
      `${mobile ? `&mobile=${enc(mobile)}` : ''}` +
      `${email ? `&email=${enc(email)}` : ''}`;

    const isRtl = LanguageUtils.isRtl(lang);
    const closeButtonColor = GameballWidget.closeButtonColor || '#CECECE';

    if (modal) {
      if (!this.state.hasBeenOpened) {
        return null;
      }

      return (
        <>
          {this.state.visible && (
            <View style={styles.overlayStyle}>
              <TouchableOpacity
                style={styles.backdropStyle}
                activeOpacity={1}
                onPress={() => this.hideProfile()}
              />
            </View>
          )}
          <Animated.View
            style={[
              styles.modalContainerStyle,
              { transform: [{ translateY: this._slideAnim }] },
            ]}
            pointerEvents={this.state.visible ? 'auto' : 'none'}
          >
            {showCloseButton && this.state.visible && (
              <TouchableOpacity
                onPress={() => this.hideProfile()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={
                  isRtl ? styles.closeButtonStyleRtl : styles.closeButtonStyleLtr
                }
              >
                <Image
                  source={require('../Assets/close.png')}
                  style={[styles.closeIconStyle, { tintColor: `${closeButtonColor}` }]}
                />
              </TouchableOpacity>
            )}
            <SafeAreaView style={styles.webviewStyle}>
              {this.renderWidgetComponent({ params, scrollEnabled: true })}
            </SafeAreaView>
          </Animated.View>
        </>
      );
    }

    return (
      <SafeAreaView style={styles.flex_1}>
        {this.renderWidgetComponent({ params, scrollEnabled: false })}
      </SafeAreaView>
    );
  }
}

export default GameballWidget;
