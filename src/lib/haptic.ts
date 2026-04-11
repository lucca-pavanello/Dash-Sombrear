type HapticPattern = 'light' | 'medium' | 'success' | 'warning'

const PATTERNS: Record<HapticPattern, number | number[]> = {
  light:   5,
  medium:  10,
  success: 12,
  warning: [8, 40, 8],
}

export function haptic(pattern: HapticPattern = 'light') {
  try { navigator.vibrate?.(PATTERNS[pattern]) } catch { /* noop */ }
}
