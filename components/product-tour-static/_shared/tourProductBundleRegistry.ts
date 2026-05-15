/**
 * Slug → per-locale `tour_product_full_page_v1` JSON bundle registry.
 *
 * The catch-all `app/tour-product/[slug]/page.tsx` reads from here to resolve
 * the static JSON fallback when Supabase is unavailable or `detail_payload` is
 * incomplete. v17 batch shipped EN-only; v3 master pack (2026-05-01) restores
 * ko/ja/zh/zh-TW/es overlays for all 30 tours.
 */

import type { TourProductPageLocale } from "@/lib/tour-product/resolveTourProductDbLocale";
import type { StaticTourProductBundleSlug } from "./tourProductBundleSlugs";
import type { TourProductFullPageJson } from "./tourProductFullPageJsonTypes";
import { overrideImageFieldsFromEn } from "./imageFieldFallback";

import busanGyeongjuUnescoLegacyEn from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json";
import busanGyeongjuUnescoLegacyKo from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.ko.json";
import busanGyeongjuUnescoLegacyZh from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.zh.json";
import busanGyeongjuUnescoLegacyZhTw from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.zh-TW.json";
import busanGyeongjuUnescoLegacyEs from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.es.json";
import busanGyeongjuUnescoLegacyJa from "@/components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.ja.json";
import busanPlumCherryBlossomEn from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json";
import busanPlumCherryBlossomKo from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.ko.json";
import busanPlumCherryBlossomZh from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.zh.json";
import busanPlumCherryBlossomZhTw from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.zh-TW.json";
import busanPlumCherryBlossomEs from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.es.json";
import busanPlumCherryBlossomJa from "@/components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.ja.json";
import busanCruiseShoreExcursionBusTourEn from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.en.json";
import busanOutskirtsTongdosaEn from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.en.json";
import busanOutskirtsTongdosaKo from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.ko.json";
import busanOutskirtsTongdosaZh from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.zh.json";
import busanOutskirtsTongdosaZhTw from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.zh-TW.json";
import busanOutskirtsTongdosaEs from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.es.json";
import busanOutskirtsTongdosaJa from "@/components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.ja.json";
import busanCruiseShoreExcursionBusTourKo from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.ko.json";
import busanCruiseShoreExcursionBusTourZh from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.zh.json";
import busanCruiseShoreExcursionBusTourZhTw from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.zh-TW.json";
import busanCruiseShoreExcursionBusTourEs from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.es.json";
import busanCruiseShoreExcursionBusTourJa from "@/components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.ja.json";
import busanPrivateCarCharterCruiseShoreEn from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json";
import busanPrivateCarCharterCruiseShoreKo from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.ko.json";
import busanPrivateCarCharterCruiseShoreZh from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.zh.json";
import busanPrivateCarCharterCruiseShoreZhTw from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.zh-TW.json";
import busanPrivateCarCharterCruiseShoreEs from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.es.json";
import busanPrivateCarCharterCruiseShoreJa from "@/components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.ja.json";
import busanSmallGroupSightseeingCruiseEn from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json";
import busanSmallGroupSightseeingCruiseKo from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.ko.json";
import busanSmallGroupSightseeingCruiseZh from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.zh.json";
import busanSmallGroupSightseeingCruiseZhTw from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.zh-TW.json";
import busanSmallGroupSightseeingCruiseEs from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.es.json";
import busanSmallGroupSightseeingCruiseJa from "@/components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.ja.json";
import busanSpringCherryBlossomGyeongjuEn from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json";
import busanSpringCherryBlossomGyeongjuKo from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.ko.json";
import busanSpringCherryBlossomGyeongjuZh from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.zh.json";
import busanSpringCherryBlossomGyeongjuZhTw from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.zh-TW.json";
import busanSpringCherryBlossomGyeongjuEs from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.es.json";
import busanSpringCherryBlossomGyeongjuJa from "@/components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.ja.json";
import busanTopAttractionsDayEn from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.en.json";
import busanTopAttractionsDayKo from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.ko.json";
import busanTopAttractionsDayZh from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.zh.json";
import busanTopAttractionsDayZhTw from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.zh-TW.json";
import busanTopAttractionsDayEs from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.es.json";
import busanTopAttractionsDayJa from "@/components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.ja.json";
import eastSignatureEn from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json";
import eastSignatureKo from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.ko.json";
import eastSignatureZh from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.zh.json";
import eastSignatureZhTw from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.zh-TW.json";
import eastSignatureEs from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.es.json";
import eastSignatureJa from "@/components/product-tour-static/east-signature-nature-core/east-signature-nature-core.ja.json";
import fromBusanGyeongjuAncientCapitalEn from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.en.json";
import fromBusanGyeongjuAncientCapitalKo from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.ko.json";
import fromBusanGyeongjuAncientCapitalZh from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.zh.json";
import fromBusanGyeongjuAncientCapitalZhTw from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.zh-TW.json";
import fromBusanGyeongjuAncientCapitalEs from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.es.json";
import fromBusanGyeongjuAncientCapitalJa from "@/components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.ja.json";
import fromIncheonSeoulDayCruiseEn from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json";
import fromIncheonSeoulDayCruiseKo from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.ko.json";
import fromIncheonSeoulDayCruiseZh from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.zh.json";
import fromIncheonSeoulDayCruiseZhTw from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.zh-TW.json";
import fromIncheonSeoulDayCruiseEs from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.es.json";
import fromIncheonSeoulDayCruiseJa from "@/components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.ja.json";
import incheonSeoulPrivateCarShoreCruiseEn from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json";
import incheonSeoulPrivateCarShoreCruiseKo from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.ko.json";
import incheonSeoulPrivateCarShoreCruiseZh from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.zh.json";
import incheonSeoulPrivateCarShoreCruiseZhTw from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.zh-TW.json";
import incheonSeoulPrivateCarShoreCruiseEs from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.es.json";
import incheonSeoulPrivateCarShoreCruiseJa from "@/components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.ja.json";
import jejuCherryBlossomEastEn from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json";
import jejuCherryBlossomEastKo from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.ko.json";
import jejuCherryBlossomEastZh from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.zh.json";
import jejuCherryBlossomEastZhTw from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.zh-TW.json";
import jejuCherryBlossomEastEs from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.es.json";
import jejuCherryBlossomEastJa from "@/components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.ja.json";
import jejuCruiseShoreBusEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json";
import jejuCruiseShoreBusKo from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ko.json";
import jejuCruiseShoreBusZh from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh.json";
import jejuCruiseShoreBusZhTw from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh-TW.json";
import jejuCruiseShoreBusEs from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.es.json";
import jejuCruiseShoreBusJa from "@/components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ja.json";
import jejuCruiseShoreSmallGroupEn from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json";
import jejuCruiseShoreSmallGroupKo from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ko.json";
import jejuCruiseShoreSmallGroupZh from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh.json";
import jejuCruiseShoreSmallGroupZhTw from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh-TW.json";
import jejuCruiseShoreSmallGroupEs from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.es.json";
import jejuCruiseShoreSmallGroupJa from "@/components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ja.json";
import jejuEasternUnescoSpotsEn from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json";
import jejuEasternUnescoSpotsKo from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.ko.json";
import jejuEasternUnescoSpotsZh from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.zh.json";
import jejuEasternUnescoSpotsZhTw from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.zh-TW.json";
import jejuEasternUnescoSpotsEs from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.es.json";
import jejuEasternUnescoSpotsJa from "@/components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.ja.json";
import jejuGrandHighlightsLoopEn from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import jejuGrandHighlightsLoopKo from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.ko.json";
import jejuGrandHighlightsLoopZh from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh.json";
import jejuGrandHighlightsLoopZhTw from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh-TW.json";
import jejuGrandHighlightsLoopEs from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.es.json";
import jejuGrandHighlightsLoopJa from "@/components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.ja.json";
import jejuHydrangeaFestivalEastEn from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json";
import jejuHydrangeaFestivalEastKo from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.ko.json";
import jejuHydrangeaFestivalEastZh from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.zh.json";
import jejuHydrangeaFestivalEastZhTw from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.zh-TW.json";
import jejuHydrangeaFestivalEastEs from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.es.json";
import jejuHydrangeaFestivalEastJa from "@/components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.ja.json";
import jejuHydrangeaFestivalSouthwestEn from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json";
import jejuHydrangeaFestivalSouthwestKo from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.ko.json";
import jejuHydrangeaFestivalSouthwestZh from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.zh.json";
import jejuHydrangeaFestivalSouthwestZhTw from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.zh-TW.json";
import jejuHydrangeaFestivalSouthwestEs from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.es.json";
import jejuHydrangeaFestivalSouthwestJa from "@/components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.ja.json";
import jejuIslandPrivateCarCharterEn from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json";
import jejuIslandPrivateCarCharterKo from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.ko.json";
import jejuIslandPrivateCarCharterZh from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.zh.json";
import jejuIslandPrivateCarCharterZhTw from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.zh-TW.json";
import jejuIslandPrivateCarCharterEs from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.es.json";
import jejuIslandPrivateCarCharterJa from "@/components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.ja.json";
import jejuSouthernTopUnescoSpotsEn from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json";
import jejuSouthernTopUnescoSpotsKo from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.ko.json";
import jejuSouthernTopUnescoSpotsZh from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.zh.json";
import jejuSouthernTopUnescoSpotsZhTw from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.zh-TW.json";
import jejuSouthernTopUnescoSpotsEs from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.es.json";
import jejuSouthernTopUnescoSpotsJa from "@/components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.ja.json";
import jejuWestSouthFullDayAuthenticEn from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json";
import jejuWestSouthFullDayAuthenticKo from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.ko.json";
import jejuWestSouthFullDayAuthenticZh from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.zh.json";
import jejuWestSouthFullDayAuthenticZhTw from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.zh-TW.json";
import jejuWestSouthFullDayAuthenticEs from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.es.json";
import jejuWestSouthFullDayAuthenticJa from "@/components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.ja.json";
import jejuWinterSouthwestTangerineEn from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.en.json";
import jejuWinterSouthwestTangerineKo from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.ko.json";
import jejuWinterSouthwestTangerineZh from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.zh.json";
import jejuWinterSouthwestTangerineZhTw from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.zh-TW.json";
import jejuWinterSouthwestTangerineEs from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.es.json";
import jejuWinterSouthwestTangerineJa from "@/components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.ja.json";
import pocheonSanjeongLakeHerbIslandEn from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json";
import pocheonSanjeongLakeHerbIslandKo from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.ko.json";
import pocheonSanjeongLakeHerbIslandZh from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.zh.json";
import pocheonSanjeongLakeHerbIslandZhTw from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.zh-TW.json";
import pocheonSanjeongLakeHerbIslandEs from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.es.json";
import pocheonSanjeongLakeHerbIslandJa from "@/components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.ja.json";
import seoulDmzPrivate3rdTunnelEn from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json";
import seoulDmzPrivate3rdTunnelKo from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.ko.json";
import seoulDmzPrivate3rdTunnelZh from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.zh.json";
import seoulDmzPrivate3rdTunnelZhTw from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.zh-TW.json";
import seoulDmzPrivate3rdTunnelEs from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.es.json";
import seoulDmzPrivate3rdTunnelJa from "@/components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.ja.json";
import seoulPrivateNamiMorningCalmEn from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json";
import seoulPrivateNamiMorningCalmKo from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.ko.json";
import seoulPrivateNamiMorningCalmZh from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.zh.json";
import seoulPrivateNamiMorningCalmZhTw from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.zh-TW.json";
import seoulPrivateNamiMorningCalmEs from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.es.json";
import seoulPrivateNamiMorningCalmJa from "@/components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.ja.json";
import seoulSeoraksanNaksansaBeachEn from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.en.json";
import seoulSeoraksanNaksansaBeachKo from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.ko.json";
import seoulSeoraksanNaksansaBeachZh from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.zh.json";
import seoulSeoraksanNaksansaBeachZhTw from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.zh-TW.json";
import seoulSeoraksanNaksansaBeachEs from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.es.json";
import seoulSeoraksanNaksansaBeachJa from "@/components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.ja.json";
import seoulSeoraksanNamiMorningCalmEn from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.en.json";
import seoulSeoraksanNamiMorningCalmKo from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.ko.json";
import seoulSeoraksanNamiMorningCalmZh from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.zh.json";
import seoulSeoraksanNamiMorningCalmZhTw from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.zh-TW.json";
import seoulSeoraksanNamiMorningCalmEs from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.es.json";
import seoulSeoraksanNamiMorningCalmJa from "@/components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.ja.json";
import seoulSeoraksanSokchoBeachEn from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json";
import seoulSeoraksanSokchoBeachKo from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.ko.json";
import seoulSeoraksanSokchoBeachZh from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.zh.json";
import seoulSeoraksanSokchoBeachZhTw from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.zh-TW.json";
import seoulSeoraksanSokchoBeachEs from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.es.json";
import seoulSeoraksanSokchoBeachJa from "@/components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.ja.json";
import seoulSuburbsPrivateCharteredCarEn from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json";
import seoulSuburbsPrivateCharteredCarKo from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.ko.json";
import seoulSuburbsPrivateCharteredCarZh from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.zh.json";
import seoulSuburbsPrivateCharteredCarZhTw from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.zh-TW.json";
import seoulSuburbsPrivateCharteredCarEs from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.es.json";
import seoulSuburbsPrivateCharteredCarJa from "@/components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.ja.json";
import seoulSuwonHwaseongFolkVillageEn from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.en.json";
import seoulSuwonHwaseongFolkVillageKo from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.ko.json";
import seoulSuwonHwaseongFolkVillageZh from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.zh.json";
import seoulSuwonHwaseongFolkVillageZhTw from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.zh-TW.json";
import seoulSuwonHwaseongFolkVillageEs from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.es.json";
import seoulSuwonHwaseongFolkVillageJa from "@/components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.ja.json";
import seoulSuwonHwaseongGwangmyeongCaveEn from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json";
import seoulSuwonHwaseongGwangmyeongCaveKo from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.ko.json";
import seoulSuwonHwaseongGwangmyeongCaveZh from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.zh.json";
import seoulSuwonHwaseongGwangmyeongCaveZhTw from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.zh-TW.json";
import seoulSuwonHwaseongGwangmyeongCaveEs from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.es.json";
import seoulSuwonHwaseongGwangmyeongCaveJa from "@/components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.ja.json";
import seoulSuwonHwaseongWaujeongsaEn from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json";
import seoulSuwonHwaseongWaujeongsaKo from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.ko.json";
import seoulSuwonHwaseongWaujeongsaZh from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.zh.json";
import seoulSuwonHwaseongWaujeongsaZhTw from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.zh-TW.json";
import seoulSuwonHwaseongWaujeongsaEs from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.es.json";
import seoulSuwonHwaseongWaujeongsaJa from "@/components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.ja.json";
import southwestHallasanOsullocAewolEn from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";
import southwestHallasanOsullocAewolKo from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.ko.json";
import southwestHallasanOsullocAewolZh from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.zh.json";
import southwestHallasanOsullocAewolZhTw from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.zh-TW.json";
import southwestHallasanOsullocAewolEs from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.es.json";
import southwestHallasanOsullocAewolJa from "@/components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.ja.json";

