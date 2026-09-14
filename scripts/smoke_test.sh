#!/usr/bin/env bash
# Exercise a running backend end-to-end with a sample image.
#   ./scripts/smoke_test.sh [API_BASE]   (default http://localhost:8000)
set -euo pipefail
cd "$(dirname "$0")/.."
API="${1:-http://localhost:8000}/api/v1"
IMG="${IMG:-data/samples/synthetic_sample_03.png}"

[[ -f "$IMG" ]] || python3 scripts/make_sample_images.py >/dev/null

echo "→ health";        curl -fsS "$API/health" | python3 -m json.tool
echo "→ active model";  curl -fsS "$API/models/active" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["mode"], d["status"], d["message"])'
echo "→ predict";       RESP=$(curl -fsS -X POST "$API/predict?explain=true&top_k=3" -F "file=@${IMG}")
echo "$RESP" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("id", d["id"], "| class", d["prediction"]["display_name"], "| conf", round(d["prediction"]["confidence"],3), "| unknown", d["prediction"]["is_unknown"], "| mock", d["is_mock"], "| gradcam", d["explanation"]["gradcam_url"])'
ID=$(echo "$RESP" | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
echo "→ history";       curl -fsS "$API/predictions?page_size=3" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("total", d["total"])'
echo "→ statistics";    curl -fsS "$API/statistics" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("total", d["total_predictions"], "unknown%", d["unknown_percentage"], "mean latency", d["mean_latency_ms"])'
echo "→ invalid file";  curl -sS -o /dev/null -w "status %{http_code}\n" -X POST "$API/predict" -F "file=@README.md;type=image/png"
echo "→ delete $ID";    curl -fsS -X DELETE "$API/predictions/$ID" >/dev/null && echo "deleted"
echo "OK"
