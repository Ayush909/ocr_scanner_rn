import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import OCRProcessor from '../ocr-processor';

const HomeScreen = ({navigation}) => {
  const [loading, setLoading] = useState(false);
  const processor = new OCRProcessor(
    'llama3.2-vision:11b', // Change model as needed
    'https://c9e7-34-16-236-28.ngrok-free.app/api/generate', // Update with your server address
  );

  const extractJsonObject = inputString => {
    try {
      const jsonStart = inputString.indexOf('{');
      const jsonEnd = inputString.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = inputString.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonString);
      }
      throw new Error('No valid JSON object found in the string');
    } catch (error) {
      console.error('Error extracting JSON:', error);
      return null;
    }
  };

  const handleImage = async imageUri => {
    try {
      setLoading(true);
      const result = await processor.processImage(imageUri, 'receipt');
      console.log(result);
      const jsonResult = extractJsonObject(result);
      if (!jsonResult) {
        Alert.alert('Error', 'No valid JSON object found in the response');
        return;
      }
      navigation.navigate('Result', {data: jsonResult});
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to process receipt');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 1,
    });
    if (!result.didCancel && result.assets?.[0]?.uri) {
      handleImage(result.assets[0].uri);
    }
  };

  //   const takePhoto = async () => {
  //     const result = await launchCamera({
  //       mediaType: 'photo',
  //       quality: 1,
  //     });
  //     if (!result.didCancel && result.assets?.[0]?.uri) {
  //       handleImage(result.assets[0].uri);
  //     }
  //   };

  // Request camera permission for Android
  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'App needs camera permission to take pictures.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  };

  // Request external storage permission for Android (for saving photos)
  const requestExternalWritePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'External Storage Write Permission',
            message: 'App needs write permission to save photos',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; // iOS handles permissions differently
  };

  const takePhoto = async () => {
    const hasCameraPermission = await requestCameraPermission();
    const hasStoragePermission = await requestExternalWritePermission();

    if (!hasCameraPermission || !hasStoragePermission) {
      Alert.alert(
        'Permission Denied',
        'You need to give camera and storage permissions to use this feature.',
      );
      return;
    }

    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      saveToPhotos: true,
    };

    launchCamera(options, response => {
      if (response.assets && response.assets.length > 0) {
        const source = {uri: response.assets[0].uri};
        handleImage(source.uri);
      }
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Receipt Scanner</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={takePhoto}>
          <Text style={styles.buttonText}>Take Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Pick from Gallery</Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Processing receipt...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 40,
    color: '#333',
  },
  buttonContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
  },
  button: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  buttonIcon: {
    width: 50,
    height: 50,
    marginBottom: 10,
  },
  buttonText: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
  },
});

export default HomeScreen;
