import { redirect } from "next/navigation";
import { CANONICAL_EAST_SIGNATURE_PRODUCT_PATH } from "@/lib/tour-consumer-visibility";

/** Legacy marketing URL — canonical detail is the static tour product page. */
export default function EastSmallGroupV2LegacyRedirect() {
  redirect(CANONICAL_EAST_SIGNATURE_PRODUCT_PATH);
}
