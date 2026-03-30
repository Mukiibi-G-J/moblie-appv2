import {Platform, Vibration} from 'react-native';
import SoundPlayer from 'react-native-sound-player';

// Bundled copy for iOS / fallback; Android release uses `res/raw` via playSoundFile.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const barcodeBeepAsset = require('../assets/sounds/barcode_beep.wav');

/**
 * Short scanner "bip". Android uses `android/app/src/main/res/raw/barcode_beep.wav`
 * (reliable; system UI paths are often blocked). iOS plays the same file from the JS bundle.
 */
export const playBarcodeBeep = () => {
  try {
    if (Platform.OS === 'android') {
      try {
        SoundPlayer.stop();
      } catch {
        // ignore if nothing was playing
      }
      SoundPlayer.playSoundFile('barcode_beep', 'wav');
      return;
    }
    void SoundPlayer.playAsset(barcodeBeepAsset);
  } catch {
    Vibration.vibrate(80);
  }
};
