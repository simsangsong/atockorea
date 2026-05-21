/**
 * One-shot: add the cruise shore-excursion + Gangjeong-port pricing keys to
 * messages/<locale>.json (Phase 9 follow-up). Transcreated, native tone.
 * Idempotent.
 */
import { readFileSync, writeFileSync } from "node:fs";

const LOCALES = ["en", "ko", "ja", "zh", "zh-TW", "es"];

const data = {
  en: {
    cruisePortLabel: "Cruise port",
    lines: { cruiseExcursion: "Cruise shore-excursion", gangjeongPort: "Gangjeong Port" },
    cruisePorts: {
      gangjeong: "Gangjeong Port (Seogwipo) +₩70,000",
      jeju_port: "Jeju Port (city, north)",
    },
  },
  ko: {
    cruisePortLabel: "크루즈 항구",
    lines: { cruiseExcursion: "크루즈 기항지 투어", gangjeongPort: "강정항" },
    cruisePorts: {
      gangjeong: "강정항 (서귀포) +₩70,000",
      jeju_port: "제주항 (제주시)",
    },
  },
  ja: {
    cruisePortLabel: "クルーズ寄港地",
    lines: { cruiseExcursion: "クルーズ寄港地ツアー", gangjeongPort: "江汀港（カンジョン）" },
    cruisePorts: {
      gangjeong: "江汀港（西帰浦）+₩70,000",
      jeju_port: "済州港（済州市）",
    },
  },
  zh: {
    cruisePortLabel: "邮轮港口",
    lines: { cruiseExcursion: "邮轮岸上观光", gangjeongPort: "江汀港" },
    cruisePorts: {
      gangjeong: "江汀港（西归浦）+₩70,000",
      jeju_port: "济州港（市区）",
    },
  },
  "zh-TW": {
    cruisePortLabel: "郵輪港口",
    lines: { cruiseExcursion: "郵輪岸上觀光", gangjeongPort: "江汀港" },
    cruisePorts: {
      gangjeong: "江汀港（西歸浦）+₩70,000",
      jeju_port: "濟州港（市區）",
    },
  },
  es: {
    cruisePortLabel: "Puerto del crucero",
    lines: { cruiseExcursion: "Excursión de crucero", gangjeongPort: "Puerto de Gangjeong" },
    cruisePorts: {
      gangjeong: "Puerto de Gangjeong (Seogwipo) +₩70,000",
      jeju_port: "Puerto de Jeju (ciudad)",
    },
  },
};

for (const loc of LOCALES) {
  const file = new URL(`../messages/${loc}.json`, import.meta.url);
  const json = JSON.parse(readFileSync(file, "utf8"));
  const q = (json.itineraryBuilder ??= {}).quote ?? (json.itineraryBuilder.quote = {});
  const d = data[loc];
  q.cruisePortLabel = d.cruisePortLabel;
  q.pricing ??= {};
  q.pricing.lines = { ...(q.pricing.lines ?? {}), ...d.lines };
  q.pricing.cruisePorts = { ...(q.pricing.cruisePorts ?? {}), ...d.cruisePorts };
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`✓ ${loc}.json`);
}
console.log("done");
