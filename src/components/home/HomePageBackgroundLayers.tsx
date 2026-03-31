/**
 * Visual-only: matches v0 prototype backdrop (fixed scenic photo + frosted white veil).
 * Does not affect routing, data, or Header/Footer behavior.
 */
export function HomePageBackgroundLayers() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-slate-50 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1506197603052-3cc9c3a201bd?auto=format&fit=crop&w=2070&q=80')",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-white/60 backdrop-blur-[50px]"
        aria-hidden
      />
    </>
  );
}
