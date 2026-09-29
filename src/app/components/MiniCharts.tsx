import { useId, useState } from "react";

export interface SeriesPoint {
  label: string;
  occupancy: number;
  revenue: number;
}

const INK = "#171717";

// Biểu đồ vùng (area) tự vẽ bằng SVG — dùng cho công suất theo %.
export function AreaChartSVG({ data, formatValue, unit = "", color = "#8a6d33" }: {
  data: SeriesPoint[];
  formatValue?: (v: number) => string;
  unit?: string;
  color?: string;
}) {
  const id = "area" + useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const w = 560, h = 240, padL = 36, padR = 12, padT = 12, padB = 26;
  const iw = w - padL - padR, ih = h - padT - padB;
  const max = 100, min = 0;
  const n = data.length;
  const x = (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => padT + ih - ((v - min) / (max - min)) * ih;

  const pts = data.map((d, i) => [x(i), y(d.occupancy)] as const);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${padL},${padT + ih} ${line} ${padL + iw},${padT + ih}`;
  const ticks = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={y(t)} x2={padL + iw} y2={y(t)} stroke="#e4e4e7" strokeWidth={1} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="#a1a1aa">{t}{unit}</text>
        </g>
      ))}

      <polygon points={area} fill={`url(#${id})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {data.map((d, i) => i % 2 === 0 && (
        <text key={d.label} x={x(i)} y={h - 8} textAnchor="middle" fontSize={10} fill="#a1a1aa">{d.label}</text>
      ))}

      {/* Vùng bắt sự kiện hover */}
      {data.map((d, i) => (
        <rect key={i} x={x(i) - iw / (2 * n)} y={padT} width={iw / n} height={ih} fill="transparent"
          onMouseEnter={() => setHover(i)} />
      ))}

      {hover !== null && (
        <g>
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + ih} stroke={color} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(data[hover].occupancy)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
          <Tooltip x={x(hover)} y={y(data[hover].occupancy)} w={w} title={data[hover].label}
            value={formatValue ? formatValue(data[hover].occupancy) : `${data[hover].occupancy}${unit}`} />
        </g>
      )}
    </svg>
  );
}

// Biểu đồ cột tự vẽ — dùng cho doanh thu.
export function BarChartSVG({ data, formatValue, color = "#059669" }: {
  data: SeriesPoint[];
  formatValue: (v: number) => string;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 320, h = 240, padL = 8, padR = 8, padT = 12, padB = 26;
  const iw = w - padL - padR, ih = h - padT - padB;
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const n = data.length;
  const slot = iw / n;
  const bw = Math.min(18, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" onMouseLeave={() => setHover(null)}>
      <line x1={padL} y1={padT + ih} x2={padL + iw} y2={padT + ih} stroke="#e4e4e7" strokeWidth={1} />
      {data.map((d, i) => {
        const bh = (d.revenue / max) * ih;
        const bx = padL + i * slot + (slot - bw) / 2;
        const by = padT + ih - bh;
        return (
          <g key={d.label} onMouseEnter={() => setHover(i)}>
            <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill="transparent" />
            <rect x={bx} y={by} width={bw} height={bh} rx={3}
              fill={color} fillOpacity={hover === null || hover === i ? 1 : 0.45} className="transition-all" />
            {i % 3 === 0 && <text x={bx + bw / 2} y={h - 8} textAnchor="middle" fontSize={10} fill="#a1a1aa">{d.label}</text>}
          </g>
        );
      })}
      {hover !== null && (
        <Tooltip x={padL + hover * slot + slot / 2} y={padT + ih - (data[hover].revenue / max) * ih} w={w}
          title={data[hover].label} value={formatValue(data[hover].revenue)} />
      )}
    </svg>
  );
}

function Tooltip({ x, y, w, title, value }: { x: number; y: number; w: number; title: string; value: string }) {
  const bw = Math.max(64, value.length * 7 + 20);
  const bx = Math.min(Math.max(x - bw / 2, 2), w - bw - 2);
  const by = Math.max(y - 44, 2);
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={bw} height={34} rx={6} fill={INK} />
      <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize={9} fill="#a1a1aa">{title}</text>
      <text x={bx + bw / 2} y={by + 27} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600}>{value}</text>
    </g>
  );
}

/* ===========================================================================
 * BIỂU ĐỒ KẾT HỢP (COMBO)
 * Cột = doanh thu (trục phải), đường = công suất (trục trái).
 * Đây là cách các PMS lớn trình bày: nhìn một lần thấy được cả hai câu
 * chuyện — bán được bao nhiêu phòng và thu được bao nhiêu tiền.
 * =========================================================================*/
