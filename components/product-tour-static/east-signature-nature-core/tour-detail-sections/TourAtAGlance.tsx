import { Camera, Mountain, Footprints, CloudRain, Users, Scale, Gauge } from "lucide-react";
import type { GlanceItem } from "../staticProductData";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const ICON_MAP: Record<GlanceItem["icon"], typeof Camera> = {
  camera: Camera,
  mountain: Mountain,
  footprints: Footprints,
  "cloud-rain": CloudRain,
  users: Users,
  scale: Scale,
  gauge: Gauge,
};

const GLANCE_ICON_FALLBACK = Scale;

export type TourAtAGlanceProps = Pick<EastSignatureNatureCoreDetailViewModel, "glanceItems" | "sectionUi">;

export function TourAtAGlance({ glanceItems, sectionUi }: TourAtAGlanceProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-semibold text-foreground tracking-[-0.02em]">{sectionUi.atAGlanceTitle}</h2>
        <p className="mt-1.5 text-[13px] text-muted-foreground leading-relaxed">{sectionUi.atAGlanceSubtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {glanceItems.map((item) => {
          const Icon = ICON_MAP[item.icon] ?? GLANCE_ICON_FALLBACK;
          return (
            <div
              key={item.label}
              className="tour-glance-card group relative flex aspect-square flex-col items-center justify-center text-center rounded-2xl p-3 transition-all duration-300"
            >
              <span aria-hidden className="tour-glance-card__sheen" />
              <div className="tour-glance-card__icon-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full mb-2.5 transition-transform duration-300 group-hover:scale-[1.06]">
                <Icon className="h-[16px] w-[16px]" strokeWidth={1.6} />
              </div>
              <p className="text-[9.5px] font-semibold tracking-[0.14em] uppercase text-muted-foreground leading-none">
                {item.label}
              </p>
              <p className="mt-1.5 text-[14px] font-semibold text-foreground tracking-[-0.01em] leading-[1.15] line-clamp-2">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
