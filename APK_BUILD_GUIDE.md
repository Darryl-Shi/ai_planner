# APK Build Guide for AI Planner

This guide explains how to build the Android APK for the AI Planner app with working Google OAuth authentication.

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Java Development Kit (JDK)** 11 or higher
3. **Android Studio** (for Android SDK and Gradle)
4. **Android SDK** with:
   - Android SDK Platform 33+
   - Android SDK Build-Tools
   - Android SDK Command-line Tools

## Environment Setup

### Backend Environment Variables

Update your backend `.env` file with the following:

```env
# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/auth/callback
GOOGLE_REDIRECT_URI_MOBILE=https://yourdomain.com/api/auth/callback/mobile

# Frontend URL
FRONTEND_URL=https://yourdomain.com

# Session Configuration
SESSION_SECRET=your-session-secret
ENCRYPTION_KEY=your-encryption-key

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_planner
```

### Google Cloud Console Configuration

You need to configure **two redirect URIs** in your Google Cloud Console OAuth 2.0 Client:

1. **Web Redirect URI**: `https://yourdomain.com/api/auth/callback`
   - Used for web browser login

2. **Mobile Redirect URI**: `https://yourdomain.com/api/auth/callback/mobile`
   - Used for mobile app login

#### Steps to Configure Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to **APIs & Services** > **Credentials**
4. Click on your OAuth 2.0 Client ID (or create one if you don't have it)
5. Under **Authorized redirect URIs**, add:
   ```
   https://yourdomain.com/api/auth/callback
   https://yourdomain.com/api/auth/callback/mobile
   ```
   Replace `yourdomain.com` with your actual domain
6. Save the changes

**IMPORTANT**: For local development, you can also add:
```
http://localhost:3001/api/auth/callback
http://localhost:3001/api/auth/callback/mobile
```

## How OAuth Works in the APK

The mobile OAuth flow works as follows:

1. User taps "Login with Google" in the app
2. App opens the system browser with Google OAuth URL (via Capacitor Browser plugin)
3. User authenticates with Google in the browser
4. Google redirects to: `https://yourdomain.com/api/auth/callback/mobile?code=...`
5. Backend processes the OAuth code and redirects to: `com.aiplanner.app://oauth-callback?success=true`
6. Android OS captures the custom URL scheme and reopens the app
7. App detects the callback and checks authentication status
8. User is now logged in!

### Custom URL Scheme

The app uses the custom URL scheme: `com.aiplanner.app://oauth-callback`

This is configured in:
- `frontend/android/app/src/main/AndroidManifest.xml` (Android deep linking)
- `frontend/capacitor.config.json` (Capacitor configuration)

## Building the APK

### Step 1: Build the Frontend

```bash
cd /home/user/ai_planner/frontend
npm install
npm run build
```

### Step 2: Sync Capacitor

```bash
npx cap sync android
```

### Step 3: Open Android Studio

```bash
npx cap open android
```

This will open the project in Android Studio.

### Step 4: Build APK in Android Studio

1. In Android Studio, go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
2. Wait for the build to complete
3. Click **locate** in the notification to find the APK file

The APK will be located at:
```
frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### Step 5: Build from Command Line (Alternative)

If you prefer command line:

```bash
cd /home/user/ai_planner/frontend/android
./gradlew assembleDebug
```

For a release build (requires signing):
```bash
./gradlew assembleRelease
```

## Testing the APK

### Install on Device/Emulator

```bash
adb install frontend/android/app/build/outputs/apk/debug/app-debug.apk
```

### Test OAuth Flow

1. Open the app on your device
2. Tap "Login with Google"
3. System browser should open
4. Complete Google authentication
5. You should be redirected back to the app
6. App should show as authenticated

## Troubleshooting

### OAuth Redirect Not Working

1. **Check redirect URIs in Google Cloud Console**
   - Make sure `https://yourdomain.com/api/auth/callback/mobile` is added
   - The URI must match exactly (including https://)

2. **Check backend environment variables**
   - `GOOGLE_REDIRECT_URI_MOBILE` should be set
   - It should match the Google Cloud Console configuration

3. **Check AndroidManifest.xml**
   - Verify the intent filter is present for `com.aiplanner.app://oauth-callback`

### App Not Opening After OAuth

1. **Check deep link configuration**
   - Verify `AndroidManifest.xml` has the correct intent filter
   - Check that `android:exported="true"` is set on MainActivity

2. **Check browser redirect**
   - The backend should redirect to `com.aiplanner.app://oauth-callback?success=true`
   - Check backend logs to confirm the redirect URL

### Network Errors

1. **CORS Issues**
   - Make sure backend CORS is configured to allow requests from `https://localhost` or `capacitor://localhost`
   - Update `capacitor.config.json` if needed

2. **SSL Certificate Issues**
   - For development, you can use `cleartext: true` in `capacitor.config.json`
   - For production, ensure your backend has valid SSL certificates

## Production Release

### Signing the APK

1. Generate a keystore:
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `frontend/android/key.properties`:
```properties
storeFile=../my-release-key.keystore
storePassword=your-store-password
keyAlias=my-key-alias
keyPassword=your-key-password
```

3. Update `frontend/android/app/build.gradle` to use the keystore

4. Build release APK:
```bash
cd frontend/android
./gradlew assembleRelease
```

### App Bundle for Google Play

For Google Play Store, build an AAB (Android App Bundle):

```bash
cd frontend/android
./gradlew bundleRelease
```

The AAB will be at:
```
frontend/android/app/build/outputs/bundle/release/app-release.aab
```

## Summary

Key files for APK OAuth configuration:

1. **Backend**: `backend/server.js` (lines 66-70, 83-106, 190-272)
   - Dual OAuth clients for web and mobile
   - Mobile callback endpoint

2. **Frontend**: `frontend/src/App.jsx` (lines 9-11, 40-67, 108-128)
   - Capacitor detection
   - Browser plugin integration
   - Deep link listener

3. **Android Manifest**: `frontend/android/app/src/main/AndroidManifest.xml` (lines 25-31)
   - Custom URL scheme intent filter

4. **Capacitor Config**: `frontend/capacitor.config.json`
   - Server and plugin configuration

## Environment Variable Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID from Google Cloud | `123456.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret | `GOCSPX-...` |
| `GOOGLE_REDIRECT_URI` | Yes | Web OAuth redirect URI | `https://yourdomain.com/api/auth/callback` |
| `GOOGLE_REDIRECT_URI_MOBILE` | Yes | Mobile OAuth redirect URI | `https://yourdomain.com/api/auth/callback/mobile` |
| `FRONTEND_URL` | Yes | Frontend URL for web redirects | `https://yourdomain.com` |

All OAuth redirect URIs must be registered in Google Cloud Console!
