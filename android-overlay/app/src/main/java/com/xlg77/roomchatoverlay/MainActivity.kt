package com.xlg77.roomchatoverlay

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

class MainActivity : Activity() {
    private val requestCodeOverlay = 4101

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(36, 48, 36, 36)
        }
        layout.addView(TextView(this).apply {
            text = "RoomChat 모바일 오버레이"
            textSize = 24f
        })
        layout.addView(TextView(this).apply {
            text = "다른 앱 위에 작은 채팅 버튼을 표시합니다. 권한은 사용자가 직접 허용해야 하며 언제든 설정에서 끌 수 있습니다."
            textSize = 16f
            setPadding(0, 20, 0, 28)
        })
        layout.addView(Button(this).apply {
            text = "오버레이 권한 허용"
            setOnClickListener { requestOverlayPermission() }
        })
        layout.addView(Button(this).apply {
            text = "RoomChat 오버레이 시작"
            setOnClickListener { startOverlayIfAllowed() }
        })
        layout.addView(Button(this).apply {
            text = "오버레이 종료"
            setOnClickListener { stopService(Intent(this@MainActivity, OverlayService::class.java)) }
        })
        setContentView(layout)
    }

    private fun requestOverlayPermission() {
        if (Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "오버레이 권한이 이미 허용되어 있습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
        startActivityForResult(intent, requestCodeOverlay)
    }

    private fun startOverlayIfAllowed() {
        if (!Settings.canDrawOverlays(this)) {
            requestOverlayPermission()
            return
        }
        val intent = Intent(this, OverlayService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        Toast.makeText(this, "RoomChat 오버레이를 시작했습니다.", Toast.LENGTH_SHORT).show()
        finish()
    }

    @Deprecated("Deprecated by Android; retained for broad device compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == requestCodeOverlay && Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "권한이 허용되었습니다. 시작 버튼을 눌러주세요.", Toast.LENGTH_SHORT).show()
        }
    }
}
