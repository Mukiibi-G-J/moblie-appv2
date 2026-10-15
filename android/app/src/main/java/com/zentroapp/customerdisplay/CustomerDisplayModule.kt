package com.zentroapp.customerdisplay

import android.app.Activity
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Display
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class CustomerDisplayModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext),
  LifecycleEventListener,
  DisplayManager.DisplayListener {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var presentation: CustomerDisplayPresentation? = null
  private var lastPayload: ReadableMap? = null
  private var displayManager: DisplayManager? = null
  private var showRetryCount = 0

  override fun getName(): String = "CustomerDisplay"

  override fun initialize() {
    super.initialize()
    reactContext.addLifecycleEventListener(this)
    val dm = reactContext.getSystemService(DisplayManager::class.java)
    displayManager = dm
    dm?.registerDisplayListener(this, mainHandler)
  }

  override fun onCatalystInstanceDestroy() {
    displayManager?.unregisterDisplayListener(this)
    reactContext.removeLifecycleEventListener(this)
    mainHandler.post { dismissPresentation() }
    super.onCatalystInstanceDestroy()
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    try {
      promise.resolve(statusMap())
    } catch (e: Exception) {
      promise.reject("STATUS_FAILED", e.message, e)
    }
  }

  @ReactMethod
  fun show(promise: Promise) {
    mainHandler.post {
      try {
        val attached = showPresentation()
        emitStatus()
        promise.resolve(statusMap(attached))
      } catch (e: Exception) {
        promise.reject("SHOW_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun hide(promise: Promise) {
    mainHandler.post {
      try {
        dismissPresentation()
        emitStatus()
        promise.resolve(statusMap(false))
      } catch (e: Exception) {
        promise.reject("HIDE_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun update(payload: ReadableMap, promise: Promise) {
    val copy = try {
      Arguments.fromBundle(Arguments.toBundle(payload) ?: android.os.Bundle())
    } catch (_: Exception) {
      payload
    }
    lastPayload = copy
    mainHandler.post {
      try {
        if (presentation?.isShowing == true) {
          presentation?.applyPayload(copy)
        } else {
          showPresentation()
        }
        promise.resolve(true)
      } catch (e: Exception) {
        promise.reject("UPDATE_FAILED", e.message, e)
      }
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter
  }

  override fun onHostResume() {
    mainHandler.post {
      showPresentation()
      emitStatus()
    }
  }

  override fun onHostPause() {
    // Keep the customer screen up while the cashier uses dialogs.
  }

  override fun onHostDestroy() {
    mainHandler.post { dismissPresentation() }
  }

  override fun onDisplayAdded(displayId: Int) {
    mainHandler.post {
      showPresentation()
      emitStatus()
    }
  }

  override fun onDisplayRemoved(displayId: Int) {
    mainHandler.post {
      if (presentation?.display?.displayId == displayId) {
        dismissPresentation()
      }
      emitStatus()
    }
  }

  override fun onDisplayChanged(displayId: Int) {
    // no-op
  }

  private fun showPresentation(): Boolean {
    val activity = currentActivity ?: return presentation?.isShowing == true
    if (activity.isFinishing || isDestroyed(activity)) {
      return false
    }
    val display = findCustomerDisplay() ?: run {
      if (presentation?.isShowing == true) {
        dismissPresentation()
      }
      return false
    }
    val current = presentation
    if (current?.isShowing == true && current.display.displayId == display.displayId) {
      lastPayload?.let { current.applyPayload(it) }
      return true
    }
    dismissPresentation()
    val next = CustomerDisplayPresentation(activity, display)
    next.setOnDismissListener {
      if (presentation === next) {
        presentation = null
        emitStatus()
      }
    }
    try {
      next.show()
      lastPayload?.let { next.applyPayload(it) }
      presentation = next
      showRetryCount = 0
      return true
    } catch (_: Exception) {
      try {
        next.dismiss()
      } catch (_: Exception) {
      }
      presentation = null
      if (showRetryCount < 5) {
        showRetryCount += 1
        mainHandler.postDelayed({ showPresentation() }, 400)
      }
      return false
    }
  }

  private fun dismissPresentation() {
    val current = presentation
    presentation = null
    if (current != null) {
      try {
        current.dismiss()
      } catch (_: Exception) {
      }
    }
  }

  private fun findCustomerDisplay(): Display? {
    val dm = displayManager ?: return null
    val presentationDisplays =
      dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)
    if (presentationDisplays.isNotEmpty()) {
      return presentationDisplays[0]
    }
    return dm.displays.firstOrNull { it.displayId != Display.DEFAULT_DISPLAY }
  }

  private fun statusMap(attachedOverride: Boolean? = null): com.facebook.react.bridge.WritableMap {
    val display = findCustomerDisplay()
    val attached = attachedOverride ?: (presentation?.isShowing == true)
    return Arguments.createMap().apply {
      putBoolean("hasSecondaryDisplay", display != null)
      putBoolean("attached", attached && display != null)
      putInt("displayId", display?.displayId ?: -1)
      putString("displayName", display?.name ?: "")
    }
  }

  private fun emitStatus() {
    if (!reactContext.hasActiveReactInstance()) {
      return
    }
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("CustomerDisplayStatus", statusMap())
  }

  private fun isDestroyed(activity: Activity): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
      activity.isDestroyed
    } else {
      false
    }
  }
}
