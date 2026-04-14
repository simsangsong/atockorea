import type { Metadata } from "next";
import Link from "next/link";
import {
  STATIC_TOUR_PRODUCTS,
  hrefStaticTourProductDetail,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";

export const metadata: Metadata = {
  title: "Static tour products | AtoC Korea",
  description:
    "Internally registered preview tours (static only — no live inventory or checkout). Each links to a dedicated detail page.",
};

export default function StaticTourProductIndexPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Catalog</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Static tour products</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          These entries are registered only in code. They are not loaded from the tour database and do not enable booking or
          payment.
        </p>

        <ul className="mt-8 space-y-5">
          {STATIC_TOUR_PRODUCTS.map((p) => (
            <li key={p.slug}>
              <Link
                href={hrefStaticTourProductDetail(p.slug)}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <img src={p.thumbnail} alt="" className="h-24 w-32 flex-shrink-0 rounded-lg object-cover" width={128} height={96} />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{p.title}</h2>
                  <p className="mt-1 text-sm text-slate-600 line-clamp-3">{p.shortCardDescription}</p>
                  <p className="mt-2 text-sm font-medium text-slate-900">{p.priceLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{p.region}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{p.duration}</span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {p.stopsCount} stops
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      {p.rating} · {p.reviewCount} reviews
                    </span>
                    {p.badges.map((b) => (
                      <span key={b} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
    </main>
  );
}
