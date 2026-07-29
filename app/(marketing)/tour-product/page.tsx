import { permanentRedirect } from "next/navigation";

/** Catalog index removed; canonical flagship template: east-signature-nature-core. */
export default function TourProductIndexRedirect() {
  permanentRedirect("/tour-product/east-signature-nature-core");
}
