import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CANONICAL_EAST_SIGNATURE_PRODUCT_PATH } from "@/lib/tour-consumer-visibility";

/** Former preview slugs for the same flagship product — only canonical page is public now. */
const REDIRECT_SLUGS = new Set([
  "jeju-east-small-group-template-preview",
  "east-jeju-signature-small-group",
]);

export const metadata: Metadata = {
  title: "Tour preview",
  robots: { index: false, follow: false },
};

export default async function TourTemplatePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (REDIRECT_SLUGS.has(slug)) {
    redirect(CANONICAL_EAST_SIGNATURE_PRODUCT_PATH);
  }
  notFound();
}
