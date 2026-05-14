/**
 * Static catalog registry — one card per registered tour-product slug.
 *
 * v3 master pack (2026-05-01): catalog_card text now reads from the active
 * locale (en/ko/zh/zh-TW/es/ja). Per-slug overrides — `listPriceUsd`,
 * `compareAtPriceUsd`, `maxGroupSize` — remain locale-invariant. The legacy
 * single-arg `getStaticTourProductBySlug(slug)` still works (defaults to en);
 * pass an explicit locale from any client/server caller that knows it.
 *
 * Detail page: `/tour-product/[slug]` (catch-all). Consumers: home v2 best-match
 * preview, /match page, sitemap, featured-join card.
 */

import type { TourProductPageLocale as Locale } from "@/lib/tour-product/resolveTourProductDbLocale";

import busanGyeongjuUnescoLegacyEn from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json";
import busanGyeongjuUnescoLegacyKo from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.ko.json";
import busanGyeongjuUnescoLegacyZh from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.zh.json";
import busanGyeongjuUnescoLegacyZhTw from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.zh-TW.json";
import busanGyeongjuUnescoLegacyEs from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.es.json";
import busanGyeongjuUnescoLegacyJa from "../busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.ja.json";
import busanPlumCherryBlossomEn from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json";
import busanPlumCherryBlossomKo from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.ko.json";
import busanPlumCherryBlossomZh from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.zh.json";
import busanPlumCherryBlossomZhTw from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.zh-TW.json";
import busanPlumCherryBlossomEs from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.es.json";
import busanPlumCherryBlossomJa from "../busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.ja.json";
import busanCruiseShoreExcursionBusTourEn from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.en.json";
import busanOutskirtsTongdosaEn from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.en.json";
import busanOutskirtsTongdosaKo from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.ko.json";
import busanOutskirtsTongdosaZh from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.zh.json";
import busanOutskirtsTongdosaZhTw from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.zh-TW.json";
import busanOutskirtsTongdosaEs from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.es.json";
import busanOutskirtsTongdosaJa from "../busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.ja.json";
import busanCruiseShoreExcursionBusTourKo from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.ko.json";
import busanCruiseShoreExcursionBusTourZh from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.zh.json";
import busanCruiseShoreExcursionBusTourZhTw from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.zh-TW.json";
import busanCruiseShoreExcursionBusTourEs from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.es.json";
import busanCruiseShoreExcursionBusTourJa from "../busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.ja.json";
import busanPrivateCarCharterCruiseShoreEn from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json";
import busanPrivateCarCharterCruiseShoreKo from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.ko.json";
import busanPrivateCarCharterCruiseShoreZh from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.zh.json";
import busanPrivateCarCharterCruiseShoreZhTw from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.zh-TW.json";
import busanPrivateCarCharterCruiseShoreEs from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.es.json";
import busanPrivateCarCharterCruiseShoreJa from "../busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.ja.json";
import busanSmallGroupSightseeingCruiseEn from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json";
import busanSmallGroupSightseeingCruiseKo from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.ko.json";
import busanSmallGroupSightseeingCruiseZh from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.zh.json";
import busanSmallGroupSightseeingCruiseZhTw from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.zh-TW.json";
import busanSmallGroupSightseeingCruiseEs from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.es.json";
import busanSmallGroupSightseeingCruiseJa from "../busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.ja.json";
import busanSpringCherryBlossomGyeongjuEn from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json";
import busanSpringCherryBlossomGyeongjuKo from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.ko.json";
import busanSpringCherryBlossomGyeongjuZh from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.zh.json";
import busanSpringCherryBlossomGyeongjuZhTw from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.zh-TW.json";
import busanSpringCherryBlossomGyeongjuEs from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.es.json";
import busanSpringCherryBlossomGyeongjuJa from "../busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.ja.json";
import busanTopAttractionsDayEn from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.en.json";
import busanTopAttractionsDayKo from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.ko.json";
import busanTopAttractionsDayZh from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.zh.json";
import busanTopAttractionsDayZhTw from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.zh-TW.json";
import busanTopAttractionsDayEs from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.es.json";
import busanTopAttractionsDayJa from "../busan-top-attractions-day-tour/busan-top-attractions-day-tour.ja.json";
import eastSignaturePageEn from "../east-signature-nature-core/east-signature-nature-core.en.json";
import eastSignaturePageKo from "../east-signature-nature-core/east-signature-nature-core.ko.json";
import eastSignaturePageZh from "../east-signature-nature-core/east-signature-nature-core.zh.json";
import eastSignaturePageZhTw from "../east-signature-nature-core/east-signature-nature-core.zh-TW.json";
import eastSignaturePageEs from "../east-signature-nature-core/east-signature-nature-core.es.json";
import eastSignaturePageJa from "../east-signature-nature-core/east-signature-nature-core.ja.json";
import fromBusanGyeongjuAncientCapitalEn from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.en.json";
import fromBusanGyeongjuAncientCapitalKo from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.ko.json";
import fromBusanGyeongjuAncientCapitalZh from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.zh.json";
import fromBusanGyeongjuAncientCapitalZhTw from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.zh-TW.json";
import fromBusanGyeongjuAncientCapitalEs from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.es.json";
import fromBusanGyeongjuAncientCapitalJa from "../from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.ja.json";
import fromIncheonSeoulDayCruiseEn from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json";
import fromIncheonSeoulDayCruiseKo from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.ko.json";
import fromIncheonSeoulDayCruiseZh from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.zh.json";
import fromIncheonSeoulDayCruiseZhTw from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.zh-TW.json";
import fromIncheonSeoulDayCruiseEs from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.es.json";
import fromIncheonSeoulDayCruiseJa from "../from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.ja.json";
import incheonSeoulPrivateCarShoreCruiseEn from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json";
import incheonSeoulPrivateCarShoreCruiseKo from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.ko.json";
import incheonSeoulPrivateCarShoreCruiseZh from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.zh.json";
import incheonSeoulPrivateCarShoreCruiseZhTw from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.zh-TW.json";
import incheonSeoulPrivateCarShoreCruiseEs from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.es.json";
import incheonSeoulPrivateCarShoreCruiseJa from "../incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.ja.json";
import jejuCherryBlossomEastEn from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json";
import jejuCherryBlossomEastKo from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.ko.json";
import jejuCherryBlossomEastZh from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.zh.json";
import jejuCherryBlossomEastZhTw from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.zh-TW.json";
import jejuCherryBlossomEastEs from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.es.json";
import jejuCherryBlossomEastJa from "../jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.ja.json";
import jejuCruiseShoreBusEn from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json";
import jejuCruiseShoreBusKo from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ko.json";
import jejuCruiseShoreBusZh from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh.json";
import jejuCruiseShoreBusZhTw from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.zh-TW.json";
import jejuCruiseShoreBusEs from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.es.json";
import jejuCruiseShoreBusJa from "../jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.ja.json";
import jejuCruiseShoreSmallGroupEn from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json";
import jejuCruiseShoreSmallGroupKo from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ko.json";
import jejuCruiseShoreSmallGroupZh from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh.json";
import jejuCruiseShoreSmallGroupZhTw from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.zh-TW.json";
import jejuCruiseShoreSmallGroupEs from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.es.json";
import jejuCruiseShoreSmallGroupJa from "../jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.ja.json";
import jejuEasternUnescoSpotsEn from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json";
import jejuEasternUnescoSpotsKo from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.ko.json";
import jejuEasternUnescoSpotsZh from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.zh.json";
import jejuEasternUnescoSpotsZhTw from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.zh-TW.json";
import jejuEasternUnescoSpotsEs from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.es.json";
import jejuEasternUnescoSpotsJa from "../jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.ja.json";
import jejuGrandPageEn from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json";
import jejuGrandPageKo from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.ko.json";
import jejuGrandPageZh from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh.json";
import jejuGrandPageZhTw from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.zh-TW.json";
import jejuGrandPageEs from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.es.json";
import jejuGrandPageJa from "../jeju-grand-highlights-loop/jeju-grand-highlights-loop.ja.json";
import jejuHydrangeaFestivalEastEn from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json";
import jejuHydrangeaFestivalEastKo from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.ko.json";
import jejuHydrangeaFestivalEastZh from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.zh.json";
import jejuHydrangeaFestivalEastZhTw from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.zh-TW.json";
import jejuHydrangeaFestivalEastEs from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.es.json";
import jejuHydrangeaFestivalEastJa from "../jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.ja.json";
import jejuHydrangeaFestivalSouthwestEn from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json";
import jejuHydrangeaFestivalSouthwestKo from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.ko.json";
import jejuHydrangeaFestivalSouthwestZh from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.zh.json";
import jejuHydrangeaFestivalSouthwestZhTw from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.zh-TW.json";
import jejuHydrangeaFestivalSouthwestEs from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.es.json";
import jejuHydrangeaFestivalSouthwestJa from "../jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.ja.json";
import jejuIslandPrivateCarCharterEn from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json";
import jejuIslandPrivateCarCharterKo from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.ko.json";
import jejuIslandPrivateCarCharterZh from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.zh.json";
import jejuIslandPrivateCarCharterZhTw from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.zh-TW.json";
import jejuIslandPrivateCarCharterEs from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.es.json";
import jejuIslandPrivateCarCharterJa from "../jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.ja.json";
import jejuSouthernTopUnescoSpotsEn from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json";
import jejuSouthernTopUnescoSpotsKo from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.ko.json";
import jejuSouthernTopUnescoSpotsZh from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.zh.json";
import jejuSouthernTopUnescoSpotsZhTw from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.zh-TW.json";
import jejuSouthernTopUnescoSpotsEs from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.es.json";
import jejuSouthernTopUnescoSpotsJa from "../jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.ja.json";
import jejuWestSouthFullDayAuthenticEn from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json";
import jejuWestSouthFullDayAuthenticKo from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.ko.json";
import jejuWestSouthFullDayAuthenticZh from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.zh.json";
import jejuWestSouthFullDayAuthenticZhTw from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.zh-TW.json";
import jejuWestSouthFullDayAuthenticEs from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.es.json";
import jejuWestSouthFullDayAuthenticJa from "../jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.ja.json";
import jejuWinterSouthwestTangerineEn from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.en.json";
import jejuWinterSouthwestTangerineKo from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.ko.json";
import jejuWinterSouthwestTangerineZh from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.zh.json";
import jejuWinterSouthwestTangerineZhTw from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.zh-TW.json";
import jejuWinterSouthwestTangerineEs from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.es.json";
import jejuWinterSouthwestTangerineJa from "../jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.ja.json";
import pocheonSanjeongLakeHerbIslandEn from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json";
import pocheonSanjeongLakeHerbIslandKo from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.ko.json";
import pocheonSanjeongLakeHerbIslandZh from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.zh.json";
import pocheonSanjeongLakeHerbIslandZhTw from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.zh-TW.json";
import pocheonSanjeongLakeHerbIslandEs from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.es.json";
import pocheonSanjeongLakeHerbIslandJa from "../pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.ja.json";
import seoulDmzPrivate3rdTunnelEn from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json";
import seoulDmzPrivate3rdTunnelKo from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.ko.json";
import seoulDmzPrivate3rdTunnelZh from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.zh.json";
import seoulDmzPrivate3rdTunnelZhTw from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.zh-TW.json";
import seoulDmzPrivate3rdTunnelEs from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.es.json";
import seoulDmzPrivate3rdTunnelJa from "../seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.ja.json";
import seoulPrivateNamiMorningCalmEn from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json";
import seoulPrivateNamiMorningCalmKo from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.ko.json";
import seoulPrivateNamiMorningCalmZh from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.zh.json";
import seoulPrivateNamiMorningCalmZhTw from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.zh-TW.json";
import seoulPrivateNamiMorningCalmEs from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.es.json";
import seoulPrivateNamiMorningCalmJa from "../seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.ja.json";
import seoulSeoraksanNamiMorningCalmEn from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.en.json";
import seoulSeoraksanNamiMorningCalmKo from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.ko.json";
import seoulSeoraksanNamiMorningCalmZh from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.zh.json";
import seoulSeoraksanNamiMorningCalmZhTw from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.zh-TW.json";
import seoulSeoraksanNamiMorningCalmEs from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.es.json";
import seoulSeoraksanNamiMorningCalmJa from "../seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.ja.json";
import seoulSeoraksanSokchoBeachEn from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json";
import seoulSeoraksanSokchoBeachKo from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.ko.json";
import seoulSeoraksanSokchoBeachZh from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.zh.json";
import seoulSeoraksanSokchoBeachZhTw from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.zh-TW.json";
import seoulSeoraksanSokchoBeachEs from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.es.json";
import seoulSeoraksanSokchoBeachJa from "../seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.ja.json";
import seoulSuburbsPrivateCharteredCarEn from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json";
import seoulSuburbsPrivateCharteredCarKo from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.ko.json";
import seoulSuburbsPrivateCharteredCarZh from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.zh.json";
import seoulSuburbsPrivateCharteredCarZhTw from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.zh-TW.json";
import seoulSuburbsPrivateCharteredCarEs from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.es.json";
import seoulSuburbsPrivateCharteredCarJa from "../seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.ja.json";
import seoulSuwonHwaseongFolkVillageEn from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.en.json";
import seoulSuwonHwaseongFolkVillageKo from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.ko.json";
import seoulSuwonHwaseongFolkVillageZh from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.zh.json";
import seoulSuwonHwaseongFolkVillageZhTw from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.zh-TW.json";
import seoulSuwonHwaseongFolkVillageEs from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.es.json";
import seoulSuwonHwaseongFolkVillageJa from "../seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.ja.json";
import seoulSuwonHwaseongGwangmyeongCaveEn from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json";
import seoulSuwonHwaseongGwangmyeongCaveKo from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.ko.json";
import seoulSuwonHwaseongGwangmyeongCaveZh from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.zh.json";
import seoulSuwonHwaseongGwangmyeongCaveZhTw from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.zh-TW.json";
import seoulSuwonHwaseongGwangmyeongCaveEs from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.es.json";
import seoulSuwonHwaseongGwangmyeongCaveJa from "../seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.ja.json";
import seoulSuwonHwaseongWaujeongsaEn from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json";
import seoulSuwonHwaseongWaujeongsaKo from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.ko.json";
import seoulSuwonHwaseongWaujeongsaZh from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.zh.json";
import seoulSuwonHwaseongWaujeongsaZhTw from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.zh-TW.json";
import seoulSuwonHwaseongWaujeongsaEs from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.es.json";
import seoulSuwonHwaseongWaujeongsaJa from "../seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.ja.json";
import southwestHallasanOsullocAewolEn from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json";
import southwestHallasanOsullocAewolKo from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.ko.json";
import southwestHallasanOsullocAewolZh from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.zh.json";
import southwestHallasanOsullocAewolZhTw from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.zh-TW.json";
import southwestHallasanOsullocAewolEs from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.es.json";
import southwestHallasanOsullocAewolJa from "../southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.ja.json";

