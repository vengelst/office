#!/usr/bin/env bash
# Liefert eine neue Kiosk-APK auf den Office-Server (Sideload + In-App-Update).
#
# Usage:
#   ./scripts/publish-kiosk-apk.sh /path/to/kiosk-1.3.0.apk 1.3.0 1300 "Release notes"
#
# Prüft vor dem Upload Paketname, versionCode, versionName und Signatur.
# Nach dem Upload Größe/Prüfsumme gegen die lokale Datei.
#
set -euo pipefail

APK_PATH="${1:?APK-Pfad fehlt}"
VERSION="${2:?Version fehlt, z.B. 1.3.0}"
VERSION_CODE="${3:?versionCode fehlt, z.B. 1300}"
NOTES="${4:-Update}"
HOST="${DEPLOY_HOST:-vivahome.de}"
REMOTE_DIR="${REMOTE_DIR:-/opt/office/data}"
EXPECTED_PACKAGE="${EXPECTED_PACKAGE:-de.vivahome.kiosk}"
EXPECTED_CERT_SHA256="${EXPECTED_CERT_SHA256:-ffe291a128154573b0b2fabdbcecdf9fbbc18f303193f2f7ee871d07b9ba9f0f}"

ANDROID_BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-${ANDROID_HOME:-$HOME/Library/Android/sdk}/build-tools/37.0.0}"
AAPT2="${AAPT2:-$ANDROID_BUILD_TOOLS/aapt2}"
APKSIGNER="${APKSIGNER:-$ANDROID_BUILD_TOOLS/apksigner}"

die() { echo "✗ $*" >&2; exit 1; }
info() { echo "→ $*"; }

[[ -f "$APK_PATH" ]] || die "APK nicht gefunden: $APK_PATH"
[[ -x "$AAPT2" ]] || die "aapt2 nicht gefunden: $AAPT2 (ANDROID_BUILD_TOOLS setzen)"
[[ -x "$APKSIGNER" ]] || die "apksigner nicht gefunden: $APKSIGNER"

if ! [[ "$VERSION_CODE" =~ ^[0-9]+$ ]]; then
  die "versionCode muss eine positive Ganzzahl sein: $VERSION_CODE"
fi

info "Prüfe lokale APK…"
BADGING="$("$AAPT2" dump badging "$APK_PATH" 2>/dev/null | head -1 || true)"
[[ -n "$BADGING" ]] || die "aapt2 dump badging fehlgeschlagen"

PACKAGE="$(sed -n "s/.*name='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -1)"
APK_VERSION_CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -1)"
APK_VERSION_NAME="$(sed -n "s/.*versionName='\([^']*\)'.*/\1/p" <<<"$BADGING" | head -1)"

[[ "$PACKAGE" == "$EXPECTED_PACKAGE" ]] || die "Paketname falsch: '$PACKAGE' (erwartet $EXPECTED_PACKAGE)"
[[ "$APK_VERSION_CODE" == "$VERSION_CODE" ]] || die "versionCode in APK=$APK_VERSION_CODE, Argument=$VERSION_CODE"
[[ "$APK_VERSION_NAME" == "$VERSION" ]] || die "versionName in APK=$APK_VERSION_NAME, Argument=$VERSION"

info "Prüfe Signatur…"
CERT_RAW="$("$APKSIGNER" verify --print-certs "$APK_PATH" 2>&1 || true)"
CERT_NORM="$(
  printf '%s\n' "$CERT_RAW" \
    | grep -i 'SHA-256 digest:' \
    | head -1 \
    | sed -E 's/.*SHA-256 digest:[[:space:]]*//I' \
    | tr -d '[:space:]:' \
    | tr '[:upper:]' '[:lower:]'
)"
[[ -n "$CERT_NORM" ]] || die "Keine SHA-256-Signatur aus apksigner gelesen"
[[ "$CERT_NORM" == "$EXPECTED_CERT_SHA256" ]] || die "Signatur falsch: $CERT_NORM (erwartet $EXPECTED_CERT_SHA256)"

