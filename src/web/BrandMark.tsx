import { brand } from './identity';
export interface BrandMarkProps {
  size?: number;
  className?: string;
  decorative?: boolean;
}
/** Canonical CMO corporation-frame asset; shared geometry with the app lockup. */
export function BrandMark({ size = 32, className, decorative = false }: BrandMarkProps) {
  return (
    <img
      src="/vcm-glyph.svg"
      width={size}
      height={size}
      className={className}
      alt={decorative ? '' : brand.name}
      aria-hidden={decorative || undefined}
      draggable={false}
    />
  );
}
