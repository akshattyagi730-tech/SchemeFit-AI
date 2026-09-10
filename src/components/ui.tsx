import React from 'react';
import { ArrowRight, Check, AlertTriangle, Loader2, Sparkles, ShieldAlert, Inbox } from 'lucide-react';
import { ApiError } from '../api/client';
import { useLang } from '../i18n';
import { BrandMark } from './BrandMark';

export function Logo() {
  return (
    <div className="logo">
      <BrandMark size={34} />
      <span>
        Scheme<b>Fit</b>
        <small>Find schemes that fit you</small>
      </span>
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  type = 'button',
  disabled,
  loading,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'outline' | 'soft';
  className?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <button className={`button ${variant} ${className}`} onClick={onClick} type={type} disabled={disabled || loading}>
      {children}
      {loading ? <Loader2 size={18} className="spin" /> : <ArrowRight size={18} />}
    </button>
  );
}

export function ScoreRing({ score, label, className = '' }: { score: number; label?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div className={`score-ring ${className}`} style={{ '--score': `${pct * 3.6}deg` } as React.CSSProperties}>
      <div>
        <strong>
          {Math.round(score)}
          {label ? <small>{label}</small> : '%'}
        </strong>
        {label && (
          <em>
            Application
            <br />
            Readiness
          </em>
        )}
      </div>
    </div>
  );
}

const PILL_MAP: Record<string, 'verified' | 'missing' | 'pending'> = {
  Verified: 'verified',
  Eligible: 'verified',
  verified: 'verified',
  Missing: 'missing',
  missing: 'missing',
  'Changes requested': 'missing',
  changes_requested: 'missing',
};

export function StatusPill({ status }: { status: string }) {
  const type = PILL_MAP[status] ?? 'pending';
  return (
    <span className={`status ${type}`}>
      {type === 'verified' ? <Check size={13} /> : type === 'missing' ? <AlertTriangle size={13} /> : <span className="ring" />}
      {status}
    </span>
  );
}

export function PageTitle({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="page-title">
      <div>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </section>
  );
}

export function Loading({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="state-block" role="status">
      <Loader2 className="spin" size={26} />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useLang();
  const api = error instanceof ApiError ? error : null;
  const forbidden = api?.isForbidden;
  const expired = api?.isAuth;
  return (
    <div className="state-block error" role="alert">
      {forbidden ? <ShieldAlert size={26} /> : <AlertTriangle size={26} />}
      <b>{expired ? t('common.sessionExpired') : forbidden ? t('common.noAccess') : t('common.somethingWrong')}</b>
      <span>{api?.message ?? '—'}</span>
      {api?.requestId && (
        <small>
          {t('common.reference')}: {api.requestId}
        </small>
      )}
      {expired ? (
        <button className="button outline" onClick={() => location.reload()}>
          {t('common.signInAgain')} <ArrowRight size={16} />
        </button>
      ) : (
        onRetry && (
          <button className="button outline" onClick={onRetry}>
            {t('common.retry')} <ArrowRight size={16} />
          </button>
        )
      )}
    </div>
  );
}

export function EmptyState({ title, hint, icon }: { title: string; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="state-block">
      {icon ?? <Inbox size={26} />}
      <b>{title}</b>
      {hint && <span>{hint}</span>}
    </div>
  );
}

export function DemoBadge({ children }: { children?: React.ReactNode }) {
  const { t } = useLang();
  return (
    <span className="demo-badge" title={t('disc.short')}>
      <Sparkles size={12} /> {children ?? t('common.demoData')}
    </span>
  );
}