export type StaticTourProductRegistration = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: readonly string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
  /** Integer USD for marketing cards — must match `priceLabel` */
  listPriceUsd: number;
  /** Optional strikethrough list (USD), e.g. compare-at / anchor */
  compareAtPriceUsd?: number;
  /** Small-group / van capacity line on home, e.g. 8 */
  maxGroupSize?: number;
};

export const STATIC_TOUR_PRODUCT_DETAIL_PREFIX = "/tour-product" as const;

export function hrefStaticTourProductDetail(slug: string): string {
  return `${STATIC_TOUR_PRODUCT_DETAIL_PREFIX}/${slug}`;
}

type CatalogCardJsonShape = {
  slug: string;
  title: string;
  subtitle: string;
  region: string;
  duration: string;
  stopsCount: number;
  rating: number;
  reviewCount: number;
  badges: readonly string[];
  heroImage: string;
  thumbnail: string;
  priceLabel: string;
  shortCardDescription: string;
};

type PageJsonShape = {
  catalog_card: CatalogCardJsonShape;
  price?: { amountLabel?: unknown };
};

const RAW_PAGES_BY_LOCALE = {
  en: {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyEn as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomEn as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourEn as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaEn as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreEn as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseEn as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuEn as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayEn as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageEn as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalEn as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseEn as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseEn as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastEn as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusEn as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupEn as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsEn as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageEn as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastEn as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestEn as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterEn as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsEn as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticEn as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineEn as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandEn as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelEn as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmEn as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmEn as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachEn as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarEn as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageEn as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveEn as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaEn as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolEn as PageJsonShape,
  },
  ko: {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyKo as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomKo as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourKo as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaKo as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreKo as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseKo as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuKo as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayKo as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageKo as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalKo as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseKo as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseKo as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastKo as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusKo as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupKo as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsKo as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageKo as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastKo as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestKo as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterKo as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsKo as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticKo as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineKo as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandKo as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelKo as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmKo as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmKo as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachKo as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarKo as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageKo as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveKo as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaKo as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolKo as PageJsonShape,
  },
  zh: {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyZh as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomZh as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourZh as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaZh as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreZh as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseZh as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuZh as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayZh as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageZh as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalZh as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseZh as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseZh as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastZh as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusZh as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupZh as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsZh as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageZh as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastZh as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestZh as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterZh as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsZh as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticZh as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineZh as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandZh as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelZh as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmZh as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmZh as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachZh as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarZh as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageZh as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveZh as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaZh as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolZh as PageJsonShape,
  },
  "zh-TW": {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyZhTw as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomZhTw as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourZhTw as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaZhTw as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreZhTw as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseZhTw as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuZhTw as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayZhTw as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageZhTw as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalZhTw as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseZhTw as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseZhTw as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastZhTw as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusZhTw as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupZhTw as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsZhTw as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageZhTw as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastZhTw as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestZhTw as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterZhTw as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsZhTw as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticZhTw as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineZhTw as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandZhTw as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelZhTw as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmZhTw as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmZhTw as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachZhTw as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarZhTw as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageZhTw as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveZhTw as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaZhTw as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolZhTw as PageJsonShape,
  },
  es: {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyEs as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomEs as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourEs as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaEs as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreEs as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseEs as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuEs as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayEs as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageEs as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalEs as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseEs as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseEs as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastEs as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusEs as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupEs as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsEs as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageEs as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastEs as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestEs as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterEs as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsEs as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticEs as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineEs as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandEs as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelEs as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmEs as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmEs as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachEs as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarEs as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageEs as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveEs as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaEs as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolEs as PageJsonShape,
  },
  ja: {
    "busan-gyeongju-unesco-legacy-tour-national-museum": busanGyeongjuUnescoLegacyJa as PageJsonShape,
    "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju": busanPlumCherryBlossomJa as PageJsonShape,
    "busan-cruise-shore-excursion-bus-tour": busanCruiseShoreExcursionBusTourJa as PageJsonShape,
    "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour": busanOutskirtsTongdosaJa as PageJsonShape,
    "busan-private-car-charter-cruise-shore": busanPrivateCarCharterCruiseShoreJa as PageJsonShape,
    "busan-small-group-sightseeing-tour-cruise-passengers": busanSmallGroupSightseeingCruiseJa as PageJsonShape,
    "busan-spring-cherry-blossom-gyeongju-highlights-day-tour": busanSpringCherryBlossomGyeongjuJa as PageJsonShape,
    "busan-top-attractions-day-tour": busanTopAttractionsDayJa as PageJsonShape,
    "east-signature-nature-core": eastSignaturePageJa as PageJsonShape,
    "from-busan-gyeongju-ancient-capital-day-tour": fromBusanGyeongjuAncientCapitalJa as PageJsonShape,
    "from-incheon-seoul-day-tour-cruise-guests": fromIncheonSeoulDayCruiseJa as PageJsonShape,
    "incheon-seoul-private-car-shore-excursion-cruise": incheonSeoulPrivateCarShoreCruiseJa as PageJsonShape,
    "jeju-cherry-blossom-tour-east-route": jejuCherryBlossomEastJa as PageJsonShape,
    "jeju-cruise-shore-excursion-bus-tour": jejuCruiseShoreBusJa as PageJsonShape,
    "jeju-cruise-shore-excursion-small-group-tour": jejuCruiseShoreSmallGroupJa as PageJsonShape,
    "jeju-eastern-unesco-spots-day-tour": jejuEasternUnescoSpotsJa as PageJsonShape,
    "jeju-grand-highlights-loop": jejuGrandPageJa as PageJsonShape,
    "jeju-hydrangea-festival-tour-east-route": jejuHydrangeaFestivalEastJa as PageJsonShape,
    "jeju-hydrangea-festival-tour-southwest-route": jejuHydrangeaFestivalSouthwestJa as PageJsonShape,
    "jeju-island-private-car-charter-tour": jejuIslandPrivateCarCharterJa as PageJsonShape,
    "jeju-southern-top-unesco-spots-tour": jejuSouthernTopUnescoSpotsJa as PageJsonShape,
    "jeju-west-south-full-day-authentic-tour": jejuWestSouthFullDayAuthenticJa as PageJsonShape,
    "jeju-winter-southwest-tangerine-snow-camellia-tour": jejuWinterSouthwestTangerineJa as PageJsonShape,
    "pocheon-sanjeong-lake-herb-island-art-valley": pocheonSanjeongLakeHerbIslandJa as PageJsonShape,
    "seoul-dmz-private-3rd-tunnel-suspension-bridge": seoulDmzPrivate3rdTunnelJa as PageJsonShape,
    "seoul-private-nami-morning-calm-petite-france": seoulPrivateNamiMorningCalmJa as PageJsonShape,
    "seoul-seoraksan-nami-island-morning-calm-day-tour": seoulSeoraksanNamiMorningCalmJa as PageJsonShape,
    "seoul-seoraksan-national-park-sokcho-beach-day-trip": seoulSeoraksanSokchoBeachJa as PageJsonShape,
    "seoul-suburbs-private-chartered-car-10hr": seoulSuburbsPrivateCharteredCarJa as PageJsonShape,
    "seoul-suwon-hwaseong-folk-village-starfield-library": seoulSuwonHwaseongFolkVillageJa as PageJsonShape,
    "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": seoulSuwonHwaseongGwangmyeongCaveJa as PageJsonShape,
    "seoul-suwon-hwaseong-waujeongsa-starfield": seoulSuwonHwaseongWaujeongsaJa as PageJsonShape,
    "southwest-hallasan-osulloc-aewol": southwestHallasanOsullocAewolJa as PageJsonShape,
  },
} as const;

