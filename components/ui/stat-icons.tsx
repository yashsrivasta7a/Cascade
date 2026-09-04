/**
 * Dashboard stat icons.
 *
 * Drawn rather than pulled from lucide so the four read as one set: each is a
 * single idea on a 24-unit grid, and each carries exactly one accent element
 * (the connector, the speed lines, the needle, the swept arc). They keep
 * lucide's metrics — 24x24 box, 2-unit stroke, round caps, ~2 units of padding
 * — so they sit correctly beside the lucide icons used elsewhere on the page.
 */

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Workflows — two nodes wired by an elbow: the smallest possible pipeline. */
export function WorkflowsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="2" />
      <rect x="14" y="14" width="7" height="7" rx="2" />
      <path d="M10 6.5 H15 A2.5 2.5 0 0 1 17.5 9 V14" />
    </svg>
  );
}

/** Executions — a play head with motion trailing behind it. */
export function ExecutionsIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.5 4.5 L19 12 L9.5 19.5 Z" />
      <path d="M3 8 H6" />
      <path d="M3 12 H6.5" />
      <path d="M3 16 H6" />
    </svg>
  );
}

/** Avg runtime — a gauge rather than a clock face: this measures speed, not time of day. */
export function RuntimeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.21 16.5 A9 9 0 1 1 19.79 16.5" />
      <path d="M12 12 L15.44 7.09" />
      <circle cx="12" cy="12" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Success rate — a swept arc with its leading head. The gap has to stay wide:
 *  at 16px a near-closed ring is indistinguishable from a plain circle. */
export function SuccessIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3 A9 9 0 1 1 3.54 15.08" />
      <circle cx="3.54" cy="15.08" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
