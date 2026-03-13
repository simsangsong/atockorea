/** ATOC KOREA robot head mascot — theme: Neon Cyan (#00FFFF), Purple (#BF5AF2) */
export function RobotMascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* 외곽 헬멧 */}
      <path
        d="M20 40C20 25 35 15 50 15C65 15 80 25 80 40V65C80 75 70 85 50 85C30 85 20 75 20 65V40Z"
        stroke="#00FFFF"
        strokeWidth="2"
        className="drop-shadow-[0_0_8px_rgba(0,255,255,0.8)]"
      />
      {/* 페이스 플레이트 (다크 글래스) */}
      <path
        d="M25 45C25 38 35 33 50 33C65 33 75 38 75 45V60C75 67 65 72 50 72C35 72 25 67 25 60V45Z"
        fill="#0A1931"
        stroke="#BF5AF2"
        strokeWidth="1"
      />
      {/* 고글/눈 (네온 시안) */}
      <rect x="35" y="48" width="30" height="8" rx="4" fill="#00FFFF" className="animate-pulse" />
      <circle cx="42" cy="52" r="1.5" fill="white" />
      <circle cx="58" cy="52" r="1.5" fill="white" />
      {/* 안테나/센서 (퍼플) */}
      <line x1="50" y1="15" x2="50" y2="5" stroke="#BF5AF2" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="5" r="2" fill="#BF5AF2" className="animate-ping" />
    </svg>
  );
}
