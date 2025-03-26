package com.ocr_scanner

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.Environment
import android.util.Log
import androidx.annotation.Nullable
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.googlecode.tesseract.android.ResultIterator
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

class TesseractOcrModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val KEY_ALLOW_LIST = "allowlist"
        private const val KEY_DENY_LIST = "denylist"
        private const val KEY_TOKEN_LEVEL = "level"
        private const val TESS_FILES_DIRECTORY = "tessdata"
        private const val TESS_FILES_EXTENSION = ".traineddata"
//        private var DATA_PATH = Environment.getExternalStorageDirectory().toString()
        private lateinit var DATA_PATH: String
        private lateinit var TESS_FILES_PATH: String
    }

    private lateinit var tesseract: TessBaseAPI

    init {
//        if (!DATA_PATH.contains(reactContext.packageName)) {
//            DATA_PATH += File.separator + reactContext.packageName
//        }
        DATA_PATH = reactContext.getExternalFilesDir(null)?.absolutePath ?: ""
        TESS_FILES_PATH = DATA_PATH + File.separator + TESS_FILES_DIRECTORY

        Log.d(name," TESS_FILES_PATH: ${TESS_FILES_PATH}")
    }

    override fun getName(): String {
        return "TesseractOcr"
    }

    @ReactMethod
    fun stop(promise: Promise) {
        Log.d(name, "stop")

        try {
            tesseract.stop()
            tesseract.end()
            promise.resolve("Recognition cancelled successfully")
        } catch (e: Exception) {
            Log.e(name, "Could not stop recognition. ${e}", e)
            promise.reject("Could not stop recognition", e.toString())
        }
    }

    @ReactMethod
    fun recognize(imageSource: String, lang: String, tessOptions: ReadableMap?, promise: Promise) {
        Log.d(name, "recognize")

        try {
            if (shouldCopyTrainedFile(lang)) {
                prepareTrainedFilesDirectory()
                copyTrainedFile(lang)
            }

            val bitmap = getBitmap(imageSource)

            if (bitmap != null) {
                Thread {
                    tesseract = createTesseractAPI(lang, tessOptions)
                    tesseract.setImage(bitmap)
                    tesseract.getHOCRText(0)

                    val recognizedText = tesseract.getUTF8Text()

                    tesseract.end()
                    promise.resolve(recognizedText)
                }.start()
            } else {
                throw IOException("Could not decode a file path into a bitmap.")
            }
        } catch (e: IOException) {
            Log.e(name, "Could not access trained files. ${e}", e)
            promise.reject("Could not access trained ayush files", e.toString())
        } catch (e: Exception) {
            Log.e(name, "Could not recognize text. ${e}", e)
            promise.reject("Could not recognize text", e.toString())
        }
    }

    @ReactMethod
    fun recognizeTokens(imageSource: String, lang: String, tessOptions: ReadableMap?, promise: Promise) {
        Log.d(name, "recognizeTokens")

        try {
            if (shouldCopyTrainedFile(lang)) {
                prepareTrainedFilesDirectory()
                copyTrainedFile(lang)
            }

            val iteratorLevel = getIteratorLevel(tessOptions?.getString(KEY_TOKEN_LEVEL) ?: "word")
            val bitmap = getBitmap(imageSource)

            if (bitmap != null) {
                Thread {
                    tesseract = createTesseractAPI(lang, tessOptions)
                    tesseract.setImage(bitmap)
                    tesseract.getHOCRText(0)

                    val tokens = Arguments.createArray()
                    val iterator = tesseract.resultIterator
                    iterator.begin()

                    do {
                        val bounding = Arguments.createMap()
                        val tempMap = Arguments.createMap()
                        val rect = iterator.getBoundingRect(iteratorLevel)

                        bounding.putInt("bottom", rect.bottom)
                        bounding.putInt("left", rect.left)
                        bounding.putInt("right", rect.right)
                        bounding.putInt("top", rect.top)

                        tempMap.putString("token", iterator.getUTF8Text(iteratorLevel))
                        tempMap.putDouble("confidence", iterator.confidence(iteratorLevel).toDouble())
                        tempMap.putMap("bounding", bounding)
                        tokens.pushMap(tempMap)
                    } while (iterator.next(iteratorLevel))

                    iterator.delete()
                    tesseract.end()
                    promise.resolve(tokens)
                }.start()
            } else {
                throw IOException("Could not decode a file path into a bitmap.")
            }
        } catch (e: IOException) {
            Log.e(name, "Could not access trained files. ${e}", e)
            promise.reject("Could not access trained files", e.toString())
        } catch (e: Exception) {
            Log.e(name, "Could not recognize text. ${e}", e)
            promise.reject("Could not recognize text", e.toString())
        }
    }

    private fun createTesseractAPI(lang: String, tessOptions: ReadableMap?): TessBaseAPI {
        val tessBaseAPI = TessBaseAPI(createProgressNotifier())
        tessBaseAPI.init(DATA_PATH + File.separator, lang)

        tessOptions?.let {
            // Allow List - List of characters you want to detect
            if (it.hasKey(KEY_ALLOW_LIST) && it.getString(KEY_ALLOW_LIST) != null
                    && !it.getString(KEY_ALLOW_LIST).isNullOrEmpty()) {
                Log.d(name, "$KEY_ALLOW_LIST ${it.getString(KEY_ALLOW_LIST)}")
                tessBaseAPI.setVariable(TessBaseAPI.VAR_CHAR_WHITELIST, it.getString(KEY_ALLOW_LIST))
            }

            // Deny List - List of characters you DON'T want to detect
            if (it.hasKey(KEY_DENY_LIST) && it.getString(KEY_DENY_LIST) != null
                    && !it.getString(KEY_DENY_LIST).isNullOrEmpty()) {
                Log.d(name, "$KEY_DENY_LIST ${it.getString(KEY_DENY_LIST)}")
                tessBaseAPI.setVariable(TessBaseAPI.VAR_CHAR_BLACKLIST, it.getString(KEY_DENY_LIST))
            }
        }

        return tessBaseAPI
    }

    private fun createProgressNotifier(): TessBaseAPI.ProgressNotifier {
        return TessBaseAPI.ProgressNotifier { progressValues ->
            Log.d(name, "progress ${progressValues.percent}")
            onProgress(progressValues.percent)
        }
    }

    private fun onProgress(percent: Int) {
        Log.d(name, "onProgressChange $percent")
        val payload = Arguments.createMap()
        payload.putInt("percent", percent)
        reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onProgressChange", payload)
    }

    private fun getIteratorLevel(level: String): Int {
        return when (level) {
            "block" -> TessBaseAPI.PageIteratorLevel.RIL_BLOCK
            "paragraph" -> TessBaseAPI.PageIteratorLevel.RIL_PARA
            "symbol" -> TessBaseAPI.PageIteratorLevel.RIL_SYMBOL
            "line" -> TessBaseAPI.PageIteratorLevel.RIL_TEXTLINE
            else -> TessBaseAPI.PageIteratorLevel.RIL_WORD // word is default
        }
    }

    private fun getBitmap(imageSource: String): Bitmap? {
        val path = if (imageSource.startsWith("file://")) imageSource.replace("file://", "") else imageSource

        if (path.startsWith("http://") || path.startsWith("https://")) {
            // TODO: support remote files
            throw Exception("Cannot select remote files")
        }

        return BitmapFactory.decodeFile(path, BitmapFactory.Options())
    }

    private fun shouldCopyTrainedFile(lang: String): Boolean {
        Log.d(name, "should copy $lang trained files?")
        val filePath = "$TESS_FILES_PATH${File.separator}$lang$TESS_FILES_EXTENSION"
        val file = File(filePath)
        return !file.exists()
    }

    private fun prepareTrainedFilesDirectory() {
        Log.d(name, "prepare trained files directory")
        val dir = File(TESS_FILES_PATH)
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                Log.e(name, "Could not create directory, please make sure the app has write permission")
                throw IOException("Could not create directory")
            }
        }
    }

    private fun copyTrainedFile(lang: String) {
        Log.d(name, "copy tesseract data file ($lang)")
        val assetPath = "$TESS_FILES_DIRECTORY${File.separator}$lang$TESS_FILES_EXTENSION"
        val newAssetPath = "$DATA_PATH${File.separator}$assetPath"
        copyAsset(assetPath, newAssetPath)
    }

    private fun copyAsset(from: String, to: String) {
        Log.d(name, "copy asset $from to $to")

        val `in`: InputStream = reactContext.assets.open(from)
        val out = FileOutputStream(to)
        val buf = ByteArray(1024)
        var len: Int

        while (`in`.read(buf).also { len = it } > 0) {
            out.write(buf, 0, len)
        }
        `in`.close()
        out.close()
    }
}
