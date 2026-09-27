import {
  logoFacePath,
  logoInkPath,
  logoViewBox,
  markFacePath,
  markInkPath,
  markViewBox,
} from './logo-paths';

type LogoProps = {
  className?: string;
  /** Accessible name; omit when a visible or surrounding label already names it. */
  label?: string;
};

function BrandSvg({
  viewBox,
  facePath,
  inkPath,
  className,
  label,
}: LogoProps & { viewBox: string; facePath: string; inkPath: string }) {
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const);
  return (
    <svg
      className={className}
      focusable="false"
      viewBox={viewBox}
      xmlns="http://www.w3.org/2000/svg"
      {...a11y}
    >
      <path className="logo-face" d={facePath} />
      <path className="logo-ink" d={inkPath} />
    </svg>
  );
}

/** Mark and wordmark. Never narrower than 100px; use {@link LogoMark} below that. */
export function Logo({ className, label }: LogoProps) {
  return (
    <BrandSvg
      className={['logo', className].filter(Boolean).join(' ')}
      facePath={logoFacePath}
      inkPath={logoInkPath}
      label={label}
      viewBox={logoViewBox}
    />
  );
}

/** The unicorn alone: compact places, campaign avatars, placeholders. */
export function LogoMark({ className, label }: LogoProps) {
  return (
    <BrandSvg
      className={['logo-mark', className].filter(Boolean).join(' ')}
      facePath={markFacePath}
      inkPath={markInkPath}
      label={label}
      viewBox={markViewBox}
    />
  );
}
