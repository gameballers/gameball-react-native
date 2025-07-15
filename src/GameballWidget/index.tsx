import * as React from 'react';
import {
  SafeAreaView,
  View,
  Image,
  TouchableOpacity,
  Platform,
  Share,
} from 'react-native';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import Modal from 'react-native-modal';
import styles from './styles';
import { LanguageUtils } from './languageUttils';
const package_json = require('../../package.json');

interface Props {
  modal?: boolean;
  openDetail?: string;
  hideNavigation?: boolean;
  shouldAllowNavigation?: (event: WebViewNavigation) => boolean;
}

interface State {
  api: string;
  refreshing: boolean;
  showModal: boolean;
}
type initFunctionParams = {
  api: string;
  lang: string;
  shop?: string;
  platform?: string;
  deepLinks?: string[];
  apiPrefix?: string;
  widgetUrlPrefix?: string;
};
class GameballWidget extends React.Component<Props, State> {
  static apiPrefix: string = '';
  static widgetUrlPrefix: string = '';
  static apiKey: string = '';
  static lang: string = '';
  static playerId: string = '';
  static shop?: string = '';
  static platform?: string = '';
  static deepLinks?: string[] = [];
  static mainColor = null;

  constructor(props: Props) {
    super(props);
  }
  state: State = {
    api: '',
    refreshing: false,
    showModal: false,
  };

  static async init({
    api,
    lang,
    shop,
    platform,
    deepLinks,
    apiPrefix = 'https://api.gameball.co/',
    widgetUrlPrefix = 'https://m.gameball.app',
  }: initFunctionParams) {
    GameballWidget.apiKey = api;
    GameballWidget.lang = lang;
    GameballWidget.shop = shop;
    GameballWidget.platform = platform;
    GameballWidget.deepLinks = deepLinks;
    GameballWidget.apiPrefix = apiPrefix;
    GameballWidget.widgetUrlPrefix = widgetUrlPrefix;

    try {
      const response = await fetch(
        `https://api.gameball.co/v1.0/bots2/BotSettings?apiKey=${api}`,
        {
          method: 'GET',
        }
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch bot settings. Status: ${response.status}`
        );
      }
      const json = await response.json();

      if (json && json.response) {
        GameballWidget.mainColor = json.response.botMainColor.replace('#', '');
      }
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }
  static initialize_player(playerId: string) {
    GameballWidget.playerId = playerId;
  }
  static getApiKey() {
    return GameballWidget.apiKey;
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
            message: [param.text, param.url].filter(Boolean).join(' '), // join text and url if both exists
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
    let originWhitelist = [
      'https://m.gameball.app*',
      'http://m.gameball.app*',
      'intent://*',
    ];
    if (GameballWidget.deepLinks ?? [].length > 0) {
      originWhitelist = originWhitelist.concat(GameballWidget.deepLinks ?? []);
    }

    return (
      <WebView
        scrollEnabled={scrollEnabled}
        source={{ uri: `${GameballWidget.widgetUrlPrefix}?${params}` }}
        startInLoadingState
        useWebKit={true}
        originWhitelist={originWhitelist}
        showsVerticalScrollIndicator={false}
        onMessage={this.onMessage}
        onShouldStartLoadWithRequest={this.props.shouldAllowNavigation}
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
    this.setState({ showModal: true });
  }
  render() {
    const { playerId, apiKey, lang, shop, platform, mainColor } =
      GameballWidget;

    const { openDetail, hideNavigation } = this.props;

    const params =
      `playerId=${playerId}&apiKey=${apiKey}&lang=${lang}` +
      `${shop ? `&shop=${shop}` : ''}` +
      `${platform ? `&platform=${platform}` : ''}` +
      `&os=${Platform.OS}` +
      `&sdk=React/${package_json.version}` +
      `${mainColor ? `&main=${mainColor}` : ''}` +
      `${openDetail ? `&openDetail=${openDetail}` : ''}` +
      `${hideNavigation ? `&hideNavigation=${hideNavigation}` : ''}`;

    const isRtl = LanguageUtils.isRtl(lang);

    return this.props.modal ? (
      <Modal isVisible={this.state.showModal} style={styles.modalStyle}>
        <View style={styles.modalContainerStyle}>
          <TouchableOpacity
            onPress={() => this.setState({ showModal: false })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={isRtl ? styles.closeButtonStyleRtl : styles.closeButtonStyleLtr}
          >
            <Image
              source={require('../Assets/close.png')}
              style={styles.closeIconStyle}
            />
          </TouchableOpacity>
          <SafeAreaView style={styles.webviewStyle}>
            {this.renderWidgetComponent({ params, scrollEnabled: true })}
          </SafeAreaView>
        </View>
      </Modal>
    ) : (
      <SafeAreaView style={styles.flex_1}>
        {this.renderWidgetComponent({ params, scrollEnabled: false })}
      </SafeAreaView>
    );
  }
}

export default GameballWidget;
