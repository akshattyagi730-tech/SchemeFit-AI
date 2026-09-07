import { useState } from 'react';
import { Sparkles, X, CheckCircle2, AlertTriangle, CircleHelp } from 'lucide-react';
import { PageTitle, Button, ScoreRing, StatusPill, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useRecommendations, useCreateApplication, useApplications } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { formatPaise, bpsToPct } from '../lib/format';
import type { Recommendation } from '../api/types';

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
  const [compare, setCompare] = useState(false);

  if (isLoading) return <Loading label="Computing your scheme matches…" />;
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
      toast(`Application ${app.reference} started as a draft.`);
      navigate('/loan-planner');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Could not start the application.');
    }
  }

  const eligible = data.eligible;
  const needsInfo = data.needsInformation;
  const ineligible = data.ineligible;

  return (
    <>
      <PageTitle
        title="Your Scheme Matches"
        action={
          <Button variant="outline" onClick={() => setCompare(true)}>
            Compare Schemes
          </Button>
        }
      >
        A deterministic rule engine checks each scheme’s stored rules against your profile. No AI decides eligibility.
      </PageTitle>

      {!data.profileComplete && (
        <div className="prototype-banner" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>
            Complete your profile (category, purpose and the three financing amounts) to unlock ranked matches.{' '}
            <button className="auth-switch" onClick={() => navigate('/profile')}>
              Go to My Profile
            </button>
          </span>
        </div>
      )}

      {eligible.length === 0 && needsInfo.length === 0 && ineligible.length === 0 && (
        <EmptyState title="No schemes to show yet" hint="Add your profile details to see matches." />
      )}

      {eligible.length > 0 && <h3 className="section-h">Eligible &amp; ranked ({eligible.length})</h3>}
      <div className="scheme-list">
        {eligible.map((r) => (
          <SchemeCard key={r.scheme.id} rec={r} onStart={() => startApplication(r.scheme.code)} started={existingByScheme.has(r.scheme.code)} />
        ))}
      </div>

      {needsInfo.length > 0 && (
        <>
          <h3 className="section-h">Needs more information ({needsInfo.length})</h3>
          <div className="scheme-list">
            {needsInfo.map((r) => (
              <SchemeCard key={r.scheme.id} rec={r} onStart={() => navigate('/profile')} started={false} needsInfo />
            ))}
          </div>
        </>
      )}

      {ineligible.length > 0 && (
        <>
          <h3 className="section-h">Not eligible — shown with reasons ({ineligible.length})</h3>
          <div className="scheme-list">
            {ineligible.map((r) => (
              <article className="card scheme-card" key={r.scheme.id}>
                <div className="scheme-card-top">
                  <div>
                    <span className="match low">Not eligible</span>
                    <h2>
                      {r.scheme.name} {r.scheme.source.demoData && <DemoBadge />}
                    </h2>
                    <p>{r.scheme.program}</p>
                  </div>
                </div>
                <div className="why">
                  <Sparkles />
                  <div>
                    <b>Why this doesn’t match yet</b>
                    <ConditionList items={r.eligibility.failed} outcome="failed" />
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

      {compare && <Comparison recs={[...eligible, ...needsInfo, ...ineligible]} onClose={() => setCompare(false)} />}
    </>
  );
}

function SchemeCard({ rec, onStart, started, needsInfo }: { rec: Recommendation; onStart: () => void; started: boolean; needsInfo?: boolean }) {
  const s = rec.scheme;
  const score = rec.suitability?.score ?? 0;
  const [open, setOpen] = useState(false);
  return (
    <article className="card scheme-card">
      <div className="scheme-card-top">
        <div>
          {rec.suitability ? (
            <span className={`match ${score > 80 ? 'great' : score > 50 ? 'okay' : 'low'}`}>{score}/100 suitability</span>
          ) : (
            <span className="match okay">Needs info</span>
          )}
          <h2>
            {s.name} {s.source.demoData && <DemoBadge />}
          </h2>
          <p>{s.program}</p>
        </div>
        {rec.suitability && <ScoreRing score={score} />}
      </div>

      <div className="scheme-specs">
        <span>
          <b>Financing</b>
          {formatPaise(s.financing.minAmountPaise)} – {formatPaise(s.financing.maxAmountPaise)}
        </span>
        <span>
          <b>Interest</b>
          {bpsToPct(s.terms.minInterestRateBps)} – {bpsToPct(s.terms.maxInterestRateBps)}
        </span>
        <span>
          <b>Tenure</b>
          {s.terms.minTenureMonths}–{s.terms.maxTenureMonths} months
        </span>
        <StatusPill status={rec.suitability ? 'Eligible' : 'Needs info'} />
      </div>

      <div className="why">
        <Sparkles />
        <div>
          <b>{needsInfo ? 'What we still need' : 'Why this fits'}</b>
          {needsInfo ? (
            <ConditionList items={rec.eligibility.unknown} outcome="unknown" />
          ) : (
            <>
              <button className="auth-switch" onClick={() => setOpen((o) => !o)}>
                {open ? 'Hide factor breakdown' : 'Show factor breakdown'}
              </button>
              {open &&
                rec.suitability?.factors.map((f) => (
                  <div className="factor-row" key={f.key}>
                    <b>{f.label}</b>
                    <span>
                      {f.rawScore}/100 · weight {Math.round(f.weight * 100)}%
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

      <Button variant={rec.suitability ? 'primary' : 'soft'} onClick={onStart} loading={false}>
        {needsInfo ? 'Complete profile' : started ? 'Open application' : 'Start application'}
      </Button>
    </article>
  );
}

function Comparison({ recs, onClose }: { recs: Recommendation[]; onClose: () => void }) {
  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X />
        </button>
        <h2>Compare Scheme Options</h2>
        <p>Eligibility, suitability score and financing terms side by side. Suitability is a ranking, not an approval odds.</p>
        <div className="compare-table">
          <div className="compare-head">
            <span>Scheme</span>
            <span>Eligibility</span>
            <span>Suitability</span>
            <span>Financing / Interest</span>
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
