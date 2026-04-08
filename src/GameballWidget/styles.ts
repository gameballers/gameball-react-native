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
  // Full-screen overlay when widget is visible
  overlayStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  // Tappable backdrop to dismiss
  backdropStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContainerStyle: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    backgroundColor: 'white',
    height: height * 0.9,
    zIndex: 10000,
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
