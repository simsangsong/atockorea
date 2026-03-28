import type { Locale } from '@/lib/locale';
import type { Copy } from '@/src/design/copy';
import copyEn from '@/messages/copy/en.json';
import copyKo from '@/messages/copy/ko.json';
import copyZh from '@/messages/copy/zh.json';
import copyZhTw from '@/messages/copy/zh-TW.json';
import copyEs from '@/messages/copy/es.json';
import copyJa from '@/messages/copy/ja.json';

const copyByLocale: Record<Locale, Copy> = {
  en: copyEn,
  ko: copyKo,
  zh: copyZh,
  'zh-TW': copyZhTw,
  es: copyEs,
  ja: copyJa,
};

export function getCopy(locale: Locale): Copy {
  return copyByLocale[locale] ?? copyEn;
}
