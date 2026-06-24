import { type ComponentType } from "react";
import { CarFront, Clock3, MapPinned, Wallet } from "lucide-react";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const POLICY_ICONS: Record<string, LucideIcon> = {
  route: MapPinned,
  pickup: CarFront,
  time: Clock3,
  price: Wallet,
};

const POLICY_ICON_FALLBACK = MapPinned;

export type TourPrivateTourPolicySectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "privateTourPolicy" | "sectionUi"
>;

export function TourPrivateTourPolicySection({ privateTourPolicy }: TourPrivateTourPolicySectionProps) {
  const policy = privateTourPolicy;
  if (!policy || !Array.isArray(policy.groups) || policy.groups.length === 0) return null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">{policy.title}</h2>
        {policy.subtitle && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{policy.subtitle}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {policy.groups.map((group, gi) => {
          const Icon = (group.icon && POLICY_ICONS[group.icon]) || POLICY_ICON_FALLBACK;
          return (
            <div
              key={`${group.title}-${gi}`}
              className="rounded-2xl bg-white p-4 ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 ring-1 ring-slate-200/70">
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                </span>
                <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{group.title}</h3>
              </div>
              <ul className="space-y-2">
                {group.items.map((item, ii) => (
                  <li key={ii} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                    <span className="text-[12.5px] leading-relaxed text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
