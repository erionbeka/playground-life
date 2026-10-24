$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "C:\Users\User\AppData\Local\Android\Sdk"
$env:ANDROID_PREFS_ROOT = $null
$env:VITE_API_URL = "https://playground-life.com"

Write-Host "JAVA_HOME set to: $env:JAVA_HOME"
Write-Host "ANDROID_HOME set to: $env:ANDROID_HOME"
Write-Host "VITE_API_URL set to: $env:VITE_API_URL"

Write-Host "Generating full-bleed app icons..."
python ".artifacts/375b29ba-56e3-4688-a0d5-e8f1e5b80826/scratch/generate_icons.py"

Write-Host "Building frontend with Vite..."
npx cross-env NODE_ENV=production VITE_API_URL=https://playground-life.com vite build

Write-Host "Syncing Capacitor Android..."
npx cap sync android

Write-Host "Cleaning and building fresh Android debug APK with Gradle..."
Set-Location android
.\gradlew clean
.\gradlew assembleDebug
