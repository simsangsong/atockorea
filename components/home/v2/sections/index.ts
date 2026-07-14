export { HeroSection } from "./hero-section";
export { DestinationsShowcase } from "./destinations-showcase";
export { ChooseTravelStyle } from "./choose-travel-style";
export { FeaturedProductsShowcase } from "./featured-products-showcase";
export { FEATURED_PRODUCT_SLUGS } from "./featured-product-slugs";
export { AiAgentBand } from "./ai-agent-band";
export { WhyAtockorea } from "./why-atockorea";
export { ProcessOperational } from "./process-operational";
export { FinalCTA } from "./final-cta";
// Phase 13 D36 — HomeBuilderSection unmounted; 2026-07-14 audit C1 also
// dropped the ItineraryBuilderEntry barrel export (builder flag off, no live
// mount) so the dormant builder no longer rides in the home client bundle.
// Both FILES are kept for the builder's return — re-add exports then.
