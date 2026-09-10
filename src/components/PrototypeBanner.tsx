import { Info } from 'lucide-react';
import { useLang } from '../i18n';

/**
 * A slim, always-visible line making the context unambiguous: this is a
 * hackathon prototype, not a government service. Sits above every app shell.
 */
export function PrototypeBanner() {
  const { t } = useLang();
  return (
    <div className="proto-banner" role="note">
      <Info size={13} />
      <span>{t('disc.banner')}</span>
    </div>
  );
}
