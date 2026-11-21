package com.xlg77.roomchatoverlay

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private val requestCodeOverlay = 4101
    private val requestCodeNotifications = 4102
    private val requestCodeFilePicker = 4103
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var roomChatWebView: WebView
    private lateinit var overlayStatus: TextView
    private var startOverlayAfterPermission = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(18, 83, 170)
        window.navigationBarColor = android.graphics.Color.BLACK

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(android.graphics.Color.rgb(245, 249, 255))
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(18), dp(14), dp(18), dp(12))
            setBackgroundColor(android.graphics.Color.rgb(25, 105, 210))
        }
        header.addView(TextView(this).apply {
            text = "RoomChat"
            textSize = 23f
            setTextColor(android.graphics.Color.WHITE)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })
        header.addView(TextView(this).apply {
            text = "친구들과 대화하고, 다른 앱 위에서도 채팅하세요."
            textSize = 12f
            setTextColor(android.graphics.Color.rgb(225, 239, 255))
            setPadding(0, dp(3), 0, 0)
        })
        root.addView(header)

        val controls = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(10), dp(8), dp(10), dp(7))
            setBackgroundColor(android.graphics.Color.WHITE)
        }
        overlayStatus = TextView(this).apply {
            textSize = 12f
            setTextColor(android.graphics.Color.rgb(75, 85, 100))
            text = "오버레이가 꺼져 있습니다."
            setPadding(dp(4), 0, dp(4), dp(7))
        }
        controls.addView(overlayStatus)
        val buttonRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        buttonRow.addView(makeButton("오버레이 켜기") { startOverlayFlow() }, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(5) })
        buttonRow.addView(makeButton("권한 설정") { requestOverlayPermission() }, LinearLayout.LayoutParams(0, dp(42), 1f).apply { marginEnd = dp(5) })
        buttonRow.addView(makeButton("끄기") { stopOverlay() }, LinearLayout.LayoutParams(0, dp(42), 0.65f))
        controls.addView(buttonRow)
        root.addView(controls)

        roomChatWebView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.loadsImagesAutomatically = true
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            CookieManager.getInstance().setAcceptCookie(true)
            CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (uri.host == "xlg77.github.io" || uri.host == "supabase.co" || uri.host?.endsWith(".supabase.co") == true) return false
                    return try {
                        startActivity(Intent(Intent.ACTION_VIEW, uri))
                        true
                    } catch (_: Exception) { false }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    pendingFileCallback?.onReceiveValue(null)
                    pendingFileCallback = filePathCallback
                    val intent = fileChooserParams.createIntent().apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                    }
                    return try {
                        startActivityForResult(intent, requestCodeFilePicker)
                        true
                    } catch (_: Exception) {
                        pendingFileCallback = null
                        false
                    }
                }
            }
            loadUrl("https://xlg77.github.io/roomchat/")
        }
        root.addView(roomChatWebView, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun makeButton(label: String, action: () -> Unit): Button =
        Button(this).apply {
            text = label
            textSize = 12f
            isAllCaps = false
            setOnClickListener { action() }
        }

    private fun startOverlayFlow() {
        if (!Settings.canDrawOverlays(this)) {
            startOverlayAfterPermission = true
            requestOverlayPermission()
            return
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(android.Manifest.permission.POST_NOTIFICATIONS), requestCodeNotifications)
            return
        }
        startOverlayService()
    }

    private fun startOverlayService() {
        CookieManager.getInstance().flush()
        val intent = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        overlayStatus.text = "오버레이가 실행 중입니다. 화면 위의 R 버튼을 눌러 채팅을 열 수 있어요."
        Toast.makeText(this, "RoomChat 오버레이를 시작했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun stopOverlay() {
        stopService(Intent(this, OverlayService::class.java))
        overlayStatus.text = "오버레이가 꺼져 있습니다."
        Toast.makeText(this, "RoomChat 오버레이를 종료했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun requestOverlayPermission() {
        if (Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "오버레이 권한이 이미 허용되어 있습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        startActivityForResult(intent, requestCodeOverlay)
    }

    @Deprecated("Retained for compatibility with Android file chooser and overlay settings")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            requestCodeOverlay -> {
                if (Settings.canDrawOverlays(this)) {
                    Toast.makeText(this, "오버레이 권한이 허용되었습니다.", Toast.LENGTH_SHORT).show()
                    if (startOverlayAfterPermission) {
                        startOverlayAfterPermission = false
                        startOverlayFlow()
                    }
                } else {
                    startOverlayAfterPermission = false
                    Toast.makeText(this, "오버레이 권한이 필요합니다.", Toast.LENGTH_SHORT).show()
                }
            }
            requestCodeFilePicker -> {
                val result = if (resultCode == RESULT_OK) {
                    data?.data?.let { arrayOf(it) }
                } else null
                pendingFileCallback?.onReceiveValue(result)
                pendingFileCallback = null
            }
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == requestCodeNotifications) {
            startOverlayService()
        }
    }

    override fun onResume() {
        super.onResume()
        if (::overlayStatus.isInitialized && Settings.canDrawOverlays(this)) {
            overlayStatus.text = "오버레이 권한이 준비되었습니다. 필요할 때 켜서 사용하세요."
        }
    }

    @Deprecated("Use system back navigation")
    override fun onBackPressed() {
        if (::roomChatWebView.isInitialized && roomChatWebView.canGoBack()) {
            roomChatWebView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::roomChatWebView.isInitialized) {
            roomChatWebView.stopLoading()
            roomChatWebView.destroy()
        }
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        super.onDestroy()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
