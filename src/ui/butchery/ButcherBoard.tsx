import { useRef, useState } from 'preact/hooks';
import { scoreSwipe, scoreTaps, type BoardPoint } from '@core/loot/cut';
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
  /** Monster colours for the carcass on the board. */
  body: string;
  accent: string;
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

const toPath = (line: readonly BoardPoint[]) =>
  line.map(([x, y], i) => `${i ? 'L' : 'M'}${x * VB} ${y * VB}`).join(' ');

/**
 * Butchery mini-game (GDD §4.4, M3): the carcass on a cutting board with a dashed line per part; swipe along each
 * line in turn (or tap its dots in simplified mode). Scoring is the pure core function; the fight is paused while
 * the board is open. "Skip" gives ★1 for everything.
 */
export function ButcherBoard({ session, t }: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState(0);
  const [cuts, setCuts] = useState<Record<string, Stars>>({});
  const [stroke, setStroke] = useState<BoardPoint[]>([]);
  const started = useRef(0);
  const drawing = useRef(false);
  const part = session.parts[index];

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
    if (index + 1 < session.parts.length) setIndex(index + 1);
    else {
      setIndex(session.parts.length);
      setTimeout(() => session.onDone(next, false), FINISH_MS);
    }
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!part) return;
    const p = toBoard(e);
    if (session.taps) {
      const taps = [...stroke, p];
      if (taps.length >= part.line.length) finishPart(scoreTaps(part.line, taps));
      else setStroke(taps);
      return;
    }
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    started.current = performance.now();
    setStroke([p]);
  };
  const onMove = (e: PointerEvent) => {
    if (!drawing.current || session.taps) return;
    e.preventDefault();
    setStroke((s) => [...s, toBoard(e)]);
  };
  const onUp = (e: PointerEvent) => {
    if (!drawing.current || session.taps || !part) return;
    drawing.current = false;
    const points = [...stroke, toBoard(e)];
    finishPart(scoreSwipe(part.line, points, (performance.now() - started.current) / 1000).stars);
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
        onPointerCancel={() => {
          drawing.current = false;
          setStroke([]);
        }}
      >
        <rect x="3" y="3" width="94" height="94" rx="10" class="board-wood" />
        <ellipse cx="50" cy="52" rx="36" ry="28" fill={session.body} class="carcass" />
        <ellipse cx="42" cy="42" rx="14" ry="9" fill={session.accent} opacity="0.55" />
        <ellipse cx="62" cy="62" rx="10" ry="7" fill={session.accent} opacity="0.4" />
        {session.parts.map((p, i) => (
          <g key={p.partId} class={i < index ? 'cut done' : i === index ? 'cut current' : 'cut later'}>
            <path d={toPath(p.line)} />
            {session.taps &&
              i === index &&
              p.line.map(([x, y], k) => (
                <circle key={k} cx={x * VB} cy={y * VB} r="4" class={k < stroke.length ? 'dot hit' : 'dot'} />
              ))}
            {cuts[p.partId] !== undefined && (
              <text x={(p.line[0]?.[0] ?? 0) * VB} y={(p.line[0]?.[1] ?? 0) * VB - 3} class="cut-stars">
                {stars(cuts[p.partId] as Stars)}
              </text>
            )}
          </g>
        ))}
        {!session.taps && stroke.length > 1 && <path d={toPath(stroke)} class="stroke" />}
      </svg>
      <button
        type="button"
        class="butchery-skip"
        data-testid="butchery-skip"
        onClick={() => session.onDone({}, true)}
      >
        {t('butchery.skip')}
      </button>
    </div>
  );
}
