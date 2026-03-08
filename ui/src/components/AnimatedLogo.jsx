export default function AnimatedLogo({ size = 22 }) {
  // Carousel: a horizontal strip of bots slides left continuously.
  // The viewport shows one bot at a time. The next bot pushes the current one out.
  // 5 slots (4 bots + repeat of first) for seamless loop.
  const step = 28 // each bot cell width
  // Keyframes: hold on each bot, then slide to the next.
  // 4 stops: 0→1→2→3→0 (repeat first = slot 4)
  // Each stop: 5% slide + 20% hold = 25% per bot
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      style={{ overflow: 'hidden' }}
    >
      <style>{`
        @keyframes carousel {
          0%    { transform: translateX(0); }
          5%    { transform: translateX(0); }
          25%   { transform: translateX(-${step}px); }
          30%   { transform: translateX(-${step}px); }
          50%   { transform: translateX(-${step * 2}px); }
          55%   { transform: translateX(-${step * 2}px); }
          75%   { transform: translateX(-${step * 3}px); }
          80%   { transform: translateX(-${step * 3}px); }
          100%  { transform: translateX(-${step * 4}px); }
        }
        .carousel-strip { animation: carousel 4s cubic-bezier(0.45, 0, 0.55, 1) infinite; }
      `}</style>

      <g className="carousel-strip">
        {/* Slot 0: Bot 1 — indigo */}
        <g transform="translate(0, 0)" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8"/>
          <rect width="16" height="12" x="4" y="8" rx="2"/>
          <path d="M2 14h2"/>
          <path d="M20 14h2"/>
          <path d="M15 13v2"/>
          <path d="M9 13v2"/>
        </g>

        {/* Slot 1: Bot 2 — pink */}
        <g transform={`translate(${step}, 0)`} stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 6V2H8"/>
          <path d="M15 11v2"/>
          <path d="M2 12h2"/>
          <path d="M20 12h2"/>
          <path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>
          <path d="M9 11v2"/>
        </g>

        {/* Slot 2: Bot 3 — emerald */}
        <g transform={`translate(${step * 2}, 0)`} stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2l0-4"/>
          <path d="M12 2v2"/>
          <path d="M9 12v9"/>
          <path d="M15 12v9"/>
          <path d="M5 16l4-2"/>
          <path d="M15 14l4 2"/>
          <path d="M9 18h6"/>
          <path d="M10 8v.01"/>
          <path d="M14 8v.01"/>
        </g>

        {/* Slot 3: Bot 4 — amber */}
        <g transform={`translate(${step * 3}, 0)`} stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20v2"/>
          <path d="M12 2v2"/>
          <path d="M17 20v2"/>
          <path d="M17 2v2"/>
          <path d="M2 12h2"/>
          <path d="M2 17h2"/>
          <path d="M2 7h2"/>
          <path d="M20 12h2"/>
          <path d="M20 17h2"/>
          <path d="M20 7h2"/>
          <path d="M7 20v2"/>
          <path d="M7 2v2"/>
          <rect x="4" y="4" width="16" height="16" rx="2"/>
          <rect x="8" y="8" width="8" height="8" rx="1"/>
        </g>

        {/* Slot 4: Repeat Bot 1 for seamless loop — indigo */}
        <g transform={`translate(${step * 4}, 0)`} stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 8V4H8"/>
          <rect width="16" height="12" x="4" y="8" rx="2"/>
          <path d="M2 14h2"/>
          <path d="M20 14h2"/>
          <path d="M15 13v2"/>
          <path d="M9 13v2"/>
        </g>
      </g>
    </svg>
  )
}
