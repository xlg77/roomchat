# RoomChat Android

RoomChat Android is a single APK containing the normal RoomChat app and its optional floating chat overlay.

## Build

- Android Studio Ladybug or newer
- JDK 17
- Android SDK Platform 35

Open this `android-overlay` folder in Android Studio and build the `app` debug variant. GitHub Actions also builds and publishes a prerelease APK when this project changes.

## Use

1. Install and open **RoomChat**.
2. Sign in to the existing RoomChat site inside the app.
3. Use the normal chat UI directly in the app.
4. To use the Roblox-style floating chat, tap **오버레이 켜기**.
5. Allow Android's **다른 앱 위에 표시** permission.
6. If Android asks for notification permission, allow it for the ongoing overlay notification.
7. Return to RoomChat and tap **오버레이 켜기** again if it did not start automatically.
8. Drag the floating R bubble, then tap it to show or hide the chat panel. Use the panel's room selector to choose a room.

The main app and overlay use Android WebViews in the same application, so their RoomChat origin cookies and web storage are shared by Android's WebView profile. The overlay still requires the user to grant Android overlay permission.

## Notes

- Package ID remains `com.xlg77.roomchatoverlay` so an existing installation can be upgraded when signatures match.
- This is a debug-signed prerelease APK for testing, not a Play Store production release.
- Android foreground-service and overlay permission behavior must be tested on target devices and Android versions before public distribution.
- The overlay displays RoomChat content only; it does not inspect or control Roblox or other apps.
