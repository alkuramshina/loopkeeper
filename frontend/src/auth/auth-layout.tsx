import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/brand/logo';
import lakeNight from '../assets/auth/lake-night.png';
import substationAutumn from '../assets/auth/substation-autumn.png';
import bridgeWinter from '../assets/auth/bridge-winter.png';
import radioField from '../assets/auth/radio-field.png';

export const brandVariantKeys = [
  'focus',
  'threads',
  'table',
  'signals',
] as const;
export const brandImageKeys = [
  'lake',
  'substation',
  'bridge',
  'radio',
] as const;

type BrandImageKey = (typeof brandImageKeys)[number];

const brandImages: Record<BrandImageKey, string> = {
  lake: lakeNight,
  substation: substationAutumn,
  bridge: bridgeWinter,
  radio: radioField,
};

// A fresh pick on every page load. The brand panel stays the same when
// switching between the forms because the layout stays mounted.
function pickRandom<T>(keys: readonly T[]): T {
  return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * The frame of the screens before the workspace: sign-in, sign-up and
 * joining a campaign by invitation. The logo and the card on the left, a
 * picture with a line about the product on the right.
 */
export function AuthLayout({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [brandVariant] = useState(() => pickRandom(brandVariantKeys));
  const [brandImage] = useState(() => pickRandom(brandImageKeys));
  const brandCopyPath = `auth.brandVariants.${brandVariant}`;

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-main" aria-labelledby="auth-page-title">
          <Logo className="auth-logo" label={t('appName')} />
          <div className="auth-card">
            <h1 id="auth-page-title">{title}</h1>
            {children}
          </div>
        </section>
        <aside className="auth-brand" aria-label={t('appName')}>
          <img
            alt=""
            className="auth-brand-image"
            data-variant={brandImage}
            src={brandImages[brandImage]}
          />
          <p className="auth-brand-title">{t(`${brandCopyPath}.title`)}</p>
          <p className="auth-brand-body">{t(`${brandCopyPath}.body`)}</p>
        </aside>
      </div>
    </main>
  );
}
