#!/bin/bash
echo "📱 Construction de l'APK..."

# Build React
cd frontend
npm run build

# Installer Capacitor si pas fait
npm install @capacitor/cli @capacitor/core @capacitor/android
npx cap init LlamaBuzzAI com.crazytech.llamabuzz
npx cap add android

# Copier le build
npx cap copy

# Build APK
cd android
./gradlew assembleDebug

echo "✅ APK généré : android/app/build/outputs/apk/debug/app-debug.apk"
