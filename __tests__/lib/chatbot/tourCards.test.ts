import { buildTourCardsFromReply, extractTourSlugs, MAX_TOUR_CARDS } from "@/lib/chatbot/tourCards";
import { listStaticTourProducts } from "@/components/product-tour-static/catalog/staticTourCatalogCards";

// Real registry slugs (already consumer-visibility filtered).
const products = listStaticTourProducts("en");
const [p1, p2, p3, p4] = products;

describe("extractTourSlugs", () => {
  it("dedupes and preserves order across absolute + relative URLs", () => {
    const reply = `See https://www.atockorea.com/tour-product/${p1.slug} and /tour-product/${p2.slug} (again: /tour-product/${p1.slug})`;
    expect(extractTourSlugs(reply)).toEqual([p1.slug, p2.slug]);
  });
});

describe("buildTourCardsFromReply (W4.1)", () => {
  it("builds deterministic cards from registry data and strips the raw URLs", () => {
    const reply = [
      "These fit your dates:",
      `1. ${p1.title} · /tour-product/${p1.slug}`,
      `2. ${p2.title} · https://www.atockorea.com/tour-product/${p2.slug}`,
    ].join("\n");
    const { cards, cleanedReply } = buildTourCardsFromReply(reply, "en");
    expect(cards.map((c) => c.slug)).toEqual([p1.slug, p2.slug]);
    expect(cards[0]).toMatchObject({
      title: p1.title,
      image_url: p1.thumbnail || p1.heroImage,
      price_from_usd: p1.listPriceUsd,
      href: `/tour-product/${p1.slug}`,
    });
    expect(cleanedReply).not.toContain(`/tour-product/${p1.slug}`);
    expect(cleanedReply).not.toContain(`/tour-product/${p2.slug}`);
    // Orphaned " · " separators are tidied off the line ends.
    expect(cleanedReply).not.toMatch(/·\s*$/m);
    expect(cleanedReply).toContain(p1.title);
  });

  it("keeps markdown link labels when the target becomes a card", () => {
    const reply = `Try [${p1.title}](/tour-product/${p1.slug}) for a relaxed day.`;
    const { cards, cleanedReply } = buildTourCardsFromReply(reply, "en");
    expect(cards).toHaveLength(1);
    expect(cleanedReply).toContain(p1.title);
    expect(cleanedReply).not.toContain("](");
    expect(cleanedReply).not.toContain(`/tour-product/${p1.slug}`);
  });

  it("leaves unknown slugs alone (no card, URL untouched)", () => {
    const reply = "Check /tour-product/this-slug-does-not-exist for details.";
    const { cards, cleanedReply } = buildTourCardsFromReply(reply, "en");
    expect(cards).toHaveLength(0);
    expect(cleanedReply).toBe(reply);
  });

  it(`caps at ${MAX_TOUR_CARDS} cards`, () => {
    const reply = [p1, p2, p3, p4]
      .map((p) => `/tour-product/${p.slug}`)
      .join("\n");
    const { cards } = buildTourCardsFromReply(reply, "en");
    expect(cards).toHaveLength(MAX_TOUR_CARDS);
    // The 4th referenced product got no card, so its URL must survive.
    expect(buildTourCardsFromReply(reply, "en").cleanedReply).toContain(p4.slug);
  });

  it("localizes card titles by locale", () => {
    const ko = buildTourCardsFromReply(`/tour-product/${p1.slug}`, "ko");
    const koTitle = listStaticTourProducts("ko").find((p) => p.slug === p1.slug)?.title;
    expect(ko.cards[0]?.title).toBe(koTitle);
  });
});
