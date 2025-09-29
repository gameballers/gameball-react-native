import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useState} from 'react';
import {Button} from 'react-native';
import {StyleSheet} from 'react-native';
import {TextInput} from 'react-native';
import {SafeAreaView} from 'react-native';
import {GameballApp} from 'react-native-gameball';
import type {RootStackParamList} from '../../App';
type DataState = {
  apiKey: string;
  platform: string;
  shop?: string;
  deeplink: string[];
  widgetUrl?: string;
  apiUrl?: string;
};
type WidgetInitializationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Init'
>;

type WidgetInitializationScreenProps = {
  navigation: WidgetInitializationScreenNavigationProp;
};
const WidgetInitialization = ({
  navigation,
}: WidgetInitializationScreenProps) => {
  const [data, setdata] = useState<DataState>({
    apiKey: 'e4f9d103d65943a88892248acca2d52d',
    platform: '',
    shop: undefined,
    deeplink: [],
    widgetUrl: undefined,
    apiUrl: undefined,
  });

  const initializeSDK = () => {
    const {apiKey, deeplink, platform, shop, apiUrl, widgetUrl} = data;
    GameballWidget.init({
      api: apiKey,
      lang: 'en',
      apiPrefix: apiUrl,
      widgetUrlPrefix: widgetUrl,
      deepLinks: deeplink,
      platform,
      shop,
    });
    navigation.navigate('Auth');
  };
  return (
    <SafeAreaView style={{flex: 1}}>
      <TextInput
        value={data.apiKey}
        onChangeText={apiKey => setdata({...data, apiKey})}
        placeholder="Enter Gameball API key"
        style={styles.txtInput}
      />
      <TextInput
        value={data.platform}
        onChangeText={platform => setdata({...data, platform})}
        placeholder="Enter platform name"
        style={styles.txtInput}
      />
      <TextInput
        value={data.shop}
        onChangeText={shop => setdata({...data, shop})}
        placeholder="Enter shop name"
        style={styles.txtInput}
      />
      <TextInput
        value={data.deeplink.toString()}
        onChangeText={deeplink =>
          setdata({...data, deeplink: data.deeplink.concat([deeplink])})
        }
        placeholder="Enter deeplink companyName://*"
        style={styles.txtInput}
      />
      <TextInput
        value={data.apiUrl}
        onChangeText={apiUrl => setdata({...data, apiUrl})}
        placeholder="Enter preferred apiUrl"
        style={styles.txtInput}
      />
      <TextInput
        value={data.widgetUrl}
        onChangeText={widgetUrl => setdata({...data, widgetUrl})}
        placeholder="Enter preferred widget url"
        style={styles.txtInput}
      />

      <Button title="Initialize SDK" onPress={initializeSDK} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  txtInput: {
    borderWidth: 1,
    padding: 10,
    margin: 17,
  },
});

export default WidgetInitialization;
