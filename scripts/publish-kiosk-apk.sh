#!/usr/bin/env bash
# Liefert eine neue Kiosk-APK auf den Office-Server (Sideload + In-App-Update).
#
# Usage:
#   ./scripts/publish-kiosk-apk.sh /path/to/kiosk-1.3.0.apk 1.3.0 1300 "Release notes"
#
set -euo pipefail

APK_PATH="${1:?APK-Pfad fehlt}"
VERSION="${2:?Version fehlt, z.B. 1.3.0}"
VERSION_CODE="${3:?versionCode fehlt, z.B. 1300}"
NOTES="${4:-Update}"
HOST="${DEPLOY_HOST:-vivahome.de}"
REMOTE_DIR="${REMOTE_DIR:-/opt/office/data}"

if [[ ! -f "$APK_PATH" ]]; then
  echo "APK nicht gefunden: $APK_PATH" >&2
  exit 1
fi

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

echo "→ Lade APK und Manifest nach $HOST:$REMOTE_DIR …"
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

rm -f "$TMP_JSON"
echo "Fertig."
echo "Download: https://office.vivahome.de/download"
echo "APK:      https://office.vivahome.de/kiosk.apk"
echo "Manifest: https://office.vivahome.de/kiosk-version.json"
