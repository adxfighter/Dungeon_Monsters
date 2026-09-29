import { useEffect, useRef, useState } from 'preact/hooks';
import type { MonsterDef } from '@content/schemas';
import { scoreSwipe, tapStart, tapStep, type BoardPoint, type TapProgress } from '@core/loot/cut';
import type { Stars } from '@core/loot/quality';
import './butchery.css';

export interface ButcheryPart {
  partId: string;
  /** Display name (already translated). */
  name: string;
  line: readonly BoardPoint[];
}

export interface ButcherySession {
  parts: readonly ButcheryPart[];
  /** Monster colours and body type for the carcass on the board. */
  body: string;
  accent: string;
  shape: MonsterDef['appearance']['carcass'];
  /** Simplified (accessibility) mode: tap the dots instead of swiping. */
  taps: boolean;
  onDone(cuts: Record<string, Stars>, skipped: boolean): void;
}

interface Props {
  session: ButcherySession;
  t(key: string): string;
}

/** Board size in SVG units (points are 0..1 on the board). */
const VB = 100;
/** Pause after the last cut so the player sees the stars, ms. */
const FINISH_MS = 450;
/** A missed tap flashes for this long, ms. */
const MISS_MS = 300;

const toPath = (line: readonly BoardPoint[]) =>
  line.map(([x, y], i) => `${i ? 'L' : 'M'}${x * VB} ${y * VB}`).join(' ');

/** Simple carcass silhouettes by body type (fill = monster colour); coordinates in board units. */
function Carcass({ shape, body, accent }: { shape: ButcherySession['shape']; body: string; accent: string }) {
  const outline = { stroke: '#1a1414', 'stroke-width': 1.2 } as const;
  switch (shape) {
    case 'eel':
      return (
        <g>
          <path d="M12 50 Q30 34 50 48 T88 46 Q90 52 86 56 Q66 62 50 56 T14 58 Z" fill={body} {...outline} />
          <circle cx="84" cy="49" r="2" fill="#1a1414" />
          <path d="M40 44 Q50 38 60 44" fill="none" stroke={accent} stroke-width="3" />
        </g>
      );
    case 'bug':
      return (
        <g>
          {[30, 50, 70].map((x) => (
            <path
              key={x}
              d={`M${x} 40 L${x - 8} 26 M${x} 64 L${x - 8} 78`}
              stroke="#1a1414"
              stroke-width="2.4"
            />
          ))}
          <ellipse cx="50" cy="52" rx="34" ry="20" fill={body} {...outline} />
          <line x1="50" y1="32" x2="50" y2="72" stroke={accent} stroke-width="1.5" />
          <circle cx="86" cy="52" r="8" fill={body} {...outline} />
        </g>
      );
    case 'octopus':
      return (
        <g>
          {[18, 30, 42, 54, 66, 78].map((x) => (
            <path
              key={x}
              d={`M${x + 4} 60 Q${x} 80 ${x + 6} 88`}
              fill="none"
              stroke={body}
              stroke-width="6"
              stroke-linecap="round"
            />
          ))}
          <ellipse cx="50" cy="44" rx="30" ry="24" fill={body} {...outline} />
          <circle cx="40" cy="36" r="4" fill={accent} opacity="0.7" />
          <circle cx="60" cy="40" r="3" fill={accent} opacity="0.7" />
        </g>
      );
    case 'biped':
      return (
        <g>
          <path d="M70 52 L94 44 L92 50 L72 58 Z" fill={body} {...outline} />
          <path d="M30 48 Q18 30 14 18 L22 16 Q28 30 38 44 Z" fill={body} {...outline} />
          <ellipse cx="14" cy="16" rx="8" ry="5" fill={body} {...outline} />
          <path d="M44 62 L40 84 M58 62 L62 84" stroke="#1a1414" stroke-width="4" stroke-linecap="round" />
          <ellipse cx="52" cy="52" rx="24" ry="14" fill={body} {...outline} />
          <path d="M40 44 L64 44" stroke={accent} stroke-width="2.5" />
        </g>
      );
    case 'quadruped':
      return (
        <g>
          {[30, 40, 60, 70].map((x) => (
            <line
              key={x}
              x1={x}
              y1="60"
              x2={x}
              y2="80"
              stroke="#1a1414"
              stroke-width="5"
              stroke-linecap="round"
            />
          ))}
          <ellipse cx="50" cy="52" rx="32" ry="17" fill={body} {...outline} />
          <circle cx="84" cy="44" r="10" fill={body} {...outline} />
          <ellipse cx="46" cy="44" rx="16" ry="6" fill={accent} opacity="0.5" />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx="50" cy="52" rx="34" ry="28" fill={body} {...outline} />
          <ellipse cx="42" cy="42" rx="14" ry="9" fill={accent} opacity="0.55" />
          <ellipse cx="62" cy="62" rx="10" ry="7" fill={accent} opacity="0.4" />
        </g>
      );
  }
}

