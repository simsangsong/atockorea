// Add a Tour Provider verification clause as terms.s3.p4 in all 6 locales.
// Strengthens the marketplace narrative — the user emphasized "엄격히 검증된 현지 테넌트 여행사".

import { readFileSync, writeFileSync } from "node:fs";

const TRANSLATIONS = {
  en:
    "Tour Providers listed on the Platform are independently licensed Korean travel agencies that we vet through a verification process covering business registration, insurance coverage, guide certifications, and ongoing operational quality reviews. We may suspend or remove a Tour Provider at any time if our standards are not maintained.",
  ko:
    "플랫폼에 등재된 투어 제공자는 모두 독립적으로 한국 여행업 면허를 보유한 현지 여행사이며, 사업자 등록, 보험 가입, 가이드 자격, 그리고 지속적인 운영 품질 점검을 포함하는 검증 절차를 거쳐 선정됩니다. 당사 기준이 유지되지 않을 경우, 언제든지 해당 투어 제공자를 정지하거나 제거할 수 있습니다.",
  zh:
    "本平台所列旅游提供方均为独立持有韩国旅游业经营许可的当地旅行社，并经过涵盖营业登记、保险投保、导游资质及持续运营质量审核的核验流程方可入驻。如未能持续达到我们的标准，我们可随时暂停或移除该旅游提供方。",
  "zh-TW":
    "本平台所列旅遊提供者均為獨立持有韓國旅遊業經營許可之當地旅行社，並經過涵蓋營業登記、保險投保、導遊資格及持續營運品質審查之核驗流程方可入駐。如未能持續達到本公司標準，本公司得隨時暫停或移除該旅遊提供者。",
  ja:
    "本プラットフォームに掲載されるツアー提供者は、韓国の旅行業ライセンスを独立して保有する現地の旅行会社であり、事業者登録、保険加入、ガイド資格、および継続的な運営品質レビューを含む審査プロセスを経て選定されています。当社の基準が維持されない場合、当社はいつでも当該ツアー提供者を停止または削除することができます。",
  es:
    "Los Proveedores de Tours listados en la Plataforma son agencias de viajes coreanas con licencia independiente que verificamos mediante un proceso que cubre el registro mercantil, la cobertura de seguros, las certificaciones de los guías y revisiones continuas de calidad operativa. Podemos suspender o retirar a un Proveedor de Tours en cualquier momento si nuestros estándares no se mantienen.",
};

const FILE_BY_LOCALE = {
  en: "messages/en.json",
  ko: "messages/ko.json",
  zh: "messages/zh.json",
  "zh-TW": "messages/zh-TW.json",
  ja: "messages/ja.json",
  es: "messages/es.json",
};

for (const [locale, file] of Object.entries(FILE_BY_LOCALE)) {
  const j = JSON.parse(readFileSync(file, "utf-8"));
  if (!j.terms?.s3) {
    console.error(`! ${file} has no terms.s3 — skipping`);
    continue;
  }
  j.terms.s3.p4 = TRANSLATIONS[locale];
  writeFileSync(file, JSON.stringify(j, null, 2) + "\n", "utf-8");
  console.log(`✓ ${locale}: terms.s3.p4 added`);
}
