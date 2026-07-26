/**
 * Spinner — a plain circular loader.
 *
 * Uses `currentColor` for the stroke so it inherits the text color
 * of its container.  Placed inside a Button or an EmptyState, it
 * picks up the right color automatically.  Set `color` prop to
 * override.
 *
 * Respects prefers-reduced-motion via the CSS animation class defined
 * on the SVG element (browsers pause the animation).
 *
 * Props:
 *   size    number  diameter in px (default 16)
 *   color   string  optional stroke color, defaults to currentColor
 *   label   string  screen-reader label (default "Loading")
 */
export default function Spinner({ size = 16, color, label = 'Loading' }) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className="inline-block align-middle"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke={color || 'currentColor'}
          strokeWidth="2"
          strokeOpacity="0.2"
        />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke={color || 'currentColor'}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
