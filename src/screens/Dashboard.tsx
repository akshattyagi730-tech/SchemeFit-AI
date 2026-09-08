import { FileText, ShieldCheck, UsersRound, ArrowRight, AlertTriangle, Sparkles, CheckCircle2, IndianRupee, Compass } from 'lucide-react';
import { MadeInIndiaMark } from '../components/MadeInIndiaMark';
import { Button, ScoreRing, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useRecommendations, useApplication, useDocuments, useRouting } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useMe } from '../api/hooks';
import { formatPaise, bpsToPct, STATUS_LABELS } from '../lib/format';

export function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const { data: me } = useMe();
  const { active, activeId, applications } = useActiveApplication();
  const { data: recs, isLoading, isError, refetch } = useRecommendations(me?.user.role === 'CITIZEN');
  const { data: application } = useApplication(activeId ?? undefined);
  const { data: docs } = useDocuments(activeId ?? undefined);
  const { data: routing } = useRouting(application?.schemeCode);

  const firstName = (me?.user.displayName ?? 'there').split(' ')[0];

  if (me?.user.role === 'ADMIN') {
    return (
      <>
        <section className="welcome">
          <div>
            <h1>
              Welcome, <span>{firstName}</span>
            </h1>
            <p>Administrator workspace. Open the Admin Dashboard for statewide KPIs, or Applications to assign and review.</p>
          </div>
        </section>
        <section className="stats">
          <button className="stat" onClick={() => navigate('/admin')}>
            <div className="stat-icon">
              <FileText />
            </div>
            <div>
              <b>KPIs</b>
              <strong>Admin Dashboard</strong>
              <small>Database-derived</small>
            </div>
          </button>
          <button className="stat" onClick={() => navigate('/applications')}>
            <div className="stat-icon">
              <UsersRound />
            </div>
            <div>
              <b>Queue</b>
              <strong>Applications</strong>
              <small>Assign &amp; review</small>
            </div>
          </button>
        </section>
      </>
    );
  }

  if (isLoading) return <Loading label="Loading your dashboard…" />;
  if (isError) return <ErrorState error={undefined} onRetry={refetch} />;

  const topRec = recs?.eligible[0];
  const readiness = docs?.readiness;

  const needsSetup = recs && !recs.profileComplete;

  return (
    <>
      {needsSetup && (
        <div className="getstarted-cta">
          <span className="getstarted-icon">
            <Compass />
          </span>
          <div>
            <b>Let’s find the schemes and loans for you</b>
            <span>Answer a few questions — what you need, who you are, the amounts — and we’ll match every scheme and list the documents.</span>
          </div>
          <Button onClick={() => navigate('/start')}>Get started</Button>
        </div>
      )}

      <section className="welcome">
        <div>
          <h1>
            Good day, <span>{firstName}</span> <span className="wave">👋</span>
          </h1>
          <p>Here are your scheme matches and next steps for your entrepreneurial journey.</p>
        </div>
        <MadeInIndiaMark />
        <div className="india-quote">
          <b>
            Inclusive Entrepreneurs
            <br />
            Stronger India
          </b>
          <i />
          <span>
            “Small dreams
            <br />
            build a big India.”
            <small>— NITI Aayog (illustrative)</small>
          </span>
        </div>
      </section>

      <section className="stats">
        <button className="stat" onClick={() => navigate('/schemes')}>
          <div className="stat-icon">
            <FileText />
          </div>
          <div>
            <b>{recs?.counts.eligible ?? 0}</b>
            <strong>Eligible schemes</strong>
            <small>{recs?.counts.needsInformation ?? 0} need more info</small>
          </div>
        </button>
        <button className="stat" onClick={() => navigate('/documents')}>
          <div className="stat-icon">
            <ShieldCheck />
          </div>
          <div>
            <b>{readiness ? `${readiness.requiredVerified}/${readiness.requiredTotal}` : '—'}</b>
            <strong>Documents verified</strong>
            <small>{readiness ? `${readiness.requiredSubmitted} submitted` : 'No application yet'}</small>
          </div>
        </button>
        <button className="stat" onClick={() => navigate('/partners')}>
          <div className="stat-icon">
            <UsersRound />
          </div>
          <div>
            <b>{routing?.routing.matched ? 1 : 0}</b>
            <strong>Partner recommended</strong>
            <small>{routing?.routing.recommended?.name ?? 'Run partner routing'}</small>
          </div>
        </button>
        <div className="quote">
          <b>“</b>
          <span>
            “Your potential matters.
            <br />
            The right support can
            <br />
            take you further.”
          </span>
          <i />
        </div>
      </section>

      <section className="grid-main">
        <article className="card scheme-hero">
          <div className="card-head">
            <h2>Your best scheme match</h2>
            <span className="ai">
              <Sparkles size={14} />
              Rule-engine ranked
            </span>
          </div>
          {topRec ? (
            <div className="scheme-body">
              <div className="scheme-info">
                <div className="money-icon">
                  <IndianRupee />
                </div>
                <div>
                  <h2>{topRec.scheme.displayCategory}</h2>
                  <p>
                    {topRec.scheme.name} {topRec.scheme.source.demoData && <DemoBadge />}
                  </p>
                  <p className="description">{topRec.scheme.description}</p>
                </div>
                <div className="check-box">
                  {topRec.eligibility.passed.slice(0, 4).map((k) => (
                    <div key={k}>
                      <CheckCircle2 /> {k.replace(/_/g, ' ')} check passed
                    </div>
                  ))}
                  <div className="tags">
                    <span>Financing {formatPaise(topRec.scheme.financing.maxAmountPaise)}</span>
                    <span>{bpsToPct(topRec.scheme.terms.minInterestRateBps)}+ interest</span>
                  </div>
                </div>
              </div>
              <div className="scheme-score">
                <ScoreRing score={topRec.suitability?.score ?? 0} />
                <span>{topRec.suitability?.score ?? 0}/100 suitability</span>
                <Button onClick={() => navigate('/schemes')}>View all matches</Button>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No eligible scheme yet"
              hint="Complete your profile so the rule engine can evaluate and rank schemes."
            />
          )}
        </article>

        <article className="card readiness">
          <div className="card-head">
            <h2>Application readiness</h2>
            <button onClick={() => navigate('/documents')}>
              View all documents <ArrowRight size={16} />
            </button>
          </div>
          {application ? (
            <>
              <div className="readiness-main">
                <ScoreRing score={readiness?.verifiedPct ?? 0} label="/100" />
                <div className="doc-list">
                  {(readiness?.lines ?? []).slice(0, 5).map((l) => (
                    <div key={l.type}>
                      <span className="doc-icon">
                        <FileText size={14} />
                      </span>
                      <span>{l.label}</span>
                      <span className={`status ${l.state === 'verified' ? 'verified' : l.state === 'missing' ? 'missing' : 'pending'}`}>
                        {l.state.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="warning">
                <AlertTriangle />
                <div>
                  <b>
                    {application.status === 'CHANGES_REQUESTED'
                      ? 'The reviewer requested changes'
                      : readiness && readiness.requiredVerified < readiness.requiredTotal
                        ? `${readiness.requiredTotal - readiness.requiredVerified} document(s) still to verify`
                        : 'Documents are progressing'}
                  </b>
                  <span>{application.lastReviewNote || `Application ${application.reference} · ${STATUS_LABELS[application.status]}`}</span>
                </div>
                <Button variant="outline" onClick={() => navigate('/documents')}>
                  Review documents
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              title="No application started"
              hint="Pick a scheme from your matches to begin — required documents come from that scheme."
            />
          )}
        </article>
      </section>

      <section className="grid-main lower">
        <article className="card loan-preview">
          <div className="card-head">
            <div className="title-icon">
              <IndianRupee />
              <div>
                <h2>Loan planner</h2>
                <p>Open the planner to model EMI, tenure and moratorium for your application.</p>
              </div>
            </div>
          </div>
          <div className="loan-numbers">
            <div>
              <b>{formatPaise(application?.financing.requestedLoanPaise)}</b>
              <span>Requested loan</span>
            </div>
            <div>
              <b>{application?.financing.tenureMonths ?? '—'} mo</b>
              <span>Tenure</span>
            </div>
            <div>
              <b>{application?.financePlanSnapshot ? formatPaise(application.financePlanSnapshot.monthlyInstalmentPaise) : '—'}</b>
              <span>EMI (last saved)</span>
            </div>
            <button onClick={() => navigate('/loan-planner')}>
              Open detailed planner <ArrowRight size={15} />
            </button>
          </div>
        </article>

        <article className="card partner-preview">
          <div className="card-head">
            <div className="title-icon">
              <UsersRound />
              <h2>Best channel partner</h2>
            </div>
            <button onClick={() => navigate('/partners')}>
              View routing <ArrowRight size={16} />
            </button>
          </div>
          <div className="partner-info">
            {routing?.routing.matched && routing.routing.recommended ? (
              <>
                <div>
                  <div className="partner-name">
                    <UsersRound />
                    <span>
                      <b>{routing.routing.recommended.name}</b>
                      <small>{routing.routing.recommended.type.replace(/_/g, ' ')}</small>
                    </span>
                  </div>
                  <span className="recommended">
                    <CheckCircle2 size={12} />
                    {routing.routing.recommended.score}/100
                  </span>
                </div>
                <p className="inline-note">{routing.routing.recommended.reason}</p>
              </>
            ) : (
              <EmptyState title="Routing not available" hint="Start an application to run partner routing for its scheme." />
            )}
          </div>
        </article>
      </section>
    </>
  );
}
