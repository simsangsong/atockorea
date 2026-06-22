import { buildTourCatalogContextText } from "@/lib/chatbot/tourCatalogKnowledge";

describe("tour catalogue chatbot context", () => {
  it("includes available tour URLs for sitewide assistant recommendations", () => {
    const context = buildTourCatalogContextText({
      locale: "en",
      query: "Do you have Jeju UNESCO tours?",
      limit: 5,
      maxChars: 3000,
    });

    expect(context).toContain("Public tour catalogue");
    expect(context).toContain("/tour-product/");
    expect(context.toLowerCase()).toContain("jeju");
  });

  it("prefers relaxed Jeju options for parent/senior-style questions", () => {
    const context = buildTourCatalogContextText({
      locale: "ko",
      query:
        "\uC81C\uC8FC\uC5D0\uC11C \uBD80\uBAA8\uB2D8\uC774\uB791 \uAC08 \uB9CC\uD55C \uD22C\uC5B4 \uCD94\uCC9C\uD574\uC918. \uB108\uBB34 \uD798\uB4E0 \uAC74 \uC2EB\uC5B4",
      limit: 5,
      maxChars: 3000,
    });
    const firstTourLine = context.split("\n").find((line) => line.startsWith("- "));

    expect(firstTourLine).toContain("jeju-island-private-car-charter-tour");
    expect(context.toLowerCase()).toContain("jeju");
  });

  it("prefers flexible private/charter options for accessibility questions (multilingual)", () => {
    for (const query of ["wheelchair accessible tour", "車椅子で参加できるツアーはありますか？", "휠체어로 갈 수 있는 투어 있어요?"]) {
      const context = buildTourCatalogContextText({ locale: "en", query, limit: 4, maxChars: 2500 });
      const firstTourLine = context.split("\n").find((line) => line.startsWith("- ")) ?? "";
      expect(firstTourLine.toLowerCase()).toMatch(/private|charter/);
    }
  });
});
