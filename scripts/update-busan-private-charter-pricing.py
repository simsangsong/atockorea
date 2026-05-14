#!/usr/bin/env python3
"""
Update busan-private-car-charter-cruise-shore pricing across all 6 locales:
- Base (1-6 pax): $359 sale / $379 original (5% off)
- 7-12 pax: 2x → $718 sale / $758 original
- 13+ pax: 3x → $1077 sale / $1137 original

Updates:
  - top-level `price` object (sale + original + discount%)
  - `catalog_card.priceLabel` and `catalog_card.shortCardDescription` pricing hint
  - `pricingTiers` (currency/unit/durations/tiers) with the 3-tier structure
"""
import json
from pathlib import Path

DIR = Path(
    r"C:\Users\sangsong\atockorea\components\product-tour-static"
    r"\busan-private-car-charter-cruise-shore"
)

BASE_SALE = 359
BASE_ORIG = 379
DURATION = "8h"

TIERS = [
    {"paxLabel": "1–6 pax",  "paxMin": 1,  "paxMax": 6,  "prices": {DURATION: 359}},
    {"paxLabel": "7–12 pax", "paxMin": 7,  "paxMax": 12, "prices": {DURATION: 718}},
    {"paxLabel": "13+ pax",  "paxMin": 13, "paxMax": 20, "prices": {DURATION: 1077}},
]

PRICE_OBJ = {
    "amountLabel": str(BASE_SALE),
    "currency": "USD",
    "per": "vehicle",
    "salePriceUsd": BASE_SALE,
    "originalPriceUsd": BASE_ORIG,
    "discountPercent": round((BASE_ORIG - BASE_SALE) / BASE_ORIG * 100),
}

PRICING_TIERS = {
    "currency": "USD",
    "unit": "vehicle",
    "durations": [DURATION],
    "tiers": TIERS,
}

# Localized priceLabel strings shown on the catalog card
PRICE_LABELS = {
    "en":    f"From US${BASE_SALE} per vehicle (was ${BASE_ORIG}, 1–6 pax, 8h) · 7–12 pax 2× · 13+ pax 3×",
    "ko":    f"차량 1대 8시간 기준 ${BASE_SALE} (정가 ${BASE_ORIG}, 1–6인) · 7–12인 2배 · 13인 이상 3배",
    "ja":    f"車両1台8時間 ${BASE_SALE}（定価 ${BASE_ORIG}、1–6名）· 7–12名は2倍 · 13名以上は3倍",
    "zh":    f"车辆1辆8小时 ${BASE_SALE}（原价 ${BASE_ORIG}，1–6人）· 7–12人 2倍 · 13人以上 3倍",
    "zh-TW": f"車輛1輛8小時 ${BASE_SALE}（原價 ${BASE_ORIG}，1–6人）· 7–12人 2倍 · 13人以上 3倍",
    "es":    f"Desde US${BASE_SALE} por vehículo (antes ${BASE_ORIG}, 1–6 pax, 8h) · 7–12 pax 2× · 13+ pax 3×",
}


def process(locale_suffix: str):
    p = DIR / f"busan-private-car-charter-cruise-shore.{locale_suffix}.json"
    if not p.exists():
        print(f"  [skip] {p.name} not found")
        return
    doc = json.loads(p.read_text(encoding="utf-8"))

    # 1) Top-level price
    doc["price"] = PRICE_OBJ

    # 2) Catalog card priceLabel
    if isinstance(doc.get("catalog_card"), dict):
        doc["catalog_card"]["priceLabel"] = PRICE_LABELS.get(locale_suffix, PRICE_LABELS["en"])

    # 3) PricingTiers
    doc["pricingTiers"] = PRICING_TIERS

    # 4) sticky_booking_bar.price if present
    if isinstance(doc.get("sticky_booking_bar"), dict):
        sbb = doc["sticky_booking_bar"]
        if isinstance(sbb.get("price"), dict):
            sbb["price"] = dict(PRICE_OBJ)

    p.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  [ok] {p.name}")


def main():
    for loc in ["en", "ko", "ja", "zh", "zh-TW", "es"]:
        process(loc)


if __name__ == "__main__":
    main()
