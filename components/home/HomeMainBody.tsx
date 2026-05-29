import "@/app/home-v2.css";
import "@/app/home-v2-fidelity.css";
import HomeV2Page, { type HomeV2PageProps } from "@/components/home/v2/HomeV2Page";

/** Main landing — v2 only (legacy homepage toggle removed).
 *  Phase 11 — accepts the new builder-prefetch props and forwards them. */
export function HomeMainBody(props: HomeV2PageProps = {}) {
  return <HomeV2Page {...props} />;
}
