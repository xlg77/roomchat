package com.xlg77.roomchatoverlay

import android.app.AlertDialog
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
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
import android.webkit.ValueCallback
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, buildNotification())
        }
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
                    p.x += dx.toInt()
                    p.y += dy.toInt()
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
        val container = FrameLayout(this).apply { setBackgroundColor(Color.TRANSPARENT); elevation = 18f }
        val page = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.loadsImagesAutomatically = true
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    super.onPageFinished(view, url)
                    view.evaluateJavascript(OVERLAY_CHAT_CSS, null)
                }
            }
            webChromeClient = WebChromeClient()
            loadUrl("https://xlg77.github.io/roomchat/?overlay=1")
        }
        webView = page
        container.addView(page, FrameLayout.LayoutParams(-1, -1).apply { topMargin = dp(30) })
        val dragBar = TextView(this).apply {
            text = "☰  RoomChat 채팅"
            textSize = 12f
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), 0, dp(118), 0)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(75, 75, 75))
            setOnTouchListener(DragTouchListener { dx, dy ->
                panelParams?.let { p ->
                    p.x += dx.toInt()
                    p.y += dy.toInt()
                    runCatching { windowManager.updateViewLayout(container, p) }
                }
            })
        }
        container.addView(dragBar, FrameLayout.LayoutParams(-1, dp(30), Gravity.TOP))
        val chooseRoom = TextView(this).apply {
            text = "방 선택"
            textSize = 12f
            gravity = Gravity.CENTER
            setPadding(dp(8), 0, dp(8), 0)
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(75, 75, 75))
            setOnClickListener { showRoomPicker(page) }
        }
        container.addView(chooseRoom, FrameLayout.LayoutParams(dp(76), dp(30), Gravity.TOP or Gravity.END).apply { rightMargin = dp(42) })
        val close = TextView(this).apply {
            text = "×"
            textSize = 25f
            gravity = Gravity.CENTER
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(35, 115, 235))
            setOnClickListener { closePanel() }
        }
        container.addView(close, FrameLayout.LayoutParams(dp(42), dp(30), Gravity.TOP or Gravity.END))
        val params = WindowManager.LayoutParams(
            max(1, resources.displayMetrics.widthPixels - dp(28)),
            dp(300),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply { gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL; y = dp(90) }
        panel = container
        panelParams = params
        windowManager.addView(container, params)
    }

    private fun showRoomPicker(page: WebView) {
        page.evaluateJavascript("window.RoomChatOverlay ? window.RoomChatOverlay.getRooms() : []") { raw ->
            val json = raw ?: "[]"
            val names = mutableListOf<String>()
            val ids = mutableListOf<String>()
            try {
                val array = org.json.JSONArray(json)
                for (i in 0 until array.length()) {
                    val item = array.getJSONObject(i)
                    ids.add(item.optString("id"))
                    names.add(item.optString("name", "이름 없는 방"))
                }
            } catch (_: Exception) {}
            if (names.isEmpty()) {
                android.widget.Toast.makeText(this, "채팅방 목록을 불러오는 중이에요. 잠시 후 다시 눌러 주세요.", android.widget.Toast.LENGTH_SHORT).show()
                return@evaluateJavascript
            }
            AlertDialog.Builder(this)
                .setTitle("연결할 채팅방")
                .setItems(names.toTypedArray()) { _, which ->
                    val selectedId = org.json.JSONObject.quote(ids[which])
                    page.evaluateJavascript(
                        "window.RoomChatOverlay && window.RoomChatOverlay.selectRoom($selectedId)",
                        ValueCallback { result ->
                            if (result == "true") {
                                android.widget.Toast.makeText(this, "${names[which]} 방에 연결했어요.", android.widget.Toast.LENGTH_SHORT).show()
                            } else {
                                android.widget.Toast.makeText(this, "채팅방을 선택하지 못했어요. 새로고침 후 다시 시도해 주세요.", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }
                .setNegativeButton("취소", null)
                .show()
        }
    }

    private fun closePanel() {
        panel?.let { runCatching { windowManager.removeView(it) } }
        panel = null
        webView?.destroy()
        webView = null
    }

    private val OVERLAY_CHAT_CSS = """
        (function(){
          if(document.getElementById('rc-native-overlay-style')) return;
          const style=document.createElement('style');
          style.id='rc-native-overlay-style';
          style.textContent=`
            html,body{width:100%!important;height:100%!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:transparent!important}
            #app-loading{display:none!important}
            .app-shell{display:block!important;width:100%!important;height:calc(100vh - 30px)!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important}
            .app-shell>:not(.chat-panel){display:none!important}
            .chat-panel{display:flex!important;position:relative!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:rgba(112,112,112,.84)!important;overflow:hidden!important}
            .chat-panel>:not(#message-list):not(.composer-wrap){display:none!important}
            #message-list{display:block!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;padding:3px 7px!important;margin:0!important;background:transparent!important;border:0!important;border-radius:0!important}
            .message-item{max-width:100%!important;margin:0 0 2px!important;padding:0!important;background:transparent!important;border:0!important;box-shadow:none!important}
            .message-content{overflow-wrap:anywhere!important;word-break:normal!important}
            .composer-wrap{display:block!important;flex:0 0 auto!important;margin:0!important;padding:4px!important;background:rgba(220,220,220,.94)!important;border-top:1px solid rgba(255,255,255,.6)!important}
            .composer{display:flex!important;gap:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important}
            .composer>:not(#message-input){display:none!important}
            #message-input{display:block!important;flex:1 1 auto!important;width:100%!important;min-width:0!important;min-height:24px!important;max-height:60px!important;margin:0!important;padding:3px 5px!important;border:0!important;border-radius:0!important;outline:none!important;resize:none!important;background:rgba(255,255,255,.45)!important;color:#222!important;font:600 13px Arial,sans-serif!important}
            #message-input::placeholder{color:#555!important;opacity:1!important}
            .composer-foot,.toast,.mention-popup{display:none!important}
          `;
          document.head.appendChild(style);
          const input=document.querySelector('#message-input');
          if(input) input.placeholder='Tap here to chat';
        })();
    """.trimIndent()

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
            .setContentText("다른 앱 위에서 RoomChat 채팅을 표시하고 있습니다.")
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
        private var moved = false
        override fun onTouch(view: View, event: MotionEvent): Boolean {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = event.rawX
                    lastY = event.rawY
                    moved = false
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - lastX
                    val dy = event.rawY - lastY
                    if (kotlin.math.abs(dx) > 2f || kotlin.math.abs(dy) > 2f) moved = true
                    lastX = event.rawX
                    lastY = event.rawY
                    move(dx, dy)
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    if (!moved) view.performClick()
                    return true
                }
            }
            return false
        }
    }
}
