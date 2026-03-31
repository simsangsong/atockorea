import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Locale } from "@/lib/locale";
import { locales } from "@/lib/locale";

const ROOT = process.cwd();

const MESSAGE_FILE: Record<Locale, string> = {
  en: "messages/en.json",
  ko: "messages/ko.json",
  zh: "messages/zh.json",
  "zh-TW": "messages/zh-TW.json",
  es: "messages/es.json",
  ja: "messages/ja.json",
};

const SITECOPY_FILE: Record<Locale, string> = {
  en: "messages/siteCopy/en.json",
  ko: "messages/siteCopy/ko.json",
  zh: "messages/siteCopy/zh.json",
  "zh-TW": "messages/siteCopy/zh-TW.json",
  es: "messages/siteCopy/es.json",
  ja: "messages/siteCopy/ja.json",
};

async function readJsonFile(rel: string): Promise<unknown> {
  const full = path.join(ROOT, rel);
  const raw = await fs.readFile(full, "utf-8");
  return JSON.parse(raw);
}

export async function loadBaselineMessages(): Promise<Record<Locale, unknown>> {
  const out = {} as Record<Locale, unknown>;
  for (const loc of locales) {
    out[loc] = await readJsonFile(MESSAGE_FILE[loc]);
  }
  return out;
}

export async function loadBaselineSiteCopy(): Promise<Record<Locale, unknown>> {
  const out = {} as Record<Locale, unknown>;
  for (const loc of locales) {
    out[loc] = await readJsonFile(SITECOPY_FILE[loc]);
  }
  return out;
}
