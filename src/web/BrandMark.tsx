import { brand } from '../brand';
export interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
  monochrome?: boolean;
}
/** The same native company tower and open work floors at every size. */
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
      <path fill={monochrome ? 'currentColor' : brand.accent} d={brand.markPath} />
    </svg>
  );
}
