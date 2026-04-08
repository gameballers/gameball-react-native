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
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import styles from './styles';
import { LanguageUtils } from './languageUtils';
import { API_ENDPOINTS, WEBVIEW_CONFIG } from '../constants';
const package_json = require('../../package.json');

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface Props {
  modal?: boolean;
  openDetail?: string;
  hideNavigation?: boolean;
  showCloseButton?: boolean;
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
    closeButtonColor
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

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  async onMessage(e: WebViewMessageEvent) {
    if (Platform.OS === 'ios') return;
    const { data } = e.nativeEvent;
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
  }

  renderWidgetComponent({
    params,
    scrollEnabled,
  }: {
    params: string;
    scrollEnabled: boolean;
  }) {
    const originWhitelist: string[] = [
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
        androidHardwareAccelerationDisabled={false}
        injectedJavaScriptBeforeContentLoaded="
        if (navigator.share == null) {
          navigator.share = (param) => {
             window.ReactNativeWebView.postMessage('share:' + JSON.stringify(param));
          };
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
    } = GameballWidget;

    const mainColor = GameballWidget.mainColor;

    const params =
      `customerId=${customerId ?? ''}&apiKey=${apiKey}&lang=${lang}` +
      `${shop ? `&shop=${shop}` : ''}` +
      `${platform ? `&platform=${platform}` : ''}` +
      `${sessionToken ? `&sessionToken=${sessionToken}` : ''}` +
      `&os=${Platform.OS}` +
      `&sdk=React/${package_json.version}` +
      `${mainColor ? `&main=${mainColor}` : ''}` +
      `${openDetail ? `&openDetail=${openDetail}` : ''}` +
      `${hideNavigation ? `&hideNavigation=${hideNavigation}` : ''}`;

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
