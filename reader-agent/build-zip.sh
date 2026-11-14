#!/bin/sh
# สร้าง server/downloads/lms-reader-agent.zip ให้โหลดได้ที่ https://api.welcleankhoka.com/download/reader-agent
# รวม node_modules (production) มาด้วย PC ปลายทางจะได้ไม่ต้อง npm install
set -e
cd "$(dirname "$0")"
OUT="$(cd ../server && pwd)/downloads/lms-reader-agent.zip"
STAGE="$(mktemp -d)/lms-reader-agent"
mkdir -p "$STAGE"
cp agent.js rfidReader.js test-reader.js install-service.js uninstall-service.js \
   package.json package-lock.json .env.example README.txt \
   start.bat install-service.bat uninstall-service.bat restart-service.bat status-service.bat test-reader.bat test-power.bat "$STAGE/"
(cd "$STAGE" && npm ci --omit=dev --no-audit --no-fund >/dev/null)
mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
(cd "$(dirname "$STAGE")" && zip -qr "$OUT" lms-reader-agent)
rm -rf "$(dirname "$STAGE")"
echo "สร้างแล้ว: $OUT ($(du -h "$OUT" | cut -f1))"
