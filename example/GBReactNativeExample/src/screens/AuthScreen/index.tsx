import React, {useState} from 'react';
import {Button} from 'react-native';
import {StyleSheet} from 'react-native';
import {TextInput} from 'react-native';
import {SafeAreaView} from 'react-native';
import {GameballSDK} from 'react-native-gameball';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList} from '../../App';
import messaging from '@react-native-firebase/messaging';
type AuthScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Auth'
>;

type AuthScreenProps = {
  navigation: AuthScreenNavigationProp;
};
const AuthScreen = ({navigation}: AuthScreenProps) => {
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [playerUniqueId, setPlayerUniqueId] = useState(
    //Testing ID
    '64ef0b4c8999c0faa99b36d3',
  );

  const getPushToken = async () => {
    return await messaging().getToken();
  };

  const initializePlayer = async () => {
    const token = await getPushToken();
    GameballSDK.registerPlayer({
      playerUniqueId: playerUniqueId,
      //Add firebase messaging token
      deviceToken: token ?? 'TEST',
      referrerCode: '',
      playerAttributes: {
        displayName: displayName,
        firstName: firstName,
        lastName: lastName,
        custom: {
          color: 'Black',
        },
      },
    })
      .then(res => {
        console.log('SUCCESS');
        console.log(res);
        // res.json();
      })
      .then(() => {
        navigation.navigate('Home');
      })
      .catch(err => console.log('ERROR' + err.toString()));
  };
  return (
    <SafeAreaView style={{flex: 1}}>
      <TextInput
        value={playerUniqueId}
        onChangeText={setPlayerUniqueId}
        placeholder="Enter player's unique ID"
        style={styles.txtInput}
      />
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Display name"
        style={styles.txtInput}
      />
      <TextInput
        value={firstName}
        onChangeText={setFirstName}
        placeholder="First name"
        style={styles.txtInput}
      />
      <TextInput
        value={lastName}
        onChangeText={setLastName}
        placeholder="Last name"
        style={styles.txtInput}
      />

      <Button title="Initialize player" onPress={initializePlayer} />
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

export default AuthScreen;
