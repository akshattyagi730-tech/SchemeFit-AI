import { Check, Landmark, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { PageTitle, Button, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useApplication, useApplicationAction } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { useLang, useLabels } from '../i18n';
import type { DictKey } from '../i18n/dict';
import { formatPaise, formatDate, formatDateTime } from '../lib/format';
import type { Application, TimelineEntry } from '../api/types';

const STEPS: { key: DictKey; statuses: Application['status'][] }[] = [
  { key: 'st.DRAFT', statuses: ['DRAFT'] },
  { key: 'st.SUBMITTED', statuses: ['SUBMITTED'] },
  { key: 'app.step.partner', statuses: ['ASSIGNED'] },
  { key: 'st.UNDER_REVIEW', statuses: ['UNDER_REVIEW', 'CHANGES_REQUESTED'] },
  { key: 'app.step.decision', statuses: ['APPROVED', 'REJECTED'] },
];

const ORDER: Application['status'][] = ['DRAFT', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'];

export function Applications({ navigate }: { navigate: (to: string) => void }) {
  const { applications, activeId, select, isLoading, isError, refetch } = useActiveApplication();
  const { data: application } = useApplication(activeId ?? undefined);
  const action = useApplicationAction(activeId ?? '');
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const L = useLabels();

  if (isLoading) return <Loading label={t('common.loading')} />;
  if (isError) return <ErrorState error={undefined} onRetry={refetch} />;
  if (!applications.length)
    return (
      <>
        <PageTitle title={t('app.titlePlural')}>{t('app.intro')}</PageTitle>
        <EmptyState title={t('app.noneYet')} hint={t('app.noneYetHint')} />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>{t('pr.goToSchemeMatches')}</Button>
        </div>
      </>
    );

  const app = application ?? applications.find((a) => a.id === activeId) ?? applications[0];

  async function run(act: string, needReason = false) {
    let reason: string | undefined;
    if (needReason) {
      reason = window.prompt(t('app.reasonPrompt')) ?? undefined;
      if (!reason) return;
    }
    try {
      await action.mutateAsync({ action: act, body: reason ? { reason } : undefined });
      toast(t('app.actionDone'));
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : t('app.actionFailed'));
    }
  }

  const currentIdx = ORDER.indexOf(app.status);
  const stepIndex = STEPS.findIndex((s) => s.statuses.includes(app.status));

  return (
    <>
      <PageTitle title={t('app.titlePlural')}>{t('app.introPlural')}</PageTitle>

      {applications.length > 1 && (
        <div className="app-switcher">
          {applications.map((a) => (
            <button key={a.id} className={a.id === app.id ? 'active' : ''} onClick={() => select(a.id)}>
              {a.reference} · {a.schemeCode} · {L.status(a.status)}
            </button>
          ))}
        </div>
      )}

      <article className="card application-hero">
        <div>
          <span className="app-id">
            {app.reference} {app.scheme?.provider && <DemoBadge />}
          </span>
          <h2>
            {app.scheme?.name} — {app.scheme?.program}
          </h2>
          <p>
            <AlertTriangle /> {L.status(app.status)}
            {app.lastReviewNote ? ` — “${app.lastReviewNote}”` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {app.status === 'DRAFT' && (
            <Button onClick={() => run('submit')} loading={action.isPending}>
              {t('app.submit')}
            </Button>
          )}
          {app.status === 'CHANGES_REQUESTED' && (
            <Button onClick={() => run('resubmit')} loading={action.isPending}>
              {t('app.resubmit')}
            </Button>
          )}
          {app.status === 'DRAFT' && (
            <button className="button outline" onClick={() => navigate('/documents')}>
              {t('app.prepareDocuments')} <ChevronRight size={16} />
            </button>
          )}
        </div>
      </article>

      <article className="card timeline-card">
        <h2>{t('app.journeyH')}</h2>
        <div className="timeline">
          {STEPS.map((step, i) => (
            <div className={i < stepIndex ? 'complete' : i === stepIndex ? 'current' : ''} key={step.key}>
              <i>{i < stepIndex ? <Check /> : i + 1}</i>
              <b>{t(step.key)}</b>
              <small>{i < stepIndex ? t('app.done') : i === stepIndex ? t('app.current') : t('app.upcoming')}</small>
            </div>
          ))}
        </div>
        <p className="inline-note warn">{app.workflowNote}</p>
      </article>

      <div className="application-details">
        <article className="card">
          <Landmark />
          <div>
            <small>{t('app.assignedPartner')}</small>
            <b>{app.assignedPartnerName ?? t('app.notAssignedYet')}</b>
            <span>
              {app.assignment
                ? t('app.routingScoreType', { score: app.assignment.routingScore ?? '—', type: app.assignment.assignmentType.replace(/_/g, ' ') })
                : t('app.adminAssignsAfter')}
            </span>
          </div>
        </article>
        <article className="card">
          <FileText />
          <div>
            <small>{t('app.readinessLabel')}</small>
            <b>
              {app.readiness ? t('app.verifiedOf', { v: app.readiness.requiredVerified, t: app.readiness.requiredTotal }) : '—'}
            </b>
            <span>{app.readiness ? t('dash.submittedN', { n: app.readiness.requiredSubmitted }) : t('app.noDocsYet')}</span>
          </div>
        </article>
      </div>

      {app.financingSnapshot && (
        <article className="card">
          <div className="card-head">
            <h2>{t('app.submissionSnapshot')}</h2>
            <span>{t('app.frozenAt', { time: formatDateTime(app.submittedAt) })}</span>
          </div>
          <div className="results-row">
            <div>
              <span>{t('wiz.rv.projectCost')}</span>
              <b>{formatPaise(app.financingSnapshot.projectCostPaise)}</b>
            </div>
            <div>
              <span>{t('dash.requestedLoan')}</span>
              <b>{formatPaise(app.financingSnapshot.requestedLoanPaise)}</b>
            </div>
            <div>
              <span>{t('wiz.rv.ownContribution')}</span>
              <b>{formatPaise(app.financingSnapshot.ownContributionPaise)}</b>
            </div>
          </div>
          {app.financePlanSnapshot && (
            <p className="inline-note">
              {t('app.illustrativeEmiAt', { emi: formatPaise(app.financePlanSnapshot.monthlyInstalmentPaise), n: app.financePlanSnapshot.repaymentMonths })} · {t('lp.totalInterest')} {formatPaise(app.financePlanSnapshot.totalInterestPaise)}
            </p>
          )}
          <p className="inline-note">{t('app.eligibilityAtSubmission', { status: app.eligibilitySnapshot?.status ?? '—' })}</p>
        </article>
      )}

      <article className="card">
        <div className="card-head">
          <h2>{t('app.timelineH')}</h2>
        </div>
        <div className="cond-list">
          {app.timeline
            .slice()
            .reverse()
            .map((ev: TimelineEntry, i) => (
              <div key={i} className="passed">
                <ChevronRight size={14} />
                <span>
                  <b>{ev.action.replace(/_/g, ' ')}</b> — {ev.fromStatus ? `${ev.fromStatus} → ` : ''}
                  {ev.toStatus} · {ev.actorRole} · {formatDate(ev.at)}
                  {ev.reason ? ` · “${ev.reason}”` : ''}
                </span>
              </div>
            ))}
        </div>
      </article>
    </>
  );
}
