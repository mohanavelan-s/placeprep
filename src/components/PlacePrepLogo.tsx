interface PlacePrepLogoProps {
  className?: string;
  compact?: boolean;
}

export default function PlacePrepLogo({ className = "", compact = false }: PlacePrepLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className="h-10 w-10 shrink-0"
        role="img"
        aria-label="PlacePrep logo"
      >
        <defs>
          <linearGradient id="placeprep-mark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(0 62% 48%)" />
            <stop offset="100%" stopColor="hsl(38 45% 52%)" />
          </linearGradient>
        </defs>
        <rect x="5" y="5" width="54" height="54" rx="18" fill="hsl(240 14% 8%)" stroke="hsl(0 55% 33% / 0.55)" />
        <path
          d="M20 46V18h16.5c7 0 11.5 3.8 11.5 10.1 0 6.5-4.7 10.5-12 10.5H28.5V46H20Z"
          fill="url(#placeprep-mark)"
        />
        <path
          d="M28.5 32.1h7.1c3.2 0 4.9-1.5 4.9-4 0-2.6-1.7-4-4.9-4h-7.1v8Z"
          fill="hsl(240 14% 8%)"
          opacity="0.75"
        />
      </svg>

      {!compact && (
        <div>
          <p className="font-heading text-2xl leading-none text-foreground">PlacePrep</p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Focus. Discipline. Growth.
          </p>
        </div>
      )}
    </div>
  );
}
