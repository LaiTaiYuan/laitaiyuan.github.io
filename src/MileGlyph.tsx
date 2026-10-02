import { HEAD, REST, noteGlyph } from "./mileRoad";

// The same notes and rests the road draws, as SVG for the chapter cards and
// the static layout.
export function MileGlyph({
  songs,
  className,
}: {
  songs: number;
  className?: string;
}) {
  const kind = songs ? "is-notes" : "is-rest";
  if (!songs)
    return (
      <svg
        className={`mile-glyph ${kind} ${className ?? ""}`}
        viewBox="-1.2 -3.1 2.4 3.2"
        aria-hidden="true"
        focusable="false"
      >
        <path d={REST} />
      </svg>
    );
  const { heads, body } = noteGlyph(songs);
  const half = Math.max(1.2, (songs - 1) * 0.41 + 0.9);
  return (
    <svg
      className={`mile-glyph ${kind} ${className ?? ""}`}
      viewBox={`${-half - 0.1} -2.85 ${half * 2 + 0.4} 3.2`}
      aria-hidden="true"
      focusable="false"
    >
      <path d={body} />
      {heads.map((head) => (
        <ellipse
          key={head.x}
          cx={head.x}
          cy={head.y}
          rx={HEAD.rx}
          ry={HEAD.ry}
          transform={`rotate(${HEAD.tilt} ${head.x} ${head.y})`}
        />
      ))}
    </svg>
  );
}