info "Vergleiche mit Server-APK (versionCode muss steigen)…"
REMOTE_TMP="$(mktemp)"
trap 'rm -f "$REMOTE_TMP" "$TMP_JSON" "$LOCAL_MD5_FILE" 2>/dev/null || true' EXIT
if curl -fsSL -o "$REMOTE_TMP" "https://office.vivahome.de/kiosk.apk"; then
  REMOTE_BADGING="$("$AAPT2" dump badging "$REMOTE_TMP" 2>/dev/null | head -1 || true)"
  REMOTE_CODE="$(sed -n "s/.*versionCode='\([^']*\)'.*/\1/p" <<<"$REMOTE_BADGING" | head -1)"
  if [[ -n "$REMOTE_CODE" ]]; then
    if ! (( VERSION_CODE > REMOTE_CODE )); then
      die "Neuer versionCode ($VERSION_CODE) muss größer sein als Server ($REMOTE_CODE)"
    fi
    info "Server versionCode=$REMOTE_CODE → neu $VERSION_CODE OK"
  else
    info "Warnung: Server-APK versionCode nicht lesbar – Upload fortgesetzt"
  fi
else
  info "Warnung: Server-APK nicht ladbar – Upload fortgesetzt (Erstveröffentlichung?)"
fi

LOCAL_SIZE="$(wc -c <"$APK_PATH" | tr -d ' ')"
LOCAL_MD5="$(md5 -q "$APK_PATH" 2>/dev/null || md5sum "$APK_PATH" | awk '{print $1}')"
LOCAL_MD5_FILE="$(mktemp)"
printf '%s' "$LOCAL_MD5" >"$LOCAL_MD5_FILE"

TMP_JSON="$(mktemp)"
cat >"$TMP_JSON" <<EOF
{
  "version": "$VERSION",
  "versionCode": $VERSION_CODE,
  "apkUrl": "https://office.vivahome.de/kiosk.apk",
  "releasedAt": "$(date +%Y-%m-%d)",
  "notes": $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$NOTES"),
  "mandatory": false
}
EOF

info "Lade APK und Manifest nach $HOST:$REMOTE_DIR …"
ssh "$HOST" "cat > /tmp/kiosk.apk" < "$APK_PATH"
ssh "$HOST" "cat > /tmp/kiosk-version.json" < "$TMP_JSON"
ssh "$HOST" "sudo bash -lc '
  set -e
  mv /tmp/kiosk.apk $REMOTE_DIR/kiosk.apk
  mv /tmp/kiosk-version.json $REMOTE_DIR/kiosk-version.json
  chmod 644 $REMOTE_DIR/kiosk.apk $REMOTE_DIR/kiosk-version.json
  cd /opt/office
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d web --force-recreate --no-deps
'"

info "Prüfe ausgelieferte Datei…"
REMOTE_HEAD="$(curl -fsSI "https://office.vivahome.de/kiosk.apk")"
REMOTE_SIZE="$(printf '%s\n' "$REMOTE_HEAD" | awk -F': ' 'tolower($1)=="content-length"{gsub(/\r/,"",$2); print $2; exit}')"
[[ "$REMOTE_SIZE" == "$LOCAL_SIZE" ]] || die "Größe nach Upload stimmt nicht: remote=$REMOTE_SIZE local=$LOCAL_SIZE"

REMOTE_MD5="$(ssh "$HOST" "md5sum $REMOTE_DIR/kiosk.apk | awk '{print \$1}'")"
[[ "$REMOTE_MD5" == "$LOCAL_MD5" ]] || die "MD5 nach Upload stimmt nicht: remote=$REMOTE_MD5 local=$LOCAL_MD5"

LIVE_JSON="$(curl -fsS "https://office.vivahome.de/kiosk-version.json")"
echo "$LIVE_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
assert d.get('version')==sys.argv[1], d
assert int(d.get('versionCode'))==int(sys.argv[2]), d
print('Manifest live OK:', d.get('version'), d.get('versionCode'))
" "$VERSION" "$VERSION_CODE"

echo
echo "Fertig."
echo "Download: https://office.vivahome.de/download"
echo "APK:      https://office.vivahome.de/kiosk.apk ($LOCAL_SIZE Bytes, md5 $LOCAL_MD5)"
echo "Manifest: https://office.vivahome.de/kiosk-version.json"
echo "Badging:  $BADGING"
