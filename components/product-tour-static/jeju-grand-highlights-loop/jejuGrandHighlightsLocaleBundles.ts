import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";

import en from "./jeju-grand-highlights-loop.en.json";
import es from "./jeju-grand-highlights-loop.es.json";
import ja from "./jeju-grand-highlights-loop.ja.json";
import ko from "./jeju-grand-highlights-loop.ko.json";
import zh from "./jeju-grand-highlights-loop.zh.json";
import zhTW from "./jeju-grand-highlights-loop.zh-TW.json";

/** `tour_product_full_page_v1` — locale 파일과 동일 shape */
export function getJejuGrandHighlightsLoopFullPageJson(locale: TourProductPageLocale): typeof en {
  switch (locale) {
    case "ko":
      return ko as typeof en;
    case "ja":
      return ja as typeof en;
    case "zh":
      return zh as typeof en;
    case "zh-TW":
      return zhTW as typeof en;
    case "es":
      return es as typeof en;
    default:
      return en;
  }
}
