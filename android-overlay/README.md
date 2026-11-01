# RoomChat Android Overlay

Android companion app source for showing RoomChat in a draggable window above other apps.

## Build

- Android Studio Ladybug or newer
- JDK 17
- Android SDK Platform 35

Open this `android-overlay` folder in Android Studio and build the `app` debug variant.

## Use

1. Install the generated APK on an Android device.
2. Open **RoomChat 오버레이**.
3. Tap **오버레이 권한 허용** and enable Android's **다른 앱 위에 표시** permission.
4. Return to the app and tap **RoomChat 오버레이 시작**.
5. Drag the blue R bubble. Tap it to open/close the RoomChat web view above the current app.

The web view uses the existing public RoomChat site and its existing Supabase-backed web client. Users may need to sign in again inside this embedded browser because browser cookies are not automatically shared with Chrome.

## Important

- This is an Android-only companion app. A GitHub Pages website/PWA cannot grant itself Android overlay permission.
- The user explicitly enables and can revoke the overlay permission in Android Settings.
- Android 14+ foreground-service special-use declarations and Google Play review requirements apply. This source is a starting implementation; test on target devices and complete policy declarations before public Play distribution.
- The app does not inspect or control other apps. It only displays a user-requested RoomChat window.
