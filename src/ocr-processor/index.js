import RNFS from 'react-native-fs';
import {Platform} from 'react-native';
// import ImageResizer from 'react-native-image-resizer';

class OCRProcessor {
  constructor(
    modelName = 'llama3.2-vision:11b',
    baseUrl = 'http://localhost:11434/api/generate',
    maxWorkers = 1,
  ) {
    this.modelName = modelName;
    this.baseUrl = baseUrl;
    this.maxWorkers = maxWorkers;
  }

  /**
   * Convert image to base64 string
   * @param {string} uri - The URI of the image
   * @returns {Promise<string>} - Base64 encoded image
   */
  async _encodeImage(uri) {
    try {
      // Handle file:// protocol which might be missing in some URIs
      let fileUri = uri;
      if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
        fileUri = Platform.OS === 'ios' ? uri : `file://${uri}`;
      }

      // Read the file as base64
      const base64Image = await RNFS.readFile(fileUri, 'base64');
      return base64Image;
    } catch (error) {
      throw new Error(`Failed to encode image: ${error.message}`);
    }
  }

  /**
   * Preprocess image before OCR
   * @param {string} imageUri - URI of the image
   * @param {string} language - Language code
   * @returns {Promise<string>} - URI of the preprocessed image
   */
  // async _preprocessImage(imageUri, language = 'en') {
  //   try {
  //     // Using react-native-image-resizer for basic image processing
  //     // Note: Advanced preprocessing like CLAHE and specific thresholding
  //     // would require native modules or a server-side processing approach

  //     // Get temp directory for saving processed image
  //     const tempDir =
  //       Platform.OS === 'ios'
  //         ? `${RNFS.TemporaryDirectoryPath}`
  //         : `${RNFS.CachesDirectoryPath}`;

  //     // Create a unique filename
  //     const fileName = `processed_${Date.now()}.jpg`;
  //     const outputPath = `${tempDir}/${fileName}`;

  //     // Resize and convert to grayscale (grayscale conversion is limited in RN)
  //     const resizedImage = await ImageResizer.createResizedImage(
  //       imageUri,
  //       1200, // width
  //       1200, // height (maintain aspect ratio)
  //       'JPEG',
  //       80, // quality
  //       0, // rotation
  //       outputPath,
  //     );

  //     // Since we don't have direct access to CV's advanced preprocessing in React Native,
  //     // we've done what we can with available libraries

  //     return resizedImage.uri;
  //   } catch (error) {
  //     console.error('Image preprocessing error:', error);
  //     // Return original image if preprocessing fails
  //     return imageUri;
  //   }
  // }

  /**
   * Process a single image and extract text
   * @param {string} imageUri - URI of the image
   * @param {string} formatType - Output format type
   * @param {boolean} preprocess - Whether to preprocess the image
   * @param {string} customPrompt - Custom prompt
   * @param {string} language - Language code
   * @returns {Promise<string>} - Extracted text
   */
  async processImage(
    imageUri,
    formatType = 'markdown',
    preprocess = false,
    customPrompt = null,
    language = 'English',
  ) {
    try {
      // Preprocess image if enabled
      let processedImageUri = imageUri;
      // if (preprocess) {
      //   processedImageUri = await this._preprocessImage(imageUri, language);
      // }

      // Convert image to base64
      const imageBase64 = await this._encodeImage(processedImageUri);

      console.log('imageBase64:', imageUri);

      // Determine which prompt to use
      let prompt;
      if (customPrompt && customPrompt.trim()) {
        prompt = customPrompt;
        console.log('Using custom prompt:', prompt);
      } else {
        const prompts = {
          receipt: `You are tasked with extracting text from a grocery receipt image. Extract it **without any changes** **exactly as it appears**, without modification, summarization, or omission.
          - First identify how many items are in the receipt and then extract the text from the receipt.
          - Correctly identify the item names, quantities, unit prices, and total prices.
          - If a field is missing or unreadable, leave it as an empty string "". 
          - List every line of unclear or extra text under "additional_text" as individual strings. 
          - Keep the extracted content in English. 
          - Do not fix, correct, or reformat any extracted wording or values unless necessary to fit JSON types (e.g., convert "5.99" to number if required by structure).
          - If an item has no quantity, unit price, or total price separately shown, leave those fields empty "" but still include the item name.
          - Strictly preserve the structure and format — no extra fields, no missing fields.

          Your output must be a valid JSON with the following strict structure: 
            ${JSON.stringify({
              store_name: '',
              transaction_date: '',
              items: [
                {
                  name: '',
                  quantity: '',
                  unit_price: '',
                  total_price: '',
                },
              ],
              subtotal: '',
              tax: '',
              total: '',
              additional_text: [],
            })}     
            
            - MOST IMPORTANT: Always return a valid JSON object starting with "{" and ending with "}".
          `,

          markdown: `Extract all text content from this image in ${language} **exactly as it appears**, without modification, summarization, or omission.
              Format the output in markdown:
              - Use headers (#, ##, ###) **only if they appear in the image**
              - Preserve original lists (-, *, numbered lists) as they are
              - Maintain all text formatting (bold, italics, underlines) exactly as seen
              - **Do not add, interpret, or restructure any content**
          `,
          text: `Extract all visible text from this image in ${language} **without any changes**.
              - **Do not summarize, paraphrase, or infer missing text.**
              - Retain all spacing, punctuation, and formatting exactly as in the image.
              - If text is unclear or partially visible, extract as much as possible without guessing.
              - **Include all text, even if it seems irrelevant or repeated.** 
          `,
          json: `Extract all text from this image in ${language} and format it as JSON, **strictly preserving** the structure.
              - **Do not summarize, add, or modify any text.**
              - Maintain hierarchical sections and subsections as they appear.
              - Use keys that reflect the document's actual structure (e.g., "title", "body", "footer").
              - Include all text, even if fragmented, blurry, or unclear.
          `,
          structured: `Extract all text from this image in ${language}, **ensuring complete structural accuracy**:
              - Identify and format tables **without altering content**.
              - Preserve list structures (bulleted, numbered) **exactly as shown**.
              - Maintain all section headings, indents, and alignments.
              - **Do not add, infer, or restructure the content in any way.**
          `,
          key_value: `Extract all key-value pairs from this image in ${language} **exactly as they appear**:
              - Identify and extract labels and their corresponding values without modification.
              - Maintain the exact wording, punctuation, and order.
              - Format each pair as 'key: value' **only if clearly structured that way in the image**.
              - **Do not infer missing values or add any extra text.**
          `,
          table: `Extract all tabular data from this image in ${language} **exactly as it appears**, without modification, summarization, or omission.
              - **Preserve the table structure** (rows, columns, headers) as closely as possible.
              - **Do not add missing values or infer content**—if a cell is empty, leave it empty.
              - Maintain all numerical, textual, and special character formatting.
              - If the table contains merged cells, indicate them clearly without altering their meaning.
              - Output the table in a structured format such as Markdown, CSV, or JSON, based on the intended use.
          `,
        };
        prompt = prompts[formatType] || prompts['text'];
        console.log('Using default prompt:', prompt);
      }

      // Prepare the request payload
      const payload = {
        model: this.modelName,
        prompt: prompt,
        stream: false,
        images: [imageBase64],
      };

      // Make the API call
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const extractJSON = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      let result = data.response || '';

      // Format JSON result if needed
      if (formatType === 'json') {
        try {
          const jsonData = JSON.parse(result);
          return JSON.stringify(jsonData, null, 2);
        } catch (e) {
          console.warn('Failed to parse JSON result:', e);
          return result;
        }
      }

      // Clean up temporary files if created
      if (preprocess && processedImageUri !== imageUri) {
        try {
          await RNFS.unlink(processedImageUri);
        } catch (error) {
          console.warn('Failed to clean up temporary file:', error);
        }
      }

      return result;
    } catch (error) {
      console.error('Error processing image:', error);
      return `Error processing image: ${error.message}`;
    }
  }

  /**
   * Process multiple images in batch
   * @param {Array|string} inputPaths - Array of image URIs or directory path
   * @param {string} formatType - Output format type
   * @param {boolean} recursive - Whether to search directories recursively
   * @param {boolean} preprocess - Whether to preprocess images
   * @param {string} customPrompt - Custom prompt
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Results and statistics
   */
  async processBatch(
    inputPaths,
    formatType = 'markdown',
    recursive = false,
    preprocess = true,
    customPrompt = null,
    language = 'en',
  ) {
    try {
      // Handle input paths - only array input is fully supported in React Native
      let imagePaths = Array.isArray(inputPaths) ? inputPaths : [];

      // If a string is provided, assume it's a directory path (limited support)
      if (typeof inputPaths === 'string') {
        try {
          const exists = await RNFS.exists(inputPaths);
          if (exists) {
            const files = await RNFS.readDir(inputPaths);
            // Filter for image files
            const imageFiles = files.filter(file => {
              const ext = file.name.toLowerCase();
              return (
                ext.endsWith('.jpg') ||
                ext.endsWith('.jpeg') ||
                ext.endsWith('.png') ||
                ext.endsWith('.tiff')
              );
            });
            imagePaths = imageFiles.map(file => file.path);

            // If recursive is requested, this would require a more complex implementation
            if (recursive) {
              console.warn(
                'Recursive directory scanning is not fully implemented',
              );
            }
          }
        } catch (err) {
          console.error('Error reading directory:', err);
        }
      }

      const results = {};
      const errors = {};
      let completed = 0;

      // Process images (in parallel, but with limit)
      const batches = [];
      for (let i = 0; i < imagePaths.length; i += this.maxWorkers) {
        const batch = imagePaths.slice(i, i + this.maxWorkers);
        batches.push(batch);
      }

      for (const batch of batches) {
        // Process this batch in parallel
        const batchPromises = batch.map(path =>
          this.processImage(
            path,
            formatType,
            preprocess,
            customPrompt,
            language,
          )
            .then(result => {
              results[path] = result;
              completed++;
              return {path, result};
            })
            .catch(error => {
              errors[path] = error.message || String(error);
              completed++;
              return {path, error: error.message};
            }),
        );

        await Promise.all(batchPromises);

        // Log progress
        console.log(`Processed ${completed} of ${imagePaths.length} images`);
      }

      return {
        results,
        errors,
        statistics: {
          total: imagePaths.length,
          successful: Object.keys(results).length,
          failed: Object.keys(errors).length,
        },
      };
    } catch (error) {
      console.error('Batch processing error:', error);
      return {
        results: {},
        errors: {general: error.message},
        statistics: {
          total: 0,
          successful: 0,
          failed: 0,
        },
      };
    }
  }

  /**
   * Pick an image from device gallery and process it
   * @param {string} formatType - Output format type
   * @param {boolean} preprocess - Whether to preprocess the image
   * @param {string} customPrompt - Custom prompt
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Result object with image uri and extracted text
   */
  // async pickAndProcessImage(
  //   formatType = 'markdown',
  //   preprocess = true,
  //   customPrompt = null,
  //   language = 'en',
  // ) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       const options = {
  //         title: 'Select Image',
  //         storageOptions: {
  //           skipBackup: true,
  //           path: 'images',
  //         },
  //         mediaType: 'photo',
  //         includeBase64: false,
  //       };

  //       ImagePicker.launchImageLibrary(options, async response => {
  //         if (response.didCancel) {
  //           reject(new Error('User cancelled image picker'));
  //           return;
  //         }

  //         if (response.errorCode) {
  //           reject(new Error(`ImagePicker Error: ${response.errorMessage}`));
  //           return;
  //         }

  //         // Get URI from response (structure differs between versions)
  //         let imageUri;
  //         if (response.assets && response.assets.length > 0) {
  //           // React Native Image Picker v4+
  //           imageUri = response.assets[0].uri;
  //         } else if (response.uri) {
  //           // Older versions
  //           imageUri = response.uri;
  //         } else {
  //           reject(new Error('No image URI found in picker response'));
  //           return;
  //         }

  //         try {
  //           // Process the image
  //           const extractedText = await this.processImage(
  //             imageUri,
  //             formatType,
  //             preprocess,
  //             customPrompt,
  //             language,
  //           );

  //           resolve({
  //             imageUri,
  //             text: extractedText,
  //           });
  //         } catch (err) {
  //           reject(err);
  //         }
  //       });
  //     } catch (error) {
  //       reject(error);
  //     }
  //   });
  // }

  /**
   * Take a photo with device camera and process it
   * @param {string} formatType - Output format type
   * @param {boolean} preprocess - Whether to preprocess the image
   * @param {string} customPrompt - Custom prompt
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Result object with image uri and extracted text
   */
  // async takeAndProcessPhoto(
  //   formatType = 'markdown',
  //   preprocess = true,
  //   customPrompt = null,
  //   language = 'en',
  // ) {
  //   return new Promise((resolve, reject) => {
  //     try {
  //       const options = {
  //         title: 'Take a Photo',
  //         storageOptions: {
  //           skipBackup: true,
  //           path: 'images',
  //         },
  //         mediaType: 'photo',
  //         includeBase64: false,
  //         saveToPhotos: true,
  //       };

  //       ImagePicker.launchCamera(options, async response => {
  //         if (response.didCancel) {
  //           reject(new Error('User cancelled camera'));
  //           return;
  //         }

  //         if (response.errorCode) {
  //           reject(new Error(`Camera Error: ${response.errorMessage}`));
  //           return;
  //         }

  //         // Get URI from response (structure differs between versions)
  //         let imageUri;
  //         if (response.assets && response.assets.length > 0) {
  //           // React Native Image Picker v4+
  //           imageUri = response.assets[0].uri;
  //         } else if (response.uri) {
  //           // Older versions
  //           imageUri = response.uri;
  //         } else {
  //           reject(new Error('No image URI found in camera response'));
  //           return;
  //         }

  //         try {
  //           // Process the image
  //           const extractedText = await this.processImage(
  //             imageUri,
  //             formatType,
  //             preprocess,
  //             customPrompt,
  //             language,
  //           );

  //           resolve({
  //             imageUri,
  //             text: extractedText,
  //           });
  //         } catch (err) {
  //           reject(err);
  //         }
  //       });
  //     } catch (error) {
  //       reject(error);
  //     }
  //   });
  // }
}

export default OCRProcessor;
