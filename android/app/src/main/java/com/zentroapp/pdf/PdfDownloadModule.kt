package com.zentroapp.pdf

import android.content.ContentValues
import android.content.Intent
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.File

class PdfDownloadModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "PdfDownload"

  @ReactMethod
  fun saveToDownloads(base64Data: String, fileName: String, promise: Promise) {
    try {
      val safeName = if (fileName.endsWith(".pdf", ignoreCase = true)) {
        fileName
      } else {
        "$fileName.pdf"
      }
      val bytes = Base64.decode(base64Data, Base64.DEFAULT)
      val displayPath = "Downloads/Zentro/$safeName"

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        saveWithMediaStore(bytes, safeName, displayPath, promise)
      } else {
        saveLegacy(bytes, safeName, displayPath, promise)
      }
    } catch (e: Exception) {
      promise.reject("SAVE_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun openPdf(uriString: String, promise: Promise) {
    try {
      val uri = Uri.parse(uriString)
      val intent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(uri, "application/pdf")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactContext.startActivity(intent)
      promise.resolve(true)
    } catch (e: Exception) {
      promise.reject("OPEN_FAILED", e.message, e)
    }
  }

  private fun saveWithMediaStore(
    bytes: ByteArray,
    safeName: String,
    displayPath: String,
    promise: Promise,
  ) {
    val resolver = reactContext.contentResolver
    val relativePath = Environment.DIRECTORY_DOWNLOADS + "/Zentro"
    val contentValues = ContentValues().apply {
      put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
      put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf")
      put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
      put(MediaStore.MediaColumns.IS_PENDING, 1)
    }

    val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues)
      ?: run {
        promise.reject("SAVE_FAILED", "Could not create file in Downloads")
        return
      }

    resolver.openOutputStream(uri)?.use { output ->
      output.write(bytes)
    } ?: run {
      resolver.delete(uri, null, null)
      promise.reject("SAVE_FAILED", "Could not write PDF data")
      return
    }

    contentValues.clear()
    contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0)
    resolver.update(uri, contentValues, null, null)

    val result = Arguments.createMap()
    result.putString("path", displayPath)
    result.putString("uri", uri.toString())
    promise.resolve(result)
  }

  @Suppress("DEPRECATION")
  private fun saveLegacy(
    bytes: ByteArray,
    safeName: String,
    displayPath: String,
    promise: Promise,
  ) {
    val downloadsDir = Environment.getExternalStoragePublicDirectory(
      Environment.DIRECTORY_DOWNLOADS,
    )
    val zentroDir = File(downloadsDir, "Zentro")
    if (!zentroDir.exists() && !zentroDir.mkdirs()) {
      promise.reject("SAVE_FAILED", "Could not create Downloads/Zentro folder")
      return
    }

    val outFile = File(zentroDir, safeName)
    outFile.writeBytes(bytes)
    MediaScannerConnection.scanFile(
      reactContext,
      arrayOf(outFile.absolutePath),
      arrayOf("application/pdf"),
      null,
    )

    val result = Arguments.createMap()
    result.putString("path", displayPath)
    result.putString("uri", Uri.fromFile(outFile).toString())
    promise.resolve(result)
  }
}
