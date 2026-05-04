/** Header / icon-only taps (close X, …, Done, back chevron in modals). */
export const ICON_BUTTON_ACTIVE_OPACITY = 0.7;

export const ICON_BUTTON_HIT_SLOP = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
} as const;

/** Spread onto `Pressable` for instant recognition (POS / charge button pattern). */
export const ICON_BUTTON_QUICK_PRESS = {
  delayPressIn: 0 as const,
  delayHoverIn: 0 as const,
  unstable_pressDelay: 0 as const,
};
