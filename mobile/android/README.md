# Black to White for Android

The signed APK opens the production web platform in a locked-down Android WebView. It uses the same account, HTTPS origin, site session and server permissions as the web app. It does not keep a second customer/order database on the phone.

## Order alerts

An account holder can explicitly enable a visible Android foreground monitor. It polls the authenticated `/api/platform` endpoint every 30 seconds, remembers seen event IDs locally, and posts private notifications for new order events. Administrator notices about accepted assignments include the assigned worker name when the authenticated admin response contains that profile. Signing out or an expired session stops monitoring and clears notifications. Notifications hide their content on the lock screen.

This does not use Firebase or another paid push service. Android battery restrictions, force-stop, reboot, loss of network, or an expired login may delay alerts. Reopen the app after reboot and allow background battery use for more reliable polling. Orders themselves remain in server PostgreSQL while the phone is offline. Tap the ongoing notification's Stop action to end polling.

The foreground monitor uses Android's declared `specialUse` type for visible, user-started order dispatch monitoring. Google Play reviews this declaration; this APK is signed for direct installation and is not a Play Store submission.

## Install

Transfer `out/release/Black-to-White.apk` to the Android phone, open it, allow installation from that source when Android asks, then sign in. To receive alerts, open **Уведомления** in the app and enable monitoring; allow Android notifications and background battery use.

## Build

Requires JDK 21, Android SDK platform 35 and build-tools 35.0.0, plus a private PKCS#12 signing key. Keep the keystore and password outside Git. The repository intentionally excludes `out/`, key files and local SDK configuration.

Set `ANDROID_SDK_ROOT`, `JAVA_HOME`, `BW_ANDROID_KEYSTORE`, and `BW_ANDROID_KEY_PASSWORD_FILE`, then run `python3 mobile/android/build.py`. `--qa` builds a debug-only APK for `http://127.0.0.1:5196`; use `adb reverse tcp:5196 tcp:5196` with the local QA server. Never distribute the QA APK.

## Verification limits

The release APK was built for Android 8.0 or newer (API 26+) and its v2/v3 signature verifies. No Android phone or emulator was attached during this build, so runtime permission prompts, screen-off polling, OEM battery behavior, camera/file chooser and real push timing still need a device smoke test.
