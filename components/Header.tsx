// components/Header.tsx
export default function Header() {
  return (
    <header className="w-full bg-white/95 border-b border-gray-100 backdrop-blur">
      <div className="mx-auto max-w-6xl h-12 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#0c66ff] to-[#0050d0] flex items-center justify-center shadow-sm">
            <span className="text-[10px] font-extrabold tracking-tight text-white">
              A2C
            </span>
          </div>

          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-semibold tracking-tight">
              AtoC Korea
            </span>
            <span className="text-[9px] text-gray-500 uppercase tracking-[0.18em]">
              Agency to Customer
            </span>
          </div>
        </div>

        <button className="text-[11px] border border-gray-200 px-3 py-1 rounded-full bg-white">
          EN / 中文
        </button>
      </div>
    </header>
  );
}
