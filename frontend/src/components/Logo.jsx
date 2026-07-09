// Momentum's mark: a simple bolt — speed, energy, execution. Kept to a single
// path so it stays crisp at favicon size and scales cleanly to any future
// surface (extension icon, app icon, marketing).
export function LogoMark({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <path d="M12.75 2 4 14.5h6.2L9.3 22 20 9.5h-6.2L12.75 2Z" fill="currentColor" />
    </svg>
  )
}

// The mark in its default badge treatment: dark rounded square, signature
// gold bolt. Both colors are fixed hex values, deliberately NOT the
// theme-aware `ink`/`canvas` tokens — bg-ink flips to a light color in dark
// mode, which would invert the mark. A brand mark should read identically
// regardless of which theme the rest of the UI is in (matches favicon.svg).
export function Logo({ size = 32, rounded = 'rounded-[9px]', className = '' }) {
  return (
    <span
      className={`grid shrink-0 place-items-center ${rounded} ${className}`}
      style={{ width: size, height: size, background: '#182420', color: '#F6B93B' }}
    >
      <LogoMark size={Math.round(size * 0.52)} />
    </span>
  )
}
