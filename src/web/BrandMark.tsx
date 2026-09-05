import { useId } from 'react';
import { brand } from '../brand';
export interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
  monochrome?: boolean;
}
/** One corporation silhouette: monochrome below 64px, material and eyes at larger sizes. */
export function BrandMark({
  size = 32,
  className,
  decorative = false,
  monochrome = size < 64,
}: BrandMarkProps) {
  const clipId = useId();
  const mono = monochrome || size < 64;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : brand.name}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <path fill={mono ? 'currentColor' : brand.accent} d={brand.markPath} />
      {!mono && (
        <>
          <defs>
            <clipPath id={clipId}>
              <path d={brand.markPath} />
            </clipPath>
          </defs>
          <path fill={brand.wood} d="M0 0H64V24H0Z" clipPath={`url(#${clipId})`} />
          <g fill={brand.ink}>
            <ellipse cx="19.5" cy="17" rx="1.7" ry="2" />
            <ellipse cx="37" cy="17" rx="1.7" ry="2" />
          </g>
        </>
      )}
    </svg>
  );
}
