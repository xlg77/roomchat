package com.xlg77.roomchatoverlay

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.max

class OverlayService : Service() {
    private lateinit var windowManager: WindowManager
    private var bubble: TextView? = null
    private var panel: FrameLayout? = null
    private var webView: WebView? = null
    private var bubbleParams: WindowManager.LayoutParams? = null
    private var panelParams: WindowManager.LayoutParams? = null
    private val channelId = "roomchat_overlay"

    override fun onCreate() {
        super.onCreate()
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        createNotificationChannel()
        startForeground(1, buildNotification())
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        showBubble()
    }

    private fun showBubble() {
        if (bubble != null) return
        val view = TextView(this).apply {
            text = "R"
            textSize = 21f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setBackgroundColor(Color.rgb(35, 115, 235))
            elevation = 12f
            setOnClickListener { togglePanel() }
            setOnTouchListener(DragTouchListener { dx, dy ->
                bubbleParams?.let { p ->
                    p.x -= dx
                    p.y -= dy
                    runCatching { windowManager.updateViewLayout(this, p) }
                }
            })
        }
        val params = WindowManager.LayoutParams(
            dp(54), dp(54), WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.START; x = dp(12); y = dp(180) }
        bubble = view
        bubbleParams = params
        windowManager.addView(view, params)
    }

    private fun togglePanel() {
        if (panel != null) {
            closePanel()
            return
        }
        val container = FrameLayout(this).apply { setBackgroundColor(Color.WHITE); elevation = 18f }
        val page = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            webViewClient = WebViewClient()
            webChromeClient = WebChromeClient()
            loadUrl("https://xlg77.github.io/roomchat/")
        }
        webView = page
        container.addView(page, FrameLayout.LayoutParams(-1, -1))
        val close = TextView(this).apply {
            text = "×"
            textSize = 25f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(35, 115, 235))
            setOnClickListener { closePanel() }
        }
        container.addView(close, FrameLayout.LayoutParams(dp(42), dp(42), Gravity.TOP or Gravity.END))
        val params = WindowManager.LayoutParams(
            max(1, resources.displayMetrics.widthPixels - dp(28)),
            dp(420),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL; y = dp(90) }
        panel = container
        panelParams = params
        windowManager.addView(container, params)
    }

    private fun closePanel() {
        panel?.let { runCatching { windowManager.removeView(it) } }
        panel = null
        webView?.destroy()
        webView = null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "RoomChat 오버레이", NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
            Notification.Builder(this, channelId) else Notification.Builder(this)
        return builder.setContentTitle("RoomChat 오버레이 실행 중")
            .setContentText("알림에서 서비스를 종료할 수 있습니다.")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    override fun onDestroy() {
        closePanel()
        bubble?.let { runCatching { windowManager.removeView(it) } }
        bubble = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private class DragTouchListener(private val move: (Float, Float) -> Unit) : View.OnTouchListener {
        private var lastX = 0f
        private var lastY = 0f
        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> { lastX = event.rawX; lastY = event.rawY; return true }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - lastX
                    val dy = event.rawY - lastY
                    lastX = event.rawX; lastY = event.rawY
                    move(dx, dy)
                    return true
                }
                MotionEvent.ACTION_UP -> { view.performClick(); return true }
            }
            return false
        }
    }
}
