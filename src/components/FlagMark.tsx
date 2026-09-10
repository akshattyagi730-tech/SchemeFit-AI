/**
 * A small stylised tricolour with the Ashoka Chakra — a design accent next to
 * the mission line. Not a photographic flag; a clean vector mark.
 */
export function FlagMark({ height = 34 }: { height?: number }) {
  const cx = 33;
  const cy = 22;
  const r = 8.6;
  const spokes = Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    return (
      <line
        key={i}
        x1={cx}
        y1={cy}
        x2={cx + r * Math.cos(a)}
        y2={cy + r * Math.sin(a)}
        stroke="#0a3161"
        strokeWidth={0.7}
      />
    );
  });
  return (
    <svg
      width={(height * 66) / 44}
      height={height}
      viewBox="0 0 66 44"
      role="img"
      aria-label="Tricolour"
      style={{ flex: 'none', display: 'block' }}
    >
      <defs>
        <filter id="fm-sh" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor="#1a2b45" floodOpacity="0.22" />
        </filter>
      </defs>
      <g filter="url(#fm-sh)">
        <rect x="1" y="1" width="64" height="42" rx="4" fill="#fff" />
        <clipPath id="fm-clip">
          <rect x="1" y="1" width="64" height="42" rx="4" />
        </clipPath>
        <g clipPath="url(#fm-clip)">
          <rect x="1" y="1" width="64" height="14" fill="#ff9933" />
          <rect x="1" y="15" width="64" height="14" fill="#ffffff" />
          <rect x="1" y="29" width="64" height="14" fill="#138808" />
        </g>
        <rect x="1" y="1" width="64" height="42" rx="4" fill="none" stroke="#dbe3ec" strokeWidth="1" />
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0a3161" strokeWidth={1.1} />
      <circle cx={cx} cy={cy} r={1.5} fill="#0a3161" />
      {spokes}
    </svg>
  );
}
