export default function Logo({ className = "w-auto h-10 sm:h-12" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Premium Circular Logo with Creative Design */}
      <div className="relative flex-shrink-0">
        <svg
          width="40"
          height="40"
          className="sm:w-12 sm:h-12"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Blue and Orange Gradient */}
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="50%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#F97316" />
            </linearGradient>
            
            {/* Radial gradient for depth */}
            <radialGradient id="radialGradient" cx="50%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </radialGradient>
            
            {/* Shadow filter */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.25" />
            </filter>
            
            {/* Inner glow */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          
          {/* Outer decorative ring */}
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            stroke="url(#logoGradient)"
            strokeWidth="1.5"
            opacity="0.3"
          />
          
          {/* Main circle with gradient */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="url(#logoGradient)"
            filter="url(#shadow)"
          />
          
          {/* Radial highlight overlay */}
          <circle
            cx="24"
            cy="24"
            r="20"
            fill="url(#radialGradient)"
          />
          
          {/* Inner accent circle */}
          <circle
            cx="24"
            cy="24"
            r="16"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />
          
          {/* A2C Text with glow effect */}
          <text
            x="24"
            y="30"
            fontSize="14"
            fontWeight="900"
            fill="white"
            textAnchor="middle"
            fontFamily="system-ui, -apple-system, sans-serif"
            letterSpacing="-0.8"
            filter="url(#glow)"
            style={{ textShadow: '0 0 8px rgba(255,255,255,0.5)' }}
          >
            A2C
          </text>
          
          {/* Decorative dot pattern */}
          <circle cx="24" cy="12" r="1.5" fill="rgba(255,255,255,0.6)" />
          <circle cx="24" cy="36" r="1.5" fill="rgba(255,255,255,0.6)" />
          <circle cx="12" cy="24" r="1.5" fill="rgba(255,255,255,0.6)" />
          <circle cx="36" cy="24" r="1.5" fill="rgba(255,255,255,0.6)" />
        </svg>
      </div>
      
      {/* Company Name with Enhanced Typography - Hidden on mobile */}
      <div className="hidden sm:flex flex-col justify-center">
        <h1 className="text-base sm:text-xl md:text-2xl font-extrabold bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 bg-clip-text text-transparent leading-tight tracking-tight">
          AtoC Korea
        </h1>
        <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-gray-500 leading-tight tracking-wider uppercase">
          Agency to Customer
        </p>
      </div>
    </div>
  );
}

