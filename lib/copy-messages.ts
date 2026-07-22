import type { Locale } from '@/lib/locale';
import type { Copy } from '@/src/design/copy';
import copyEn from '@/messages/copy/en.json';
import copyKo from '@/messages/copy/ko.json';
import copyZh from '@/messages/copy/zh.json';
import copyZhTw from '@/messages/copy/zh-TW.json';
import copyEs from '@/messages/copy/es.json';
import copyJa from '@/messages/copy/ja.json';
import copyFr from '@/messages/copy/fr.json';
import copyDe from '@/messages/copy/de.json';
import copyIt from '@/messages/copy/it.json';
import copyRu from '@/messages/copy/ru.json';

const copyByLocale: Record<Locale, Copy> = {
  en: copyEn,
  ko: copyKo,
  zh: copyZh,
  'zh-TW': copyZhTw,
  es: copyEs,
  ja: copyJa,
  fr: copyFr,
  de: copyDe,
  it: copyIt,
  ru: copyRu,
};

export function getCopy(locale: Locale): Copy {
  return copyByLocale[locale] ?? copyEn;
}