const SLUG_ORDER: readonly string[] = [
  "busan-gyeongju-unesco-legacy-tour-national-museum",
  "busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju",
  "busan-cruise-shore-excursion-bus-tour",
  "busan-outskirts-tongdosa-amethyst-yeongnam-day-tour",
  "busan-private-car-charter-cruise-shore",
  "busan-small-group-sightseeing-tour-cruise-passengers",
  "busan-spring-cherry-blossom-gyeongju-highlights-day-tour",
  "busan-top-attractions-day-tour",
  "east-signature-nature-core",
  "from-busan-gyeongju-ancient-capital-day-tour",
  "from-incheon-seoul-day-tour-cruise-guests",
  "incheon-seoul-private-car-shore-excursion-cruise",
  "jeju-cherry-blossom-tour-east-route",
  "jeju-cruise-shore-excursion-bus-tour",
  "jeju-cruise-shore-excursion-small-group-tour",
  "jeju-eastern-unesco-spots-day-tour",
  "jeju-grand-highlights-loop",
  "jeju-hydrangea-festival-tour-east-route",
  "jeju-hydrangea-festival-tour-southwest-route",
  "jeju-island-private-car-charter-tour",
  "jeju-southern-top-unesco-spots-tour",
  "jeju-west-south-full-day-authentic-tour",
  "jeju-winter-southwest-tangerine-snow-camellia-tour",
  "pocheon-sanjeong-lake-herb-island-art-valley",
  "seoul-dmz-private-3rd-tunnel-suspension-bridge",
  "seoul-private-nami-morning-calm-petite-france",
  "seoul-seoraksan-nami-island-morning-calm-day-tour",
  "seoul-seoraksan-national-park-sokcho-beach-day-trip",
  "seoul-suburbs-private-chartered-car-10hr",
  "seoul-suwon-hwaseong-folk-village-starfield-library",
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library",
  "seoul-suwon-hwaseong-waujeongsa-starfield",
  "southwest-hallasan-osulloc-aewol",];

