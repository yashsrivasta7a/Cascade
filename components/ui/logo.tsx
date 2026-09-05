/**
 * Cascade mark — two blocks stepping down in isometric: terraced falls, and the
 * shape of a pipeline handing its output to the next stage. Drawn on a 32-unit
 * grid; the three face tones are one ink at three opacities, so the mark needs
 * no second colour to read as solid.
 *
 * Inline (not <img src="/logo.svg">) so it inherits the app's class-based theme
 * through currentColor; public/logo.svg carries its own prefers-color-scheme
 * ink for README, docs and the touch icon.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" role="img" aria-label="Cascade" className={className}>
      <g fill="currentColor">
        <polygon points="4.3,8.9 11.5,4.75 18.7,8.9 11.5,13.05" />
        <polygon points="4.3,8.9 11.5,13.05 11.5,19.05 4.3,14.9" opacity="0.34" />
        <polygon points="11.5,13.05 18.7,8.9 18.7,14.9 11.5,19.05" opacity="0.62" />
        <polygon points="13.3,17.4 20.5,13.25 27.7,17.4 20.5,21.55" />
        <polygon points="13.3,17.4 20.5,21.55 20.5,27.55 13.3,23.4" opacity="0.34" />
        <polygon points="20.5,21.55 27.7,17.4 27.7,23.4 20.5,27.55" opacity="0.62" />
      </g>
    </svg>
  );
}
