// =============================================================================
// SHARED PANEL SURFACE TOKENS
// =============================================================================
// One source of truth for the floating panels (node palette, activity, assets,
// credits, workflow sidebar) and the bottom toolbar.
//
// Surfaces are OPAQUE by design: the canvas sits behind these panels, and
// translucent backgrounds made node graphs bleed through the content. Use a
// solid background plus a border and shadow to establish depth instead.
// =============================================================================

/** Outer shell of a floating panel. Opaque, bordered, rounded. */
export const panelSurface =
  "bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl shadow-lg shadow-gray-300/40 dark:shadow-black/50";

/** Panel header / footer strip - one step off the panel background. */
export const panelHeader =
  "bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/10";

/** A raised element inside a panel (cards, list rows, inputs). */
export const panelInset =
  "bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-lg";

/** Hover state for interactive rows inside a panel. */
export const panelRowHover =
  "hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors";

/** Icon button sitting on a panel surface. */
export const panelIconButton =
  "p-1.5 rounded-lg text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors";

/** Text scale shared across panels. */
export const panelTitle = "text-sm font-semibold text-slate-900 dark:text-white";
export const panelLabel = "text-xs font-medium text-slate-700 dark:text-zinc-300";
export const panelMuted = "text-xs text-slate-500 dark:text-zinc-500";

/** Modal backdrop. Dim only - no blur. */
export const modalBackdrop = "fixed inset-0 bg-black/50 z-50";
