/** Original outlined artwork extracted from the supplied Expande brand manual. */
export function BrandLogo({
  variant = 'color',
  className = '',
  decorative = false,
}: {
  variant?: 'color' | 'white' | 'black';
  className?: string;
  decorative?: boolean;
}) {
  return (
    <img
      className={`brand-logo ${className}`.trim()}
      src={`/brands/expande/logo-${variant}.svg`}
      alt={decorative ? '' : 'Expande, somos FCh'}
      width={309}
      height={90}
      decoding="async"
    />
  );
}
