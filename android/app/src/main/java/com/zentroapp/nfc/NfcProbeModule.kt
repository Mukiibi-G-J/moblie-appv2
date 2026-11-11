package com.zentroapp.nfc

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Hardware probe only. Reports that a tap was seen and which NFC technologies
 * the reader reported. It does not send card commands or read a card number.
 */
class NfcProbeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())

  override fun getName(): String = "NfcProbe"

  @ReactMethod
  fun getStatus(promise: Promise) {
    val adapter = NfcAdapter.getDefaultAdapter(reactContext)
    val map = Arguments.createMap()
    map.putBoolean("supported", adapter != null)
    map.putBoolean("enabled", adapter?.isEnabled == true)
    promise.resolve(map)
  }

  @ReactMethod
  fun start(promise: Promise) {
    mainHandler.post {
      val activity = reactContext.currentActivity
      val adapter = NfcAdapter.getDefaultAdapter(reactContext)
      if (activity == null || adapter == null || !adapter.isEnabled) {
        promise.resolve(false)
        return@post
      }
      val flags =
        NfcAdapter.FLAG_READER_NFC_A or
          NfcAdapter.FLAG_READER_NFC_B or
          NfcAdapter.FLAG_READER_NFC_F or
          NfcAdapter.FLAG_READER_NFC_V or
          NfcAdapter.FLAG_READER_NFC_BARCODE or
          NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
      try {
        adapter.enableReaderMode(activity, { tag -> onTag(tag) }, flags, null)
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("NFC_START", e.message, e)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    mainHandler.post {
      disable()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun openSettings() {
    val intent = Intent(Settings.ACTION_NFC_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      reactContext.startActivity(intent)
    } catch (_: Exception) {
      val fallback = Intent(Settings.ACTION_WIRELESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      reactContext.startActivity(fallback)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by NativeEventEmitter.
  }

  private fun disable() {
    val activity = reactContext.currentActivity ?: return
    val adapter = NfcAdapter.getDefaultAdapter(reactContext) ?: return
    try {
      adapter.disableReaderMode(activity)
    } catch (_: Exception) {
    }
  }

  private fun onTag(tag: Tag) {
    val techs = tag.techList.map { it.substringAfterLast('.') }
    val map = Arguments.createMap().apply {
      putArray("techs", Arguments.fromList(techs))
      putBoolean("contactlessCard", techs.any { it == "IsoDep" })
      putDouble("at", System.currentTimeMillis().toDouble())
    }
    mainHandler.post { emit(map) }
  }

  private fun emit(map: WritableMap) {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("NfcProbeTap", map)
  }
}
