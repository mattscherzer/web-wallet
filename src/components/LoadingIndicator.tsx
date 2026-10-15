import { LOADING_KEY_SPLINES, LOADING_KEY_TIMES, LOADING_SHAPES } from './loadingShapes';

const reducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

/** The design's loading indicator: a navy shape that morphs and turns slowly on a light disc. */
export default function LoadingIndicator({ size = 72 }: { size?: number }) {
  const still = reducedMotion();
  return (
    <svg
      className="loading-indicator"
      role="img"
      aria-label="Loading"
      width={size}
      height={size}
      viewBox="0 0 48 48"
    >
      <circle className="loading-indicator__disc" cx="24" cy="24" r="24" />
      <g>
        <path className="loading-indicator__shape" d={LOADING_SHAPES[0]}>
          {!still && (
            <animate
              attributeName="d"
              dur="5.6s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes={LOADING_KEY_TIMES}
              keySplines={LOADING_KEY_SPLINES}
              values={LOADING_SHAPES.join(';')}
            />
          )}
        </path>
        {!still && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 24 24"
            to="360 24 24"
            dur="4.2s"
            repeatCount="indefinite"
          />
        )}
      </g>
    </svg>
  );
}
