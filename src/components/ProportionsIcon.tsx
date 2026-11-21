interface Props { size?: number; className?: string; title?: string }

/** The figure-and-measurement icon for "Set proportions": an outlined standing figure with a height bar on its left and a width bar beneath. It takes its colour from the text colour. */
export function ProportionsIcon({ size = 24, className, title }: Props) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d="M7 5h9M11.5 5v45M7 50h9" />
      <circle cx={36} cy={10} r={5.2} />
      <path d="M30.5 19H41.5L50.5 33L46.5 35L42.5 27.5L43.5 40L46.5 52.5H40L36 43L32 52.5H25.5L28.5 40L29.5 27.5L25.5 35L21.5 33Z" />
      <path d="M29 38.2Q36 40.4 43 38.2" />
      <path d="M21 59.5H51M21 56.5v6M51 56.5v6" />
    </svg>
  )
}
