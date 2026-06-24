import { BaseEdge, type EdgeProps } from '@xyflow/react';

// Build a rounded orthogonal path through the given points.
function roundedPath(
  pts: { x: number; y: number }[],
  r: number,
): string {
  // Drop consecutive duplicates so corner maths doesn't divide by zero.
  const p: { x: number; y: number }[] = [];
  for (const pt of pts) {
    const last = p[p.length - 1];
    if (!last || Math.abs(last.x - pt.x) > 0.5 || Math.abs(last.y - pt.y) > 0.5) {
      p.push(pt);
    }
  }
  if (p.length < 2) return '';
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 1; i < p.length - 1; i++) {
    const prev = p[i - 1];
    const cur = p[i];
    const next = p[i + 1];
    const dIn = Math.hypot(cur.x - prev.x, cur.y - prev.y);
    const dOut = Math.hypot(next.x - cur.x, next.y - cur.y);
    const rr = Math.min(r, dIn / 2, dOut / 2);
    const inX = cur.x + ((prev.x - cur.x) / dIn) * rr;
    const inY = cur.y + ((prev.y - cur.y) / dIn) * rr;
    const outX = cur.x + ((next.x - cur.x) / dOut) * rr;
    const outY = cur.y + ((next.y - cur.y) / dOut) * rr;
    d += ` L ${inX} ${inY} Q ${cur.x} ${cur.y} ${outX} ${outY}`;
  }
  const last = p[p.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

const STUB = 18;

// Orthogonal cross-phase connector. Both directions exit the source
// downward, jog out to a side gutter (clear of all task nodes), run
// vertically down the gutter, then jog back in to the target's top — so
// the dashed line never cuts straight through the process steps the way a
// default bezier did. The gutter x is supplied per-edge via data.
export function CrossPhaseEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  data,
}: EdgeProps) {
  const gutterX =
    typeof data?.gutterX === 'number'
      ? (data.gutterX as number)
      : sourceX < targetX
        ? sourceX - 40
        : sourceX + 40;

  const pts = [
    { x: sourceX, y: sourceY },
    { x: sourceX, y: sourceY + STUB },
    { x: gutterX, y: sourceY + STUB },
    { x: gutterX, y: targetY - STUB },
    { x: targetX, y: targetY - STUB },
    { x: targetX, y: targetY },
  ];

  return (
    <BaseEdge path={roundedPath(pts, 8)} markerEnd={markerEnd} style={style} />
  );
}