export type TourProductLocaleBundle = Partial<Record<TourProductPageLocale, TourProductFullPageJson>> & {
  en: TourProductFullPageJson;
};

/**
 * JSON imports come through as deeply-narrowed tuple literals; the authoring-side
 * contract only cares about the structural shape, so we bridge through `unknown`.
 */
function asBundleEntry(v: unknown): TourProductFullPageJson {
  return v as TourProductFullPageJson;
}

/**
 * Shallow merge with `en` as base so locale files can override e.g. `bookingSupportSteps` only.
 *
 * After merging, every image-URL field is forced back to the EN value at the same
 * path. Locale JSONs were generated by tooling that dropped Unsplash/CDN
 * placeholders into the photo slots, so without this step every language switch
 * would also swap every photo on the page. See `imageFieldFallback.ts`.
 */
function mergeFullPageWithLocaleBase(
  en: TourProductFullPageJson,
  loc: TourProductFullPageJson,
): TourProductFullPageJson {
  const merged: TourProductFullPageJson = { ...en, ...loc };
  if (loc.sectionUi && typeof loc.sectionUi === "object" && en.sectionUi && typeof en.sectionUi === "object") {
    merged.sectionUi = {
      ...(en.sectionUi as Record<string, string>),
      ...(loc.sectionUi as Record<string, string>),
    } as TourProductFullPageJson["sectionUi"];
  } else if (loc.sectionUi) {
    merged.sectionUi = loc.sectionUi as TourProductFullPageJson["sectionUi"];
  }
  return overrideImageFieldsFromEn(merged, en);
}

