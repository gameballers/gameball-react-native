import { Dimensions, StyleSheet } from 'react-native';
const { height } = Dimensions.get('window');

export default StyleSheet.create({
  flex_1: {
    flex: 1,
  },
  refreshButtonStyle: {
    alignSelf: 'flex-end',
    marginHorizontal: 10,
  },
  refreshIconStyle: {
    width: 20,
    height: 20,
  },
  modalStyle: {
    justifyContent: 'flex-end',
    margin: 0,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
  },
  modalContainerStyle: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'white',
    height: height * 0.9,
  },
  closeIconStyle: {
    width: 20,
    height: 20,
  },
  closeButtonStyleLtr: {
    position: 'absolute',
    right: 20,
    top: 20,
    zIndex: 1,
  },
  closeButtonStyleRtl: {
    position: 'absolute',
    left: 20,
    top: 20,
    zIndex: 1,
  },
  webviewStyle: {
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
    height: height * 0.9,
  },
});
