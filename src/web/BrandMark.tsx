import { brand } from './identity';
export interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
  monochrome?: boolean;
}
/** A simple V-shaped completion mark, shared with the browser favicon. */
export function BrandMark({
  size = 32,
  className,
  decorative = false,
  monochrome = false,
}: BrandMarkProps) {
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
      <rect
        x="4"
        y="4"
        width="56"
        height="56"
        rx="14"
        fill={monochrome ? 'currentColor' : brand.accent}
      />
      <path
        d="m18 30 10 11 19-21"
        fill="none"
        stroke="#fff"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