/**
 * Butchery mini-game (GDD §4.4, M3): the carcass on a cutting board with a dashed line per part; swipe along each
 * line in turn (or tap its dots in simplified mode). Scoring is the pure core functions; the fight is paused while
 * the board is open. "Skip" gives ★1 for everything. The result is reported exactly once.
 */
export function ButcherBoard({ session, t }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState(0);
  const [cuts, setCuts] = useState<Record<string, Stars>>({});
  const [stroke, setStroke] = useState<BoardPoint[]>([]);
  const [taps, setTaps] = useState<TapProgress>(tapStart());
  const [miss, setMiss] = useState<BoardPoint | null>(null);
  const started = useRef(0);
  /** The finger that draws the current stroke (others are ignored until it lifts). */
  const pointer = useRef<number | null>(null);
  const reported = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const part = session.parts[index];
  const finished = index >= session.parts.length;

  useEffect(
    () => () => {
      for (const id of timers.current) clearTimeout(id);
    },
    [],
  );

  const report = (result: Record<string, Stars>, skipped: boolean) => {
    if (reported.current) return;
    reported.current = true;
    session.onDone(result, skipped);
  };

  const toBoard = (e: PointerEvent): BoardPoint => {
    const r = svg.current?.getBoundingClientRect();
    if (!r || r.width === 0) return [0, 0];
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  const finishPart = (stars: Stars) => {
    if (!part) return;
    const next = { ...cuts, [part.partId]: stars };
    setCuts(next);
    setStroke([]);
    setTaps(tapStart());
    setIndex(index + 1);
    if (index + 1 >= session.parts.length)
      timers.current.push(setTimeout(() => report(next, false), FINISH_MS));
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!part || pointer.current !== null) return;
    const p = toBoard(e);
    if (session.taps) {
      const progress = tapStep(part.line, taps, p);
      if (progress.misses > taps.misses) {
        setMiss(p);
        timers.current.push(setTimeout(() => setMiss(null), MISS_MS));
      }
      if (progress.done) finishPart(progress.stars);
      else setTaps(progress);
      return;
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pointer.current = e.pointerId;
    started.current = performance.now();
    setStroke([p]);
  };
  const onMove = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId || session.taps) return;
    e.preventDefault();
    setStroke((s) => [...s, toBoard(e)]);
  };
  const onUp = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId || session.taps || !part) return;
    pointer.current = null;
    const points = [...stroke, toBoard(e)];
    finishPart(scoreSwipe(part.line, points, (performance.now() - started.current) / 1000).stars);
  };
  const onCancel = (e: PointerEvent) => {
    if (pointer.current !== e.pointerId) return;
    pointer.current = null;
    setStroke([]);
  };

  const stars = (s: Stars) => '★'.repeat(s) + '☆'.repeat(3 - s);

  return (
    <div class="butchery" role="dialog" aria-label={t('butchery.title')} data-testid="butchery">
      <div class="butchery-head">
        <h2>{t('butchery.title')}</h2>
        <p data-testid="butchery-prompt">
          {part
            ? `${session.taps ? t('butchery.tapHint') : t('butchery.swipeHint')}: ${part.name}`
            : t('butchery.done')}
        </p>
      </div>
      <svg
        ref={svg}
        class="butchery-board"
        viewBox={`0 0 ${VB} ${VB}`}
        data-testid="butchery-board"
        data-line={part ? JSON.stringify(part.line) : ''}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
      >
        <rect x="3" y="3" width="94" height="94" rx="10" class="board-wood" />
        <Carcass shape={session.shape} body={session.body} accent={session.accent} />
        {session.parts.map((p, i) => (
          <g key={p.partId} class={i < index ? 'cut done' : i === index ? 'cut current' : 'cut later'}>
            <path d={toPath(p.line)} />
            {session.taps &&
              i === index &&
              p.line.map(([x, y], k) => (
                <circle key={k} cx={x * VB} cy={y * VB} r="4" class={k < taps.next ? 'dot hit' : 'dot'} />
              ))}
            {cuts[p.partId] !== undefined && (
              <text x={(p.line[0]?.[0] ?? 0) * VB} y={(p.line[0]?.[1] ?? 0) * VB - 3} class="cut-stars">
                {stars(cuts[p.partId] as Stars)}
              </text>
            )}
          </g>
        ))}
        {miss && (
          <circle cx={miss[0] * VB} cy={miss[1] * VB} r="3.5" class="dot miss" data-testid="butchery-miss" />
        )}
        {!session.taps && stroke.length > 1 && <path d={toPath(stroke)} class="stroke" />}
      </svg>
      {!finished && (
        <button
          type="button"
          class="butchery-skip"
          data-testid="butchery-skip"
          onClick={() => report({}, true)}
        >
          {t('butchery.skip')}
        </button>
      )}
    </div>
  );
}
