# Office Android: lokal testen und Updates verteilen

## Einrichtung

Projekt: `/Users/volkhardengelstadter/Coding/Office`.
Quellcode: `apps/mobile`. Es muss nichts in ein zweites Projekt kopiert werden.
Der generierte Ordner `apps/mobile/android` ist das Android-Studio-Projekt. Er wird nicht in Git eingecheckt.

Die lokale Variante heißt **VH Kiosk Test**, Paket `de.vivahome.kiosk.dev`. Sie kann neben der normalen App (`de.vivahome.kiosk`) installiert werden. Ihre Anmeldung und lokalen Daten sind getrennt. Sie greift standardmäßig auf die echte Office-API unter https://office.vivahome.de/api zu; Änderungen dort wirken auf echte Daten.

## Handy verbinden

1. Android-Einstellungen: Unter „Über das Telefon“ / „Softwareinformationen“ siebenmal auf „Buildnummer“ tippen. Herstellerabhängig kann der Menüpfad abweichen.
2. In den Entwickleroptionen USB-Debugging aktivieren.
3. Handy mit einem USB-Datenkabel an den Mac anschließen, entsperren und die Debugging-Verbindung bestätigen.
4. Im Terminal einmal in den Projektordner wechseln:

```bash
cd /Users/volkhardengelstadter/Coding/Office
```

## Testversion bauen und installieren

Die vorbereiteten Befehle setzen Android-SDK, Java, Test-App-ID und API-Adresse automatisch:

```bash
bash scripts/mobile-local.sh prepare
bash scripts/mobile-local.sh build
bash scripts/mobile-local.sh install
bash scripts/mobile-local.sh start
```

`prepare` erzeugt das native Android-Projekt. Nur beim ersten Mal oder nach Änderungen an nativen Modulen/App-Konfiguration nötig. `build` erzeugt eine Debug-APK für ARM64-Handys. Der erste Build lädt Werkzeuge und Abhängigkeiten herunter. Weitere Builds verwenden die vorhandenen Zwischenergebnisse. Für andere Gerätearchitekturen kann ANDROID_ARCHS gesetzt werden.

`install` installiert die Test-App und verbindet Port 8081 des Handys per USB mit dem Mac. Bei mehreren verbundenen Geräten muss das Ziel über ANDROID_SERIAL gewählt werden. Danach VH Kiosk Test öffnen und den lokalen Entwicklungsserver auswählen, falls er nicht automatisch geöffnet wird.

`start` startet Metro, den Entwicklungsserver. Dieses Terminal bleibt während des Testens geöffnet. Nach erneutem Verbinden des Handys ggf. `adb reverse tcp:8081 tcp:8081` mit dem Android-SDK-adb erneut setzen. Alternativ: `bash scripts/mobile-local.sh wifi`; Mac und Handy müssen einander im selben Netzwerk erreichen und die Test-App muss die angezeigte Entwicklungsadresse öffnen.

APK: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Diese Datei ist eine Entwicklungs-App, kein Ersatz für die verteilte Release-APK. Normalerweise benötigt sie beim Testen den laufenden Entwicklungsserver.

## Was geschieht bei Änderungen in Cursor?

Cursor speichert die geänderten Dateien im selben Projekt. Metro beobachtet diese Dateien und liefert Änderungen an JavaScript/TypeScript und Oberfläche an die verbundene Test-App. Fast Refresh aktualisiert die Anzeige; bei manchen Änderungen ist ein Neuladen nötig. Neue native Bibliotheken, Berechtigungen oder native Konfiguration benötigen erneut prepare/build/install.

Änderungen an der Server-API müssen separat auf dem Server bereitgestellt werden. Änderungen am Web-Client ändern nicht automatisch die native App.

Die Test-App zeigt im Debug-Modus keinen produktiven APK-Update-Dialog. Andere Nutzer bekommen durch das lokale Speichern in Cursor keine neuen App-Versionen.

## Verteilen: vorhandener APK-Updateweg

Das Projekt besitzt bereits eine Update-Funktion. Beim Einhängen der App-Oberfläche wird `kiosk-version.json` vom Office-Server geprüft. Ein höherer Versionscode bzw. eine höhere Version löst einen Update-Hinweis aus. Nach Zustimmung lädt die App die APK und öffnet den Android-Installer; der Nutzer bestätigt dort die Installation. Das ist kein stilles Hintergrundupdate.

Ablauf: Änderung testen → Produktionsversion/versionCode erhöhen → signierte Release-APK mit ursprünglicher Paket-ID und ursprünglichem Signaturschlüssel bauen → APK und Versionsdatei gemeinsam veröffentlichen. Das vorhandene Skript `scripts/publish-kiosk-apk.sh` übernimmt die Veröffentlichung. Die Debug-APK darf damit nicht verteilt werden.

Vor einem Produktionsbuild darf das lokal erzeugte Test-Android-Projekt nicht versehentlich übernommen werden. EAS verwendet standardmäßig die Git-Ignore-Regeln; android/ ist hier ignoriert. Bei direktem Android-Studio-Releasebuild muss zuerst ein Produktionsprojekt mit der richtigen Konfiguration und Signierung erzeugt werden. Ein Wechsel zwischen Varianten darf nicht mit einem unpassenden bestehenden nativen Projekt erfolgen.

## Gewünschte Updates ohne neue APK: zusätzliche Ausbaustufe

Expo Updates / EAS Update kann kompatible JavaScript-/UI-/Asset-Änderungen ausliefern, ohne jedes Mal eine neue APK zu installieren. Dies ist derzeit nicht eingerichtet. Dafür wird einmal eine neue Release-APK mit expo-updates, Update-URL, Kanälen und Runtime-Version benötigt. Danach werden getestete Updates ausdrücklich veröffentlicht; bloßes Speichern in Cursor veröffentlicht nichts.

Sinnvolle Kanäle: Vorschau für Testgeräte und Produktion für freigegebene Versionen. Native Änderungen erfordern weiterhin eine neue APK. Der genaue Download-/Aktivierungszeitpunkt wird konfiguriert; keine Zusage eines sofortigen Updates einer gerade laufenden App. Vor Veröffentlichung müssen Rückfallstrategie und Kompatibilität geprüft werden.

Quellen:
- https://docs.expo.dev/develop/development-builds/introduction/
- https://docs.expo.dev/develop/development-builds/development-workflows/
- https://docs.expo.dev/eas-update/runtime-versions/
