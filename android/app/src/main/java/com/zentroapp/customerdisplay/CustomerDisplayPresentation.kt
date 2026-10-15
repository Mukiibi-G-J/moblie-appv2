package com.zentroapp.customerdisplay

import android.app.Presentation
import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.zentroapp.R
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class CustomerDisplayPresentation(
  outerContext: Context,
  display: Display,
) : Presentation(outerContext, display, R.style.CustomerDisplayTheme) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var companyNameView: TextView? = null
  private var headerLogo: ImageView? = null
  private var welcomePanel: View? = null
  private var welcomeLogo: ImageView? = null
  private var welcomeTitle: TextView? = null
  private var welcomeSubtitle: TextView? = null
  private var cartPanel: View? = null
  private var cartHeading: TextView? = null
  private var linesContainer: LinearLayout? = null
  private var statusPanel: View? = null
  private var statusLogo: ImageView? = null
  private var statusTitle: TextView? = null
  private var statusAmount: TextView? = null
  private var statusMessage: TextView? = null
  private var totalBar: View? = null
  private var totalLabel: TextView? = null
  private var totalAmount: TextView? = null
  private var totalFooter: TextView? = null
  private var lastLogoUrl: String? = null
  private var logoLoadToken = 0
  private var companyBitmap: Bitmap? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    setContentView(R.layout.customer_display)
    companyNameView = findViewById(R.id.companyName)
    headerLogo = findViewById(R.id.headerLogo)
    welcomePanel = findViewById(R.id.welcomePanel)
    welcomeLogo = findViewById(R.id.welcomeLogo)
    welcomeTitle = findViewById(R.id.welcomeTitle)
    welcomeSubtitle = findViewById(R.id.welcomeSubtitle)
    cartPanel = findViewById(R.id.cartPanel)
    cartHeading = findViewById(R.id.cartHeading)
    linesContainer = findViewById(R.id.linesContainer)
    statusPanel = findViewById(R.id.statusPanel)
    statusLogo = findViewById(R.id.statusLogo)
    statusTitle = findViewById(R.id.statusTitle)
    statusAmount = findViewById(R.id.statusAmount)
    statusMessage = findViewById(R.id.statusMessage)
    totalBar = findViewById(R.id.totalBar)
    totalLabel = findViewById(R.id.totalLabel)
    totalAmount = findViewById(R.id.totalAmount)
    totalFooter = findViewById(R.id.totalFooter)
    applyFallbackLogos()
  }

  override fun onStop() {
    logoLoadToken += 1
    super.onStop()
  }

  fun applyPayload(payload: ReadableMap?) {
    val map = payload ?: return
    val company = map.string("companyName").ifBlank { "Zentro" }
    companyNameView?.text = company.uppercase()
    applyCompanyLogo(map.string("companyLogo"))

    val mode = map.string("mode").ifBlank { "idle" }
    when (mode) {
      "cart" -> showCart(map)
      "paying" -> showStatus(
        map,
        defaultTitle = "Please pay",
        showTotalBar = true,
      )
      "thanks" -> showStatus(
        map,
        defaultTitle = "Thank you",
        showTotalBar = false,
      )
      else -> showWelcome(map)
    }
  }

  private fun showWelcome(map: ReadableMap) {
    welcomePanel?.visibility = View.VISIBLE
    cartPanel?.visibility = View.GONE
    statusPanel?.visibility = View.GONE
    totalBar?.visibility = View.GONE
    welcomeTitle?.text = map.string("heading").ifBlank { "Welcome" }
    welcomeSubtitle?.text =
      map.string("message").ifBlank { "Your order will appear here" }
  }

  private fun showCart(map: ReadableMap) {
    welcomePanel?.visibility = View.GONE
    cartPanel?.visibility = View.VISIBLE
    statusPanel?.visibility = View.GONE
    totalBar?.visibility = View.VISIBLE
    cartHeading?.text = map.string("heading").ifBlank { "Your order" }
    renderLines(map.getArray("lines"))
    totalLabel?.text = map.string("totalLabel").ifBlank { "TOTAL" }
    totalAmount?.text = map.string("totalAmount").ifBlank { "" }
    totalFooter?.text = map.string("footer")
  }

  private fun showStatus(
    map: ReadableMap,
    defaultTitle: String,
    showTotalBar: Boolean,
  ) {
    welcomePanel?.visibility = View.GONE
    cartPanel?.visibility = View.GONE
    statusPanel?.visibility = View.VISIBLE
    totalBar?.visibility = if (showTotalBar) View.VISIBLE else View.GONE
    statusTitle?.text = map.string("heading").ifBlank { defaultTitle }
    statusAmount?.text = map.string("totalAmount")
    statusMessage?.text = map.string("message")
    if (showTotalBar) {
      totalLabel?.text = map.string("totalLabel").ifBlank { "AMOUNT DUE" }
      totalAmount?.text = map.string("totalAmount")
      totalFooter?.text = map.string("footer")
    }
  }

  private fun applyCompanyLogo(url: String) {
    val trimmed = url.trim()
    if (trimmed.isEmpty()) {
      lastLogoUrl = null
      companyBitmap = null
      applyFallbackLogos()
      return
    }
    if (trimmed == lastLogoUrl && companyBitmap != null) {
      bindCompanyBitmap(companyBitmap)
      return
    }
    lastLogoUrl = trimmed
    val token = ++logoLoadToken
    logoExecutor.execute {
      val bitmap = decodeLogo(trimmed)
      mainHandler.post {
        if (token != logoLoadToken) {
          return@post
        }
        if (bitmap == null) {
          companyBitmap = null
          applyFallbackLogos()
          return@post
        }
        companyBitmap = bitmap
        bindCompanyBitmap(bitmap)
      }
    }
  }

  private fun bindCompanyBitmap(bitmap: Bitmap?) {
    if (bitmap == null) {
      applyFallbackLogos()
      return
    }
    headerLogo?.let { view ->
      view.visibility = View.VISIBLE
      clearTint(view)
      view.setImageBitmap(bitmap)
    }
    welcomeLogo?.let { view ->
      clearTint(view)
      view.setImageBitmap(bitmap)
    }
    statusLogo?.let { view ->
      clearTint(view)
      view.setImageBitmap(bitmap)
    }
  }

  private fun applyFallbackLogos() {
    val tint = ColorStateList.valueOf(
      ContextCompat.getColor(context, R.color.customer_display_text),
    )
    headerLogo?.visibility = View.GONE
    welcomeLogo?.let { view ->
      view.setImageResource(R.drawable.zentro_logo)
      view.imageTintList = tint
    }
    statusLogo?.let { view ->
      view.setImageResource(R.drawable.zentro_logo_icon)
      view.imageTintList = tint
    }
  }

  private fun clearTint(view: ImageView) {
    view.imageTintList = null
    view.clearColorFilter()
  }

  private fun renderLines(lines: ReadableArray?) {
    val container = linesContainer ?: return
    container.removeAllViews()
    if (lines == null || lines.size() == 0) {
      return
    }
    val inflater = layoutInflater
    for (i in 0 until lines.size()) {
      val line = lines.getMap(i) ?: continue
      val row = inflater.inflate(R.layout.customer_display_line, container, false)
      row.findViewById<TextView>(R.id.lineQty).text =
        line.string("qtyLabel").ifBlank { "" }
      row.findViewById<TextView>(R.id.lineName).apply {
        text = line.string("name")
        gravity = Gravity.START or Gravity.CENTER_VERTICAL
      }
      row.findViewById<TextView>(R.id.lineAmount).text = line.string("amount")
      container.addView(row)
    }
  }

  private fun ReadableMap.string(key: String): String {
    if (!hasKey(key) || isNull(key)) {
      return ""
    }
    return try {
      getString(key) ?: ""
    } catch (_: Exception) {
      ""
    }
  }

  companion object {
    private val logoExecutor = Executors.newSingleThreadExecutor()
    private const val MAX_LOGO_PX = 512

    private fun decodeLogo(url: String): Bitmap? {
      return try {
        val bytes = readLogoBytes(url) ?: return null
        if (bytes.isEmpty()) {
          return null
        }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val opts = BitmapFactory.Options().apply {
          inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, MAX_LOGO_PX)
        }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
      } catch (_: Exception) {
        null
      }
    }

    private fun readLogoBytes(url: String): ByteArray? {
      if (url.startsWith("file://") || url.startsWith("/")) {
        val path = url.removePrefix("file://")
        val file = File(path)
        if (!file.exists()) {
          return null
        }
        return file.readBytes()
      }
      val conn = URL(url).openConnection() as HttpURLConnection
      conn.connectTimeout = 8000
      conn.readTimeout = 8000
      conn.instanceFollowRedirects = true
      conn.setRequestProperty("Accept", "image/*")
      return try {
        conn.connect()
        if (conn.responseCode !in 200..299) {
          null
        } else {
          conn.inputStream.use { it.readBytes() }
        }
      } finally {
        conn.disconnect()
      }
    }

    private fun sampleSize(width: Int, height: Int, maxPx: Int): Int {
      var sample = 1
      var w = width
      var h = height
      while (w > maxPx || h > maxPx) {
        sample *= 2
        w /= 2
        h /= 2
      }
      return sample.coerceAtLeast(1)
    }
  }
}
