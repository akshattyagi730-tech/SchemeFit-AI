/**
 * SchemeFit brand mark — a scheme card, a person rising, a green check/forward
 * swoosh. Pure SVG so it stays crisp at any size and reads on both the dark
 * sidebar and white surfaces.
 */
export function BrandMark({ size = 34 }: { size?: number }) {
  const uid = 'sf';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      role="img"
      aria-label="SchemeFit"
      style={{ flex: 'none', display: 'block' }}
    >
      <defs>
        <linearGradient id={`${uid}-card`} x1="6" y1="4" x2="34" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3f93da" />
          <stop offset="1" stopColor="#1c5ea9" />
        </linearGradient>
        <linearGradient id={`${uid}-swoosh`} x1="6" y1="40" x2="38" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2b9e56" />
          <stop offset="1" stopColor="#5ecd8c" />
        </linearGradient>
      </defs>

      {/* forward / upward swoosh */}
      <path
        d="M4 35c9 5.5 17 3.5 24-3 4.8-4.5 8-10.5 10.5-17-1.4 10.2-5 18.2-11 24-6.2 6-14 7.4-23.5 4.2z"
        fill={`url(#${uid}-swoosh)`}
      />

      {/* scheme card */}
      <g transform="rotate(-8 21 17)">
        <rect x="7" y="4" width="29" height="23" rx="6" fill={`url(#${uid}-card)`} />
        <rect x="13" y="10.5" width="16" height="2.6" rx="1.3" fill="#fff" />
        <rect x="13" y="15.5" width="10.5" height="2.6" rx="1.3" fill="#fff" opacity="0.72" />
      </g>

      {/* person / sun */}
      <circle cx="15.5" cy="24" r="5.2" fill="#f5a623" />
    </svg>
  );
}
