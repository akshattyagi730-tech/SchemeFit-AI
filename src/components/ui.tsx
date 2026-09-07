import React from 'react';
import { ArrowRight, Check, AlertTriangle, Loader2, Sparkles, ShieldAlert, Inbox } from 'lucide-react';
import { ApiError } from '../api/client';

export function Logo() {
  return (
    <div className="logo">
      <span className="sprout">♧</span>
      <span>
        SchemeFit <b>AI</b>
        <small>Opportunities for Every Entrepreneur</small>
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

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state-block" role="status">
      <Loader2 className="spin" size={26} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const api = error instanceof ApiError ? error : null;
  const forbidden = api?.isForbidden;
  const expired = api?.isAuth;
  return (
    <div className="state-block error" role="alert">
      {forbidden ? <ShieldAlert size={26} /> : <AlertTriangle size={26} />}
      <b>
        {expired
          ? 'Your session has expired'
          : forbidden
            ? 'You do not have access to this'
            : 'Something went wrong'}
      </b>
      <span>{api?.message ?? 'Please try again in a moment.'}</span>
      {api?.requestId && <small>Reference: {api.requestId}</small>}
      {expired ? (
        <button className="button outline" onClick={() => location.reload()}>
          Sign in again <ArrowRight size={16} />
        </button>
      ) : (
        onRetry && (
          <button className="button outline" onClick={onRetry}>
            Retry <ArrowRight size={16} />
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

export function DemoBadge({ children = 'Demonstration data' }: { children?: React.ReactNode }) {
  return (
    <span className="demo-badge" title="Prototype data — not an official government record">
      <Sparkles size={12} /> {children}
    </span>
  );
}

export function PrototypeBanner() {
  return (
    <div className="prototype-banner" role="note">
      <AlertTriangle size={15} />
      <span>
        <b>Prototype.</b> SchemeFit AI is a Smart India Hackathon demonstration. It is <b>not</b> an official government
        service. Scheme rules, approvals and partner data shown here are illustrative and carry no legal effect.
      </span>
    </div>
  );
}
