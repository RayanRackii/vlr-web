export function PortalCatalogEmptyIllustration() {
  return (
    <svg className="portal-catalog-illustration" viewBox="0 0 150 110" aria-hidden="true" focusable="false">
      <rect x="20" y="18" width="110" height="80" rx="14" fill="color-mix(in srgb, var(--primary) 10%, var(--card))" stroke="var(--primary)" strokeWidth="2" />
      <path d="M20 40h110" stroke="var(--primary)" strokeWidth="2" />
      <g fill="var(--accent)" opacity=".5">
        <rect x="34" y="52" width="18" height="12" rx="3" />
        <rect x="58" y="52" width="18" height="12" rx="3" />
        <rect x="82" y="52" width="18" height="12" rx="3" />
        <rect x="34" y="72" width="18" height="12" rx="3" />
      </g>
      <circle cx="112" cy="80" r="16" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
      <path d="M106 80h12" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