/**
 * 30 tours × 6 locales (en/ko/zh/zh-TW/es/ja). EN remains the canonical base;
 * non-EN entries are shallow-merged on top via `mergeFullPageWithLocaleBase`.
 */
export const STATIC_TOUR_PRODUCT_BUNDLES: Record<StaticTourProductBundleSlug, TourProductLocaleBundle> = {
  "busan-gyeongju-unesco-legacy-tour-national-museum": {
    en: asBundleEntry(busanGyeongjuUnescoLegacyEn),
    ko: asBundleEntry(busanGyeongjuUnescoLegacyKo),
    zh: asBundleEntry(busanGyeongjuUnescoLegacyZh),
    "zh-TW": asBundleEntry(busanGyeongjuUnescoLegacyZhTw),
    es: asBundleEntry(busanGyeongjuUnescoLegacyEs),
    ja: asBundleEntry(busanGyeongjuUnescoLegacyJa),
  },
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": {
    en: asBundleEntry(busanPlumCherryBlossomEn),
    ko: asBundleEntry(busanPlumCherryBlossomKo),
    zh: asBundleEntry(busanPlumCherryBlossomZh),
    "zh-TW": asBundleEntry(busanPlumCherryBlossomZhTw),
    es: asBundleEntry(busanPlumCherryBlossomEs),
    ja: asBundleEntry(busanPlumCherryBlossomJa),
  },
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": {
    en: asBundleEntry(busanOutskirtsTongdosaEn),
    ko: asBundleEntry(busanOutskirtsTongdosaKo),
    zh: asBundleEntry(busanOutskirtsTongdosaZh),
    "zh-TW": asBundleEntry(busanOutskirtsTongdosaZhTw),
    es: asBundleEntry(busanOutskirtsTongdosaEs),
    ja: asBundleEntry(busanOutskirtsTongdosaJa),
  },
  "busan-cruise-shore-excursion-bus-tour": {
    en: asBundleEntry(busanCruiseShoreExcursionBusTourEn),
    ko: asBundleEntry(busanCruiseShoreExcursionBusTourKo),
    zh: asBundleEntry(busanCruiseShoreExcursionBusTourZh),
    "zh-TW": asBundleEntry(busanCruiseShoreExcursionBusTourZhTw),
    es: asBundleEntry(busanCruiseShoreExcursionBusTourEs),
    ja: asBundleEntry(busanCruiseShoreExcursionBusTourJa),
  },
  "busan-private-car-charter-cruise-shore": {
    en: asBundleEntry(busanPrivateCarCharterCruiseShoreEn),
    ko: asBundleEntry(busanPrivateCarCharterCruiseShoreKo),
    zh: asBundleEntry(busanPrivateCarCharterCruiseShoreZh),
    "zh-TW": asBundleEntry(busanPrivateCarCharterCruiseShoreZhTw),
    es: asBundleEntry(busanPrivateCarCharterCruiseShoreEs),
    ja: asBundleEntry(busanPrivateCarCharterCruiseShoreJa),
  },
  "busan-small-group-sightseeing-tour-cruise-passengers": {
    en: asBundleEntry(busanSmallGroupSightseeingCruiseEn),
    ko: asBundleEntry(busanSmallGroupSightseeingCruiseKo),
    zh: asBundleEntry(busanSmallGroupSightseeingCruiseZh),
    "zh-TW": asBundleEntry(busanSmallGroupSightseeingCruiseZhTw),
    es: asBundleEntry(busanSmallGroupSightseeingCruiseEs),
    ja: asBundleEntry(busanSmallGroupSightseeingCruiseJa),
  },
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": {
    en: asBundleEntry(busanSpringCherryBlossomGyeongjuEn),
    ko: asBundleEntry(busanSpringCherryBlossomGyeongjuKo),
    zh: asBundleEntry(busanSpringCherryBlossomGyeongjuZh),
    "zh-TW": asBundleEntry(busanSpringCherryBlossomGyeongjuZhTw),
    es: asBundleEntry(busanSpringCherryBlossomGyeongjuEs),
    ja: asBundleEntry(busanSpringCherryBlossomGyeongjuJa),
  },
  "busan-top-attractions-day-tour": {
    en: asBundleEntry(busanTopAttractionsDayEn),
    ko: asBundleEntry(busanTopAttractionsDayKo),
    zh: asBundleEntry(busanTopAttractionsDayZh),
    "zh-TW": asBundleEntry(busanTopAttractionsDayZhTw),
    es: asBundleEntry(busanTopAttractionsDayEs),
    ja: asBundleEntry(busanTopAttractionsDayJa),
  },
  "east-signature-nature-core": {
    en: asBundleEntry(eastSignatureEn),
    ko: asBundleEntry(eastSignatureKo),
    zh: asBundleEntry(eastSignatureZh),
    "zh-TW": asBundleEntry(eastSignatureZhTw),
    es: asBundleEntry(eastSignatureEs),
    ja: asBundleEntry(eastSignatureJa),
  },
  "from-busan-gyeongju-ancient-capital-day-tour": {
    en: asBundleEntry(fromBusanGyeongjuAncientCapitalEn),
    ko: asBundleEntry(fromBusanGyeongjuAncientCapitalKo),
    zh: asBundleEntry(fromBusanGyeongjuAncientCapitalZh),
    "zh-TW": asBundleEntry(fromBusanGyeongjuAncientCapitalZhTw),
    es: asBundleEntry(fromBusanGyeongjuAncientCapitalEs),
    ja: asBundleEntry(fromBusanGyeongjuAncientCapitalJa),
  },
  "from-incheon-seoul-day-tour-cruise-guests": {
    en: asBundleEntry(fromIncheonSeoulDayCruiseEn),
    ko: asBundleEntry(fromIncheonSeoulDayCruiseKo),
    zh: asBundleEntry(fromIncheonSeoulDayCruiseZh),
    "zh-TW": asBundleEntry(fromIncheonSeoulDayCruiseZhTw),
    es: asBundleEntry(fromIncheonSeoulDayCruiseEs),
    ja: asBundleEntry(fromIncheonSeoulDayCruiseJa),
  },
  "incheon-seoul-private-car-shore-excursion-cruise": {
    en: asBundleEntry(incheonSeoulPrivateCarShoreCruiseEn),
    ko: asBundleEntry(incheonSeoulPrivateCarShoreCruiseKo),
    zh: asBundleEntry(incheonSeoulPrivateCarShoreCruiseZh),
    "zh-TW": asBundleEntry(incheonSeoulPrivateCarShoreCruiseZhTw),
    es: asBundleEntry(incheonSeoulPrivateCarShoreCruiseEs),
    ja: asBundleEntry(incheonSeoulPrivateCarShoreCruiseJa),
  },
  "jeju-cherry-blossom-tour-east-route": {
    en: asBundleEntry(jejuCherryBlossomEastEn),
    ko: asBundleEntry(jejuCherryBlossomEastKo),
    zh: asBundleEntry(jejuCherryBlossomEastZh),
    "zh-TW": asBundleEntry(jejuCherryBlossomEastZhTw),
    es: asBundleEntry(jejuCherryBlossomEastEs),
    ja: asBundleEntry(jejuCherryBlossomEastJa),
  },
  "jeju-cruise-shore-excursion-bus-tour": {
    en: asBundleEntry(jejuCruiseShoreBusEn),
    ko: asBundleEntry(jejuCruiseShoreBusKo),
    zh: asBundleEntry(jejuCruiseShoreBusZh),
    "zh-TW": asBundleEntry(jejuCruiseShoreBusZhTw),
    es: asBundleEntry(jejuCruiseShoreBusEs),
    ja: asBundleEntry(jejuCruiseShoreBusJa),
  },
  "jeju-cruise-shore-excursion-small-group-tour": {
    en: asBundleEntry(jejuCruiseShoreSmallGroupEn),
    ko: asBundleEntry(jejuCruiseShoreSmallGroupKo),
    zh: asBundleEntry(jejuCruiseShoreSmallGroupZh),
    "zh-TW": asBundleEntry(jejuCruiseShoreSmallGroupZhTw),
    es: asBundleEntry(jejuCruiseShoreSmallGroupEs),
    ja: asBundleEntry(jejuCruiseShoreSmallGroupJa),
  },
  "jeju-eastern-unesco-spots-day-tour": {
    en: asBundleEntry(jejuEasternUnescoSpotsEn),
    ko: asBundleEntry(jejuEasternUnescoSpotsKo),
    zh: asBundleEntry(jejuEasternUnescoSpotsZh),
    "zh-TW": asBundleEntry(jejuEasternUnescoSpotsZhTw),
    es: asBundleEntry(jejuEasternUnescoSpotsEs),
    ja: asBundleEntry(jejuEasternUnescoSpotsJa),
  },
  "jeju-grand-highlights-loop": {
    en: asBundleEntry(jejuGrandHighlightsLoopEn),
    ko: asBundleEntry(jejuGrandHighlightsLoopKo),
    zh: asBundleEntry(jejuGrandHighlightsLoopZh),
    "zh-TW": asBundleEntry(jejuGrandHighlightsLoopZhTw),
    es: asBundleEntry(jejuGrandHighlightsLoopEs),
    ja: asBundleEntry(jejuGrandHighlightsLoopJa),
  },
  "jeju-hydrangea-festival-tour-east-route": {
    en: asBundleEntry(jejuHydrangeaFestivalEastEn),
    ko: asBundleEntry(jejuHydrangeaFestivalEastKo),
    zh: asBundleEntry(jejuHydrangeaFestivalEastZh),
    "zh-TW": asBundleEntry(jejuHydrangeaFestivalEastZhTw),
    es: asBundleEntry(jejuHydrangeaFestivalEastEs),
    ja: asBundleEntry(jejuHydrangeaFestivalEastJa),
  },
  "jeju-hydrangea-festival-tour-southwest-route": {
    en: asBundleEntry(jejuHydrangeaFestivalSouthwestEn),
    ko: asBundleEntry(jejuHydrangeaFestivalSouthwestKo),
    zh: asBundleEntry(jejuHydrangeaFestivalSouthwestZh),
    "zh-TW": asBundleEntry(jejuHydrangeaFestivalSouthwestZhTw),
    es: asBundleEntry(jejuHydrangeaFestivalSouthwestEs),
    ja: asBundleEntry(jejuHydrangeaFestivalSouthwestJa),
  },
  "jeju-island-private-car-charter-tour": {
    en: asBundleEntry(jejuIslandPrivateCarCharterEn),
    ko: asBundleEntry(jejuIslandPrivateCarCharterKo),
    zh: asBundleEntry(jejuIslandPrivateCarCharterZh),
    "zh-TW": asBundleEntry(jejuIslandPrivateCarCharterZhTw),
    es: asBundleEntry(jejuIslandPrivateCarCharterEs),
    ja: asBundleEntry(jejuIslandPrivateCarCharterJa),
  },
  "jeju-southern-top-unesco-spots-tour": {
    en: asBundleEntry(jejuSouthernTopUnescoSpotsEn),
    ko: asBundleEntry(jejuSouthernTopUnescoSpotsKo),
    zh: asBundleEntry(jejuSouthernTopUnescoSpotsZh),
    "zh-TW": asBundleEntry(jejuSouthernTopUnescoSpotsZhTw),
    es: asBundleEntry(jejuSouthernTopUnescoSpotsEs),
    ja: asBundleEntry(jejuSouthernTopUnescoSpotsJa),
  },
  "jeju-west-south-full-day-authentic-tour": {
    en: asBundleEntry(jejuWestSouthFullDayAuthenticEn),
    ko: asBundleEntry(jejuWestSouthFullDayAuthenticKo),
    zh: asBundleEntry(jejuWestSouthFullDayAuthenticZh),
    "zh-TW": asBundleEntry(jejuWestSouthFullDayAuthenticZhTw),
    es: asBundleEntry(jejuWestSouthFullDayAuthenticEs),
    ja: asBundleEntry(jejuWestSouthFullDayAuthenticJa),
  },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": {
    en: asBundleEntry(jejuWinterSouthwestTangerineEn),
    ko: asBundleEntry(jejuWinterSouthwestTangerineKo),
    zh: asBundleEntry(jejuWinterSouthwestTangerineZh),
    "zh-TW": asBundleEntry(jejuWinterSouthwestTangerineZhTw),
    es: asBundleEntry(jejuWinterSouthwestTangerineEs),
    ja: asBundleEntry(jejuWinterSouthwestTangerineJa),
  },
  "pocheon-sanjeong-lake-herb-island-art-valley": {
    en: asBundleEntry(pocheonSanjeongLakeHerbIslandEn),
    ko: asBundleEntry(pocheonSanjeongLakeHerbIslandKo),
    zh: asBundleEntry(pocheonSanjeongLakeHerbIslandZh),
    "zh-TW": asBundleEntry(pocheonSanjeongLakeHerbIslandZhTw),
    es: asBundleEntry(pocheonSanjeongLakeHerbIslandEs),
    ja: asBundleEntry(pocheonSanjeongLakeHerbIslandJa),
  },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": {
    en: asBundleEntry(seoulDmzPrivate3rdTunnelEn),
    ko: asBundleEntry(seoulDmzPrivate3rdTunnelKo),
    zh: asBundleEntry(seoulDmzPrivate3rdTunnelZh),
    "zh-TW": asBundleEntry(seoulDmzPrivate3rdTunnelZhTw),
    es: asBundleEntry(seoulDmzPrivate3rdTunnelEs),
    ja: asBundleEntry(seoulDmzPrivate3rdTunnelJa),
  },
  "seoul-private-nami-morning-calm-petite-france": {
    en: asBundleEntry(seoulPrivateNamiMorningCalmEn),
    ko: asBundleEntry(seoulPrivateNamiMorningCalmKo),
    zh: asBundleEntry(seoulPrivateNamiMorningCalmZh),
    "zh-TW": asBundleEntry(seoulPrivateNamiMorningCalmZhTw),
    es: asBundleEntry(seoulPrivateNamiMorningCalmEs),
    ja: asBundleEntry(seoulPrivateNamiMorningCalmJa),
  },
  "seoul-seoraksan-naksansa-temple-naksan-beach-day-trip": {
    en: asBundleEntry(seoulSeoraksanNaksansaBeachEn),
    ko: asBundleEntry(seoulSeoraksanNaksansaBeachKo),
    zh: asBundleEntry(seoulSeoraksanNaksansaBeachZh),
    "zh-TW": asBundleEntry(seoulSeoraksanNaksansaBeachZhTw),
    es: asBundleEntry(seoulSeoraksanNaksansaBeachEs),
    ja: asBundleEntry(seoulSeoraksanNaksansaBeachJa),
  },
  "seoul-seoraksan-nami-island-morning-calm-day-tour": {
    en: asBundleEntry(seoulSeoraksanNamiMorningCalmEn),
    ko: asBundleEntry(seoulSeoraksanNamiMorningCalmKo),
    zh: asBundleEntry(seoulSeoraksanNamiMorningCalmZh),
    "zh-TW": asBundleEntry(seoulSeoraksanNamiMorningCalmZhTw),
    es: asBundleEntry(seoulSeoraksanNamiMorningCalmEs),
    ja: asBundleEntry(seoulSeoraksanNamiMorningCalmJa),
  },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": {
    en: asBundleEntry(seoulSeoraksanSokchoBeachEn),
    ko: asBundleEntry(seoulSeoraksanSokchoBeachKo),
    zh: asBundleEntry(seoulSeoraksanSokchoBeachZh),
    "zh-TW": asBundleEntry(seoulSeoraksanSokchoBeachZhTw),
    es: asBundleEntry(seoulSeoraksanSokchoBeachEs),
    ja: asBundleEntry(seoulSeoraksanSokchoBeachJa),
  },
  "seoul-suburbs-private-chartered-car-10hr": {
    en: asBundleEntry(seoulSuburbsPrivateCharteredCarEn),
    ko: asBundleEntry(seoulSuburbsPrivateCharteredCarKo),
    zh: asBundleEntry(seoulSuburbsPrivateCharteredCarZh),
    "zh-TW": asBundleEntry(seoulSuburbsPrivateCharteredCarZhTw),
    es: asBundleEntry(seoulSuburbsPrivateCharteredCarEs),
    ja: asBundleEntry(seoulSuburbsPrivateCharteredCarJa),
  },
  "seoul-suwon-hwaseong-folk-village-starfield-library": {
    en: asBundleEntry(seoulSuwonHwaseongFolkVillageEn),
    ko: asBundleEntry(seoulSuwonHwaseongFolkVillageKo),
    zh: asBundleEntry(seoulSuwonHwaseongFolkVillageZh),
    "zh-TW": asBundleEntry(seoulSuwonHwaseongFolkVillageZhTw),
    es: asBundleEntry(seoulSuwonHwaseongFolkVillageEs),
    ja: asBundleEntry(seoulSuwonHwaseongFolkVillageJa),
  },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": {
    en: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveEn),
    ko: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveKo),
    zh: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveZh),
    "zh-TW": asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveZhTw),
    es: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveEs),
    ja: asBundleEntry(seoulSuwonHwaseongGwangmyeongCaveJa),
  },
  "seoul-suwon-hwaseong-waujeongsa-starfield": {
    en: asBundleEntry(seoulSuwonHwaseongWaujeongsaEn),
    ko: asBundleEntry(seoulSuwonHwaseongWaujeongsaKo),
    zh: asBundleEntry(seoulSuwonHwaseongWaujeongsaZh),
    "zh-TW": asBundleEntry(seoulSuwonHwaseongWaujeongsaZhTw),
    es: asBundleEntry(seoulSuwonHwaseongWaujeongsaEs),
    ja: asBundleEntry(seoulSuwonHwaseongWaujeongsaJa),
  },
  "southwest-hallasan-osulloc-aewol": {
    en: asBundleEntry(southwestHallasanOsullocAewolEn),
    ko: asBundleEntry(southwestHallasanOsullocAewolKo),
    zh: asBundleEntry(southwestHallasanOsullocAewolZh),
    "zh-TW": asBundleEntry(southwestHallasanOsullocAewolZhTw),
    es: asBundleEntry(southwestHallasanOsullocAewolEs),
    ja: asBundleEntry(southwestHallasanOsullocAewolJa),
  },
};

/**
 * @returns The locale-specific bundle, falling back to `en` if missing.
 *          `null` when the slug is not registered.
 */
export function getStaticTourProductFullPageJson(
  slug: string,
  locale: TourProductPageLocale,
): TourProductFullPageJson | null {
  const bundle = (STATIC_TOUR_PRODUCT_BUNDLES as Record<string, TourProductLocaleBundle | undefined>)[slug];
  if (!bundle) return null;
  if (locale === "en" || !bundle[locale]) {
    return bundle.en;
  }
  return mergeFullPageWithLocaleBase(bundle.en, bundle[locale]);
}

export function isStaticTourProductBundleRegistered(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATIC_TOUR_PRODUCT_BUNDLES, slug);
}

export function listStaticTourProductBundleSlugs(): readonly string[] {
  return Object.keys(STATIC_TOUR_PRODUCT_BUNDLES);
}
