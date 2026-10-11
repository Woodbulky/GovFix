/** NMC civic mark (govfix2): town hall in a forest disc with an amber leaf. Decorative; the brand name is text. */
export function CivicMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" aria-hidden className="shrink-0">
      <path
        d="M23 3.5C12.8 3.5 4.5 11.8 4.5 22S12.8 40.5 23 40.5 41.5 32.2 41.5 22 33.2 3.5 23 3.5Z"
        fill="var(--nmc-green)"
      />
      <path
        d="M13 22.5h20M15.5 20l7.5-5.3 7.5 5.3M17 23v7.5M22 23v7.5M27 23v7.5M13.5 31h19"
        stroke="var(--paper)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M25.5 10.5c4.8-3.4 9.1-1.8 9.1-1.8s-.3 5-4.5 7c-2.6 1.2-5-.3-5-.3s-.5-2.7.4-4.9Z"
        fill="var(--marigold)"
      />
      <path d="M25.2 15.3c2-2 4.3-3.5 7.1-4.5" stroke="var(--nmc-green)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
