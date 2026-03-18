"use client";

import { HOMEPAGE_COMPARISON } from "@/src/design/homepage";

export default function ComparisonPanel() {
  const { title, subtitle, rows } = HOMEPAGE_COMPARISON;

  return (
    <section
      className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-white"
      aria-labelledby="comparison-panel-heading"
    >
      <div className="container mx-auto max-w-4xl">
        <h2
          id="comparison-panel-heading"
          className="text-xl md:text-2xl font-bold text-[#1A1A1A] mb-2 text-center"
        >
          {title}
        </h2>
        <p className="text-sm md:text-base text-[#1A1A1A]/80 text-center mb-8 max-w-xl mx-auto">
          {subtitle}
        </p>

        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full min-w-[320px] border-collapse rounded-xl overflow-hidden border border-[#E1E5EA] shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
            <thead>
              <tr className="bg-[#F5F7FA] border-b border-[#E1E5EA]">
                <th
                  scope="col"
                  className="text-left py-3 px-3 sm:px-4 text-xs font-bold uppercase tracking-wide text-[#1A1A1A] w-[28%] sm:w-32"
                  aria-label="Feature"
                >
                  {" "}
                </th>
                <th
                  scope="col"
                  className="py-3 px-2 sm:px-4 text-xs font-bold uppercase tracking-wide text-[#1E4EDF] text-center"
                >
                  AI Join
                </th>
                <th
                  scope="col"
                  className="py-3 px-2 sm:px-4 text-xs font-bold uppercase tracking-wide text-[#1A1A1A] text-center"
                >
                  Private
                </th>
                <th
                  scope="col"
                  className="py-3 px-2 sm:px-4 text-xs font-bold uppercase tracking-wide text-[#666666] text-center"
                >
                  Bus
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.label}
                  className={i % 2 === 0 ? "bg-white" : "bg-[#FAFBFC]"}
                >
                  <td className="py-3 px-3 sm:px-4 text-sm font-semibold text-[#1A1A1A] border-b border-[#E8EAED]">
                    {row.label}
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-sm text-[#1A1A1A] text-center border-b border-[#E8EAED] font-medium">
                    {row.ai}
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-sm text-[#1A1A1A] text-center border-b border-[#E8EAED]">
                    {row.private}
                  </td>
                  <td className="py-3 px-2 sm:px-4 text-sm text-[#666666] text-center border-b border-[#E8EAED]">
                    {row.bus}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
