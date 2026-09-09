import { useState } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, CircleHelp, ExternalLink } from 'lucide-react';
import { PageTitle, Button, ScoreRing, StatusPill, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useRecommendations, useCreateApplication, useApplications } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { useLang, type TFn } from '../i18n';
import { formatPaise, bpsToPct } from '../lib/format';
import type { Recommendation } from '../api/types';

/** Link to the scheme's official / authorised government portal (opens a new tab). */
function OfficialPortalLink({ url, t }: { url: string | null; t: TFn }) {
  if (url) {
    return (
      <a className="official-link" href={url} target="_blank" rel="noopener noreferrer">
        {t('sm.officialPortal')} <ExternalLink size={12} />
      </a>
    );
  }
  return (
    <span className="official-link disabled" aria-disabled="true">
      {t('sm.officialSoon')}
    </span>
  );
}

function ConditionList({ items, outcome }: { items: { key: string; label: string; detail: string }[]; outcome: string }) {
  if (!items.length) return null;
  const Icon = outcome === 'failed' ? AlertTriangle : outcome === 'passed' ? CheckCircle2 : CircleHelp;
  return (
    <div className="cond-list">
      {items.map((c) => (
        <div key={c.key} className={outcome}>
          <Icon size={15} />
          <span>
            <b>{c.label}.</b> {c.detail}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SchemeMatches({ navigate }: { navigate: (to: string) => void }) {
  const { data, isLoading, isError, error, refetch } = useRecommendations();
  const { data: applications } = useApplications('citizen');
  const create = useCreateApplication();
  const { select } = useActiveApplication();
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const [compare, setCompare] = useState(false);

  if (isLoading) return <Loading label={t('common.loading')} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const existingByScheme = new Map((applications ?? []).map((a) => [a.schemeCode, a]));

  async function startApplication(code: string) {
    const existing = existingByScheme.get(code);
    if (existing) {
      select(existing.id);
      navigate('/loan-planner');
      return;
    }
    try {
      const app = await create.mutateAsync(code);
      select(app.id);
      toast(t('sm.draftStarted', { ref: app.reference }));
      navigate('/loan-planner');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : t('sm.couldNotStart'));
    }
  }

  const eligible = data.eligible;
  const needsInfo = data.needsInformation;
  const ineligible = data.ineligible;

  return (
    <>
      <PageTitle
        title={t('sm.title')}
        action={
          <Button variant="outline" onClick={() => setCompare(true)}>
            {t('sm.compare')}
          </Button>
        }
      >
        {t('sm.intro')}
      </PageTitle>

      {!data.profileComplete && (
        <div className="inline-callout" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>
            {t('sm.completeProfile')}{' '}
            <button className="auth-switch" onClick={() => navigate('/profile')}>
              {t('sm.goToProfile')}
            </button>
          </span>
        </div>
      )}

      {eligible.length === 0 && needsInfo.length === 0 && ineligible.length === 0 && (
        <EmptyState title={t('sm.noSchemes')} hint={t('sm.noSchemesHint')} />
      )}

      {(eligible.length > 0 || needsInfo.length > 0) && (
        <div style={{ marginBottom: 16 }}>
          <DocumentChecklist compact />
        </div>
      )}

      {eligible.length > 0 && <h3 className="section-h">{t('sm.eligibleRanked', { n: eligible.length })}</h3>}
      <div className="scheme-list">
        {eligible.map((r) => (
          <SchemeCard key={r.scheme.id} rec={r} t={t} onStart={() => startApplication(r.scheme.code)} started={existingByScheme.has(r.scheme.code)} />
        ))}
      </div>

      {needsInfo.length > 0 && (
        <>
          <h3 className="section-h">{t('sm.needsInfo', { n: needsInfo.length })}</h3>
          <div className="scheme-list">
            {needsInfo.map((r) => (
              <SchemeCard key={r.scheme.id} rec={r} t={t} onStart={() => navigate('/profile')} started={false} needsInfo />
            ))}
          </div>
        </>
      )}

      {ineligible.length > 0 && (
        <>
          <h3 className="section-h">{t('sm.notEligible', { n: ineligible.length })}</h3>
          <div className="scheme-list">
            {ineligible.map((r) => (
              <article className="card scheme-card" key={r.scheme.id}>
                <div className="scheme-card-top">
                  <div>
                    <span className="match low">{t('sm.notEligibleTag')}</span>
                    <h2>
                      {r.scheme.name} {r.scheme.source.demoData && <DemoBadge />}
                    </h2>
                    <p>{r.scheme.program}</p>
                  </div>
                </div>
                <div className="why">
                  <Sparkles />
                  <div>
                    <b>{t('sm.whyNoMatch')}</b>
                    <ConditionList items={r.eligibility.failed} outcome="failed" />
                    <OfficialPortalLink url={r.scheme.officialUrl} t={t} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      <p className="inline-note">
        {data.notes.map((n, i) => (
          <span key={i}>
            {n}
            <br />
          </span>
        ))}
      </p>

      {compare && <Comparison recs={[...eligible, ...needsInfo, ...ineligible]} t={t} onClose={() => setCompare(false)} />}
    </>
  );
}

function SchemeCard({ rec, onStart, started, needsInfo, t }: { rec: Recommendation; onStart: () => void; started: boolean; needsInfo?: boolean; t: TFn }) {
  const s = rec.scheme;
  const score = rec.suitability?.score ?? 0;
  const [open, setOpen] = useState(false);
  return (
    <article className="card scheme-card">
      <div className="scheme-card-top">
        <div>
          {rec.suitability ? (
            <span className={`match ${score > 80 ? 'great' : score > 50 ? 'okay' : 'low'}`}>{t('sm.suitabilityTag', { n: score })}</span>
          ) : (
            <span className="match okay">{t('sm.needsInfoTag')}</span>
          )}
          <h2>
            {s.name} {s.source.demoData && <DemoBadge />}
          </h2>
          <p>{s.program}</p>
          <OfficialPortalLink url={s.officialUrl} t={t} />
        </div>
        {rec.suitability && <ScoreRing score={score} />}
      </div>

      <div className="scheme-specs">
        <span>
          <b>{t('sm.financing')}</b>
          {formatPaise(s.financing.minAmountPaise)} – {formatPaise(s.financing.maxAmountPaise)}
        </span>
        <span>
          <b>{t('sm.interest')}</b>
          {bpsToPct(s.terms.minInterestRateBps)} – {bpsToPct(s.terms.maxInterestRateBps)}
        </span>
        <span>
          <b>{t('sm.tenure')}</b>
          {s.terms.minTenureMonths}–{s.terms.maxTenureMonths} {t('common.months')}
        </span>
        <StatusPill status={rec.suitability ? 'Eligible' : 'Needs info'} />
      </div>

      <div className="why">
        <Sparkles />
        <div>
          <b>{needsInfo ? t('sm.whatWeNeed') : t('sm.whyFits')}</b>
          {needsInfo ? (
            <ConditionList items={rec.eligibility.unknown} outcome="unknown" />
          ) : (
            <>
              <button className="auth-switch" onClick={() => setOpen((o) => !o)}>
                {open ? t('sm.hideFactors') : t('sm.showFactors')}
              </button>
              {open &&
                rec.suitability?.factors.map((f) => (
                  <div className="factor-row" key={f.key}>
                    <b>{f.label}</b>
                    <span>
                      {f.rawScore}/100 · {t('sm.weight')} {Math.round(f.weight * 100)}%
                    </span>
                    <div className="factor-bar">
                      <i style={{ width: `${f.rawScore}%` }} />
                    </div>
                    <span style={{ gridColumn: '1 / -1' }}>{f.explanation}</span>
                  </div>
                ))}
              {open && <p className="inline-note">{rec.suitability?.disclaimer}</p>}
              {rec.eligibility.advisories.map((a) => (
                <p className="inline-note warn" key={a.key}>
                  {a.detail}
                </p>
              ))}
            </>
          )}
        </div>
      </div>

      <Button variant={rec.suitability ? 'primary' : 'soft'} onClick={onStart}>
        {needsInfo ? t('sm.completeProfileBtn') : started ? t('sm.openApplication') : t('sm.startApplication')}
      </Button>
    </article>
  );
}

function Comparison({ recs, onClose, t }: { recs: Recommendation[]; onClose: () => void; t: TFn }) {
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <h2>{t('sm.compareTitle')}</h2>
        <p>{t('sm.compareSub')}</p>
        <div className="compare-table">
          <div className="compare-head">
            <span>{t('sm.col.scheme')}</span>
            <span>{t('sm.col.eligibility')}</span>
            <span>{t('sm.col.suitability')}</span>
            <span>{t('sm.col.financingInterest')}</span>
          </div>
          {recs.map((r) => (
            <div key={r.scheme.id}>
              <b>{r.scheme.name}</b>
              <span>{r.eligibility.status.replace('_', ' ')}</span>
              <strong>{r.suitability ? `${r.suitability.score}/100` : '—'}</strong>
              <span>
                {formatPaise(r.scheme.financing.maxAmountPaise)} · {bpsToPct(r.scheme.terms.minInterestRateBps)}+
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
