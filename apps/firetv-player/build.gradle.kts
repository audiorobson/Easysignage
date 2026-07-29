// Fase 7 — PR 7.4: wrapper Fire TV (kiosk WebView) para o web-player, reaproveitando a
// base do apps/androidtv-player (PR 7.1) com applicationId/manifest ajustados.
// Módulo Gradle isolado do resto do monorepo pnpm/Turbo — ver README.md.
plugins {
    id("com.android.application") version "8.7.2" apply false
    id("org.jetbrains.kotlin.android") version "2.2.10" apply false
}
