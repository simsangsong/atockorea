import { Camera, Mountain, Footprints, CloudRain, Users, Scale } from "lucide-react";
import type { GlanceItem } from "../staticProductData";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const ICON_MAP: Record<GlanceItem["icon"], typeof Camera> = {
  camera: Camera,
  mountain: Mountain,
  footprints: Footprints,
  "cloud-rain": CloudRain,
  users: Users,
  scale: Scale,
};

export type TourAtAGlanceProps = Pick<EastSignatureNatureCoreDetailViewModel, "glanceItems" | "sectionUi">;

export function TourAtAGlance({ glanceItems, sectionUi }: TourAtAGlanceProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[15px] font-semibold text-foreground tracking-tight">{sectionUi.atAGlanceTitle}</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{sectionUi.atAGlanceSubtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {glanceItems.map((item) => {
          const Icon = ICON_MAP[item.icon];
          return (
            <div
              key={item.label}
              className="group flex flex-col items-center text-center rounded-2xl px-2 py-4 transition-all duration-200 hover:shadow-md"
              style={{
                background: "rgba(250, 249, 247, 0.92)",
                border: "1px solid rgba(0, 0, 0, 0.045)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.03), 0 3px 10px rgba(0,0,0,0.02)",
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl mb-3 transition-transform duration-200 group-hover:scale-105"
                style={{
                  background: "rgba(0, 0, 0, 0.035)",
                  border: "1px solid rgba(0, 0, 0, 0.03)",
                }}
              >
                <Icon className="h-[15px] w-[15px] text-foreground/60" strokeWidth={1.5} />
              </div>
              <p className="text-[15px] font-semibold text-foreground tracking-tight leading-none">{item.label}</p>
              <p className="mt-1.5 text-[9.5px] font-semibold tracking-[0.08em] uppercase text-muted-foreground leading-none">
                {item.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