export function ComboChartSVG({ data, formatRevenue, compactRevenue, occColor = "#8a6d33", revColor = "#1c1917" }: {
  data: SeriesPoint[];
  formatRevenue: (v: number) => string;
  compactRevenue?: (v: number) => string;
  occColor?: string;
  revColor?: string;
}) {
  const id = "combo" + useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const w = 720, h = 264, padL = 34, padR = 50, padT = 14, padB = 26;
  const iw = w - padL - padR, ih = h - padT - padB;
  const n = Math.max(data.length, 1);
  const maxRev = Math.max(1, ...data.map((d) => d.revenue));
  const slot = iw / n;
  const bw = Math.min(22, slot * 0.5);
  const x = (i: number) => padL + slot * i + slot / 2;
  const yOcc = (v: number) => padT + ih - (v / 100) * ih;
  const yRev = (v: number) => padT + ih - (v / maxRev) * ih;
  const line = data.map((d, i) => `${x(i).toFixed(1)},${yOcc(d.occupancy).toFixed(1)}`).join(" ");
  const area = `${x(0).toFixed(1)},${padT + ih} ${line} ${x(n - 1).toFixed(1)},${padT + ih}`;
  const compact = compactRevenue ?? formatRevenue;
  const every = Math.ceil(n / 8);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={occColor} stopOpacity={0.2} />
          <stop offset="100%" stopColor={occColor} stopOpacity={0} />
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map((t) => (
        <g key={t}>
          <line x1={padL} y1={yOcc(t)} x2={padL + iw} y2={yOcc(t)} stroke="#eeeef1" strokeWidth={1} />
          <text x={padL - 6} y={yOcc(t) + 3} textAnchor="end" fontSize={10} fill="#a1a1aa">{t}%</text>
        </g>
      ))}

      {[0, 0.5, 1].map((p) => (
        <text key={p} x={padL + iw + 8} y={yRev(maxRev * p) + 3} fontSize={10} fill="#a1a1aa">
          {compact(Math.round(maxRev * p))}
        </text>
      ))}

      {data.map((d, i) => {
        const bh = Math.max((d.revenue / maxRev) * ih, 0);
        return (
          <g key={`bar-${d.label}-${i}`} onMouseEnter={() => setHover(i)}>
            <rect x={padL + i * slot} y={padT} width={slot} height={ih} fill="transparent" />
            <rect x={x(i) - bw / 2} y={padT + ih - bh} width={bw} height={bh} rx={3}
              fill={revColor} fillOpacity={hover === null || hover === i ? 0.85 : 0.32} className="transition-all" />
          </g>
        );
      })}

      <polygon points={area} fill={`url(#${id})`} pointerEvents="none" />
      <polyline points={line} fill="none" stroke={occColor} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />

      {data.map((d, i) => (i % every === 0 ? (
        <text key={`lb-${d.label}-${i}`} x={x(i)} y={h - 8} textAnchor="middle" fontSize={10} fill="#a1a1aa">{d.label}</text>
      ) : null))}

      {hover !== null && data[hover] && (
        <g pointerEvents="none">
          <line x1={x(hover)} y1={padT} x2={x(hover)} y2={padT + ih} stroke={occColor} strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={yOcc(data[hover].occupancy)} r={4} fill={occColor} stroke="#fff" strokeWidth={2} />
          <MultiTooltip x={x(hover)} y={yOcc(data[hover].occupancy)} w={w} title={data[hover].label}
            lines={[`Công suất ${data[hover].occupancy}%`, formatRevenue(data[hover].revenue)]} />
        </g>
      )}
    </svg>
  );
}

function MultiTooltip({ x, y, w, title, lines }: { x: number; y: number; w: number; title: string; lines: string[] }) {
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const bw = Math.max(104, longest * 6.6 + 22);
  const bh = 22 + lines.length * 14;
  const bx = Math.min(Math.max(x - bw / 2, 2), w - bw - 2);
  const by = Math.max(y - bh - 10, 2);
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={bw} height={bh} rx={6} fill={INK} />
      <text x={bx + bw / 2} y={by + 14} textAnchor="middle" fontSize={9} fill="#a1a1aa">{title}</text>
      {lines.map((l, i) => (
        <text key={l} x={bx + bw / 2} y={by + 29 + i * 13} textAnchor="middle" fontSize={11} fill="#fff" fontWeight={600}>{l}</text>
      ))}
    </g>
  );
}

/* ===========================================================================
 * BIỂU ĐỒ VÒNG (DONUT) — dùng cho cơ cấu trạng thái phòng.
 * =========================================================================*/
export function DonutSVG({ segments, centerValue, centerLabel }: {
  segments: Array<{ label: string; value: number; color: string }>;
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;

  return (
    <svg viewBox="0 0 140 140" className="w-full h-full">
      <g transform="translate(70,70) rotate(-90)">
        <circle r={R} fill="none" stroke="#f1f1f4" strokeWidth={16} />
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const node = (
            <circle key={s.label} r={R} fill="none" stroke={s.color} strokeWidth={16}
              strokeDasharray={`${len.toFixed(2)} ${(C - len).toFixed(2)}`} strokeDashoffset={-acc} />
          );
          acc += len;
          return node;
        })}
      </g>
      <text x={70} y={68} textAnchor="middle" fontSize={24} fontWeight={600} fill={INK}>{centerValue}</text>
      <text x={70} y={86} textAnchor="middle" fontSize={10} fill="#a1a1aa">{centerLabel}</text>
    </svg>
  );
}
