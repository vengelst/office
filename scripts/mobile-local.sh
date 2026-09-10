#!/bin/bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export APP_VARIANT=development
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://office.vivahome.de/api}"
cd "$PROJECT_ROOT/apps/mobile"
case "${1:-start}" in
  prepare) pnpm exec expo prebuild --platform android --no-install ;;
  build)
    if [ ! -f android/gradlew ]; then pnpm exec expo prebuild --platform android --no-install; fi
    if ! grep -q 'de.vivahome.kiosk.dev' android/app/build.gradle; then
      echo 'Android-Projekt gehört nicht zur Test-App. Zuerst mobile-local.sh prepare ausführen.' >&2; exit 1
    fi
    cd android
    ./gradlew :app:assembleDebug -PreactNativeArchitectures="${ANDROID_ARCHS:-arm64-v8a}" ;;
  install)
    adb install -r android/app/build/outputs/apk/debug/app-debug.apk
    adb reverse tcp:8081 tcp:8081 ;;
  start) pnpm exec expo start --dev-client --localhost ;;
  wifi) pnpm exec expo start --dev-client --lan ;;
  *) echo 'Aufruf: bash scripts/mobile-local.sh prepare|build|install|start|wifi'; exit 1 ;;
esac
