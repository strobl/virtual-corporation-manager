export interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
  monochrome?: boolean;
}

/** Flash's compact silhouette. Small sizes omit the mouth and use larger, simpler eyes. */
export function BrandMark({
  size = 32,
  className,
  decorative = false,
  monochrome = false,
}: BrandMarkProps) {
  const small = size <= 20;
  const amber = monochrome ? 'currentColor' : '#F4A340';
  const wood = monochrome ? 'currentColor' : '#C9A576';
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : 'GitFlash'}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <path
        fill={wood}
        d="M6.5 19.5 2.6 24.7C1.5 26.2 2.3 28 3.8 28c.8 0 1.3-.4 1.9-1.1L9 23Zm19 0 3.9 5.2c1.1 1.5.3 3.3-1.2 3.3-.8 0-1.3-.4-1.9-1.1L23 23ZM8 27h6v3a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Zm10 0h6v3a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2Z"
      />
      <path
        fill={amber}
        d="M18.8.9c.7-.7 1.8-.1 1.4.9L18.3 6h3.2c.9 0 1.3 1 .7 1.7L17.7 13h-4.4l2.2-4h-3.3c-.9 0-1.4-1-.8-1.7Z"
      />
      <path
        fill={amber}
        d="M10.5 11h11c3.7 0 5.5 2.8 5.5 6.5V24c0 3.5-2 5.5-5.5 5.5h-11C7 29.5 5 27.5 5 24v-6.5C5 13.8 6.8 11 10.5 11Z"
      />
      {!monochrome && (
        <>
          <rect x="8" y="14" width="16" height="10" rx="4" fill="#F6DDB5" />
          <g fill="#202824">
            <ellipse cx="12" cy="18.5" rx={small ? 1.25 : 1.1} ry="1.4" />
            <ellipse cx="20" cy="18.5" rx={small ? 1.25 : 1.1} ry="1.4" />
          </g>
          {!small && (
            <path
              d="M14.5 21c.9.8 2.1.8 3 0"
              fill="none"
              stroke="#202824"
              strokeWidth="1"
              strokeLinecap="round"
            />
          )}
        </>
      )}
    </svg>
  );
}
