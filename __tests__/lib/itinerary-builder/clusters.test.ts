import {
  tourCluster,
  combine,
  cartAddDecision,
  cartHasJejuEastMix,
} from "@/lib/itinerary-builder/clusters";

const poi = (region: string, lat: number, lng: number) => ({ region, lat, lng });

describe("tourCluster", () => {
  it("splits gyeonggi by coordinate box", () => {
    expect(tourCluster(poi("gyeonggi", 37.792, 127.526))).toBe("gapyeong"); // Nami
    expect(tourCluster(poi("gyeonggi", 37.744, 127.352))).toBe("gapyeong"); // Morning Calm
    expect(tourCluster(poi("gyeonggi", 37.917, 126.698))).toBe("paju"); // 3rd tunnel
    expect(tourCluster(poi("gyeonggi", 37.942, 126.969))).toBe("paju"); // Gamaksan
    expect(tourCluster(poi("gyeonggi", 37.965, 127.132))).toBe("pocheon"); // Herb Island
    expect(tourCluster(poi("gyeonggi", 38.071, 127.32))).toBe("pocheon"); // Sanjeong Lake
    expect(tourCluster(poi("gyeonggi", 37.287, 127.012))).toBe("seoul_south"); // Suwon Hwaseong
    expect(tourCluster(poi("gyeonggi", 37.294, 127.202))).toBe("seoul_south"); // Everland
    expect(tourCluster(poi("gyeonggi", 37.427, 126.866))).toBe("seoul_south"); // Gwangmyeong
  });

  it("maps the other regions to clusters", () => {
    expect(tourCluster(poi("jeju", 33.45, 126.7))).toBe("jeju_east");
    expect(tourCluster(poi("jeju", 33.4, 126.3))).toBe("jeju_west");
    expect(tourCluster(poi("seoul", 37.57, 126.98))).toBe("seoul");
    expect(tourCluster(poi("incheon", 37.42, 126.6))).toBe("seoul");
    expect(tourCluster(poi("gangwon", 38.15, 128.43))).toBe("gangwon");
    expect(tourCluster(poi("busan", 35.1, 129.0))).toBe("busan");
    expect(tourCluster(poi("gyeongju", 35.84, 129.21))).toBe("gyeongju");
    expect(tourCluster(poi("yangsan", 35.4, 129.1))).toBe("yeongnam");
    expect(tourCluster(poi("ulsan", 35.5, 129.3))).toBe("yeongnam");
  });
});

describe("combine", () => {
  it("same cluster is ok", () => {
    expect(combine("seoul", "seoul")).toBe("ok");
  });
  it("blocks across seoul-area / busan-area clusters", () => {
    expect(combine("gapyeong", "paju")).toBe("block");
    expect(combine("seoul", "gapyeong")).toBe("block");
    expect(combine("busan", "gyeongju")).toBe("block");
    expect(combine("seoul_south", "pocheon")).toBe("block");
  });
  it("jeju: west+south free, city neutral, east mix warns", () => {
    expect(combine("jeju_west", "jeju_south")).toBe("ok");
    expect(combine("jeju_city", "jeju_east")).toBe("ok");
    expect(combine("jeju_east", "jeju_west")).toBe("warn");
    expect(combine("jeju_east", "jeju_south")).toBe("warn");
  });
});

describe("cartAddDecision", () => {
  it("block wins over warn wins over ok", () => {
    expect(cartAddDecision([], "seoul")).toBe("ok");
    expect(cartAddDecision(["jeju_west"], "jeju_east")).toBe("warn");
    expect(cartAddDecision(["jeju_west", "seoul"], "jeju_east")).toBe("block");
    expect(cartAddDecision(["seoul"], "gapyeong")).toBe("block");
  });
});

describe("cartHasJejuEastMix", () => {
  it("true only when East mixes with West/South", () => {
    expect(cartHasJejuEastMix(["jeju_east", "jeju_west"])).toBe(true);
    expect(cartHasJejuEastMix(["jeju_east", "jeju_south"])).toBe(true);
    expect(cartHasJejuEastMix(["jeju_east", "jeju_city"])).toBe(false);
    expect(cartHasJejuEastMix(["jeju_east"])).toBe(false);
    expect(cartHasJejuEastMix(["jeju_west", "jeju_south"])).toBe(false);
  });
});
