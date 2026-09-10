import { FileText, ShieldCheck, UsersRound, ArrowRight, AlertTriangle, Sparkles, CheckCircle2, IndianRupee, Compass } from 'lucide-react';
import { Button, ScoreRing, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useRecommendations, useApplication, useDocuments, useRouting } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useMe } from '../api/hooks';
import { useLang, useLabels } from '../i18n';
import { formatPaise, bpsToPct } from '../lib/format';

export function Dashboard({ navigate }: { navigate: (to: string) => void }) {
  const { data: me } = useMe();
  const { t, lang } = useLang();
  const L = useLabels();
  const { activeId } = useActiveApplication();
  const { data: recs, isLoading, isError, refetch } = useRecommendations(me?.user.role === 'CITIZEN');
  const { data: application } = useApplication(activeId ?? undefined);
  const { data: docs } = useDocuments(activeId ?? undefined);
  const { data: routing } = useRouting(application?.schemeCode);

  const firstName = (me?.user.displayName ?? '').split(' ')[0];

  if (me?.user.role === 'ADMIN') {
    return (
      <>
        <section className="welcome">
          <div>
            <h1>{t('dash.adminWelcome', { name: firstName })}</h1>
            <p>{t('dash.adminSub')}</p>
          </div>
        </section>
        <section className="stats">
          <button className="stat" onClick={() => navigate('/admin')}>
            <div className="stat-icon">
              <FileText />
            </div>
            <div>
              <b>KPIs</b>
              <strong>{t('dash.adminKpisTitle')}</strong>
              <small>{t('dash.adminKpisSub')}</small>
            </div>
          </button>
          <button className="stat" onClick={() => navigate('/applications')}>
            <div className="stat-icon">
              <UsersRound />
            </div>
            <div>
              <b>Queue</b>
              <strong>{t('dash.adminQueue')}</strong>
              <small>{t('dash.adminQueueSub')}</small>
            </div>
          </button>
        </section>
      </>
    );
  }

  if (isLoading) return <Loading label={t('common.loading')} />;
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
            <b>{t('dash.ctaTitle')}</b>
            <span>{t('dash.ctaSub')}</span>
          </div>
          <Button onClick={() => navigate('/start')}>{t('dash.ctaBtn')}</Button>
        </div>
      )}

      <section className="welcome">
        <div>
          <h1>
            {t('dash.goodDay', { name: firstName })} <span className="wave">👋</span>
          </h1>
          <p>{t('dash.welcomeSub')}</p>
        </div>
        <div className="india-quote">
          <b>
            {lang === 'hi' ? (
              <>
                समावेशी उद्यमी
                <br />
                सशक्त भारत
              </>
            ) : (
              <>
                Inclusive Entrepreneurs
                <br />
                Stronger India
              </>
            )}
          </b>
          <i />
          <span>
            {lang === 'hi' ? '“छोटे सपने बड़ा भारत बनाते हैं।”' : '“Small dreams build a big India.”'}
            <small>{lang === 'hi' ? '— SchemeFit टीम' : '— the SchemeFit team'}</small>
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
            <strong>{t('dash.eligibleSchemes')}</strong>
            <small>{t('dash.needMoreInfo', { n: recs?.counts.needsInformation ?? 0 })}</small>
          </div>
        </button>
        <button className="stat" onClick={() => navigate('/documents')}>
          <div className="stat-icon">
            <ShieldCheck />
          </div>
          <div>
            <b>{readiness ? `${readiness.requiredVerified}/${readiness.requiredTotal}` : '—'}</b>
            <strong>{t('dash.documentsVerified')}</strong>
            <small>{readiness ? t('dash.submittedN', { n: readiness.requiredSubmitted }) : t('dash.noApplicationYet')}</small>
          </div>
        </button>
        <button className="stat" onClick={() => navigate('/partners')}>
          <div className="stat-icon">
            <UsersRound />
          </div>
          <div>
            <b>{routing?.routing.matched ? 1 : 0}</b>
            <strong>{t('dash.partnerRecommended')}</strong>
            <small>{routing?.routing.recommended?.name ?? t('dash.runPartnerRouting')}</small>
          </div>
        </button>
        <div className="quote">
          <b>“</b>
          <span>
            {lang === 'hi'
              ? '“आपकी संभावनाएँ मायने रखती हैं। सही सहयोग आपको और आगे ले जा सकता है।”'
              : '“Your potential matters. The right support can take you further.”'}
          </span>
          <i />
        </div>
      </section>

      <section className="grid-main">
        <article className="card scheme-hero">
          <div className="card-head">
            <h2>{t('dash.bestMatch')}</h2>
            <span className="ai">
              <Sparkles size={14} />
              {t('dash.ruleRanked')}
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
                      <CheckCircle2 /> {k.replace(/_/g, ' ')}
                    </div>
                  ))}
                  <div className="tags">
                    <span>
                      {t('sm.financing')} {formatPaise(topRec.scheme.financing.maxAmountPaise)}
                    </span>
                    <span>{bpsToPct(topRec.scheme.terms.minInterestRateBps)}+</span>
                  </div>
                </div>
              </div>
              <div className="scheme-score">
                <ScoreRing score={topRec.suitability?.score ?? 0} />
                <span>{t('dash.suitability', { n: topRec.suitability?.score ?? 0 })}</span>
                <Button onClick={() => navigate('/schemes')}>{t('dash.viewAllMatches')}</Button>
              </div>
            </div>
          ) : (
            <EmptyState title={t('dash.noEligibleYet')} hint={t('dash.noEligibleHint')} />
          )}
        </article>

        <article className="card readiness">
          <div className="card-head">
            <h2>{t('dash.appReadiness')}</h2>
            <button onClick={() => navigate('/documents')}>
              {t('dash.viewAllDocuments')} <ArrowRight size={16} />
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
                        {L.docState(l.state)}
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
                      ? t('dash.reviewerRequestedChanges')
                      : readiness && readiness.requiredVerified < readiness.requiredTotal
                        ? t('dash.docsToVerify', { n: readiness.requiredTotal - readiness.requiredVerified })
                        : t('dash.docsProgressing')}
                  </b>
                  <span>{application.lastReviewNote || `${application.reference} · ${L.status(application.status)}`}</span>
                </div>
                <Button variant="outline" onClick={() => navigate('/documents')}>
                  {t('dash.reviewDocuments')}
                </Button>
              </div>
            </>
          ) : (
            <EmptyState title={t('dash.noApplicationStarted')} hint={t('dash.noApplicationHint')} />
          )}
        </article>
      </section>

      <section className="grid-main lower">
        <article className="card loan-preview">
          <div className="card-head">
            <div className="title-icon">
              <IndianRupee />
              <div>
                <h2>{t('dash.loanPlanner')}</h2>
                <p>{t('dash.loanPlannerSub')}</p>
              </div>
            </div>
          </div>
          <div className="loan-numbers">
            <div>
              <b>{formatPaise(application?.financing.requestedLoanPaise)}</b>
              <span>{t('dash.requestedLoan')}</span>
            </div>
            <div>
              <b>
                {application?.financing.tenureMonths ?? '—'} {t('common.mo')}
              </b>
              <span>{t('dash.tenure')}</span>
            </div>
            <div>
              <b>{application?.financePlanSnapshot ? formatPaise(application.financePlanSnapshot.monthlyInstalmentPaise) : '—'}</b>
              <span>{t('dash.emiLastSaved')}</span>
            </div>
            <button onClick={() => navigate('/loan-planner')}>
              {t('dash.openDetailedPlanner')} <ArrowRight size={15} />
            </button>
          </div>
        </article>

        <article className="card partner-preview">
          <div className="card-head">
            <div className="title-icon">
              <UsersRound />
              <h2>{t('dash.bestChannelPartner')}</h2>
            </div>
            <button onClick={() => navigate('/partners')}>
              {t('dash.viewRouting')} <ArrowRight size={16} />
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
              <EmptyState title={t('dash.routingNotAvailable')} hint={t('dash.routingHint')} />
            )}
          </div>
        </article>
      </section>
    </>
  );
}