/**
 * Locale-invariant per-slug overrides — translated catalog_card never owns
 * pricing/capacity; those are sourced here so locale switch can't drift them.
 */
type SlugOverride = {
  listPriceUsd?: number;
  compareAtPriceUsd?: number;
  maxGroupSize?: number;
};

const SLUG_OVERRIDES: Record<string, SlugOverride> = {
  "east-signature-nature-core": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-grand-highlights-loop": { listPriceUsd: 79, compareAtPriceUsd: 89, maxGroupSize: 8 },
  "southwest-hallasan-osulloc-aewol": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "busan-gyeongju-unesco-legacy-tour-national-museum": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "busan-small-group-sightseeing-tour-cruise-passengers": { listPriceUsd: 79, compareAtPriceUsd: 85, maxGroupSize: 8 },
  "busan-top-attractions-day-tour": { listPriceUsd: 29, compareAtPriceUsd: 41, maxGroupSize: 12 },
  "from-busan-gyeongju-ancient-capital-day-tour": { listPriceUsd: 39, compareAtPriceUsd: 50, maxGroupSize: 8 },
  "from-incheon-seoul-day-tour-cruise-guests": { listPriceUsd: 69, compareAtPriceUsd: 76, maxGroupSize: 8 },
  "incheon-seoul-private-car-shore-excursion-cruise": { listPriceUsd: 419, maxGroupSize: 12 },
  "jeju-cherry-blossom-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-cruise-shore-excursion-bus-tour": { listPriceUsd: 52, compareAtPriceUsd: 59 },
  "jeju-cruise-shore-excursion-small-group-tour": { listPriceUsd: 79, compareAtPriceUsd: 85, maxGroupSize: 8 },
  "jeju-eastern-unesco-spots-day-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-east-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-hydrangea-festival-tour-southwest-route": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-southern-top-unesco-spots-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-west-south-full-day-authentic-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "jeju-winter-southwest-tangerine-snow-camellia-tour": { listPriceUsd: 59, compareAtPriceUsd: 69, maxGroupSize: 8 },
  "pocheon-sanjeong-lake-herb-island-art-valley": { listPriceUsd: 49, compareAtPriceUsd: 62, maxGroupSize: 8 },
  "seoul-dmz-private-3rd-tunnel-suspension-bridge": { listPriceUsd: 419, maxGroupSize: 15 },
  "seoul-private-nami-morning-calm-petite-france": { listPriceUsd: 189 },
  "seoul-seoraksan-national-park-sokcho-beach-day-trip": { listPriceUsd: 49, compareAtPriceUsd: 57, maxGroupSize: 8 },
  "seoul-suburbs-private-chartered-car-10hr": { listPriceUsd: 179, maxGroupSize: 13 },
  "seoul-suwon-hwaseong-folk-village-starfield-library": { listPriceUsd: 59, compareAtPriceUsd: 66, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library": { listPriceUsd: 52, compareAtPriceUsd: 59, maxGroupSize: 8 },
  "seoul-suwon-hwaseong-waujeongsa-starfield": { listPriceUsd: 47, compareAtPriceUsd: 54, maxGroupSize: 8 },
};

/**
 * Parse `listPriceUsd` from authoring JSON. Prefer `price.amountLabel`
 * ("78"), fall back to digits in `catalog_card.priceLabel`. Always read
 * from the EN page so localized priceLabel formatting can't break parsing.
 */
function parseListPriceUsd(page: PageJsonShape): number {
  const amountLabel = page.price && typeof page.price.amountLabel === "string" ? page.price.amountLabel : "";
  if (amountLabel) {
    const n = Number(amountLabel.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  const priceLabel = page.catalog_card?.priceLabel ?? "";
  const m = priceLabel.match(/(\d+(?:\.\d+)?)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
  }
  return 0;
}

function buildRegistration(slug: string, locale: Locale): StaticTourProductRegistration {
  const enMap = RAW_PAGES_BY_LOCALE.en as Record<string, PageJsonShape>;
  const localeMap = (RAW_PAGES_BY_LOCALE[locale] ?? RAW_PAGES_BY_LOCALE.en) as Record<string, PageJsonShape>;
  const localePage = localeMap[slug] ?? enMap[slug];
  const enPage = enMap[slug];
  const cc = localePage.catalog_card;
  const override = SLUG_OVERRIDES[slug] ?? {};
  return {
    slug: cc.slug,
    title: cc.title,
    subtitle: cc.subtitle,
    region: cc.region,
    duration: cc.duration,
    stopsCount: cc.stopsCount,
    rating: cc.rating,
    reviewCount: cc.reviewCount,
    badges: cc.badges,
    heroImage: cc.heroImage,
    thumbnail: cc.thumbnail,
    priceLabel: cc.priceLabel,
    shortCardDescription: cc.shortCardDescription,
    listPriceUsd: override.listPriceUsd ?? parseListPriceUsd(enPage),
    compareAtPriceUsd: override.compareAtPriceUsd,
    maxGroupSize: override.maxGroupSize,
  };
}

const PER_LOCALE_PRODUCTS: Record<Locale, readonly StaticTourProductRegistration[]> = {
  en: SLUG_ORDER.map((s) => buildRegistration(s, "en")),
  ko: SLUG_ORDER.map((s) => buildRegistration(s, "ko")),
  zh: SLUG_ORDER.map((s) => buildRegistration(s, "zh")),
  "zh-TW": SLUG_ORDER.map((s) => buildRegistration(s, "zh-TW")),
  es: SLUG_ORDER.map((s) => buildRegistration(s, "es")),
  ja: SLUG_ORDER.map((s) => buildRegistration(s, "ja")),
};

/** EN catalog list — kept for back-compat (sitemap reads only `slug`). */
export const STATIC_TOUR_PRODUCTS: readonly StaticTourProductRegistration[] = PER_LOCALE_PRODUCTS.en;

/** Locale-aware catalog list. Defaults to en if locale is missing/unknown. */
export function listStaticTourProducts(locale: Locale = "en"): readonly StaticTourProductRegistration[] {
  return PER_LOCALE_PRODUCTS[locale] ?? PER_LOCALE_PRODUCTS.en;
}

/**
 * Locale-aware lookup. `locale` defaults to "en" so legacy single-arg callers
 * keep their previous behavior; pass an explicit locale from anywhere that
 * knows the user's language.
 */
export function getStaticTourProductBySlug(
  slug: string,
  locale: Locale = "en",
): StaticTourProductRegistration | undefined {
  return listStaticTourProducts(locale).find((p) => p.slug === slug);
}
