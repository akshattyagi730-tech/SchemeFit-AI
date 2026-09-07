import { Check, Landmark, FileText, AlertTriangle, ChevronRight } from 'lucide-react';
import { PageTitle, Button, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useApplication, useApplicationAction } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { formatPaise, formatDate, formatDateTime, STATUS_LABELS } from '../lib/format';
import type { Application, TimelineEntry } from '../api/types';

const STEPS: { label: string; statuses: Application['status'][] }[] = [
  { label: 'Draft', statuses: ['DRAFT'] },
  { label: 'Submitted', statuses: ['SUBMITTED'] },
  { label: 'Partner assigned', statuses: ['ASSIGNED'] },
  { label: 'Under review', statuses: ['UNDER_REVIEW', 'CHANGES_REQUESTED'] },
  { label: 'Decision', statuses: ['APPROVED', 'REJECTED'] },
];

const ORDER: Application['status'][] = ['DRAFT', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'];

export function Applications({ navigate }: { navigate: (to: string) => void }) {
  const { applications, activeId, select, isLoading, isError, refetch } = useActiveApplication();
  const { data: application } = useApplication(activeId ?? undefined);
  const action = useApplicationAction(activeId ?? '');
  const { toast, errorToast } = useToast();

  if (isLoading) return <Loading label="Loading your applications…" />;
  if (isError) return <ErrorState error={undefined} onRetry={refetch} />;
  if (!applications.length)
    return (
      <>
        <PageTitle title="My Applications">Track every milestone in your scheme application journey.</PageTitle>
        <EmptyState title="You have no applications yet" hint="Start one from Scheme Matches." />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>Go to Scheme Matches</Button>
        </div>
      </>
    );

  const app = application ?? applications.find((a) => a.id === activeId) ?? applications[0];

  async function run(act: string, needReason = false) {
    let reason: string | undefined;
    if (needReason) {
      reason = window.prompt('Reason:') ?? undefined;
      if (!reason) return;
    }
    try {
      await action.mutateAsync({ action: act, body: reason ? { reason } : undefined });
      toast(`Application ${act.replace(/-/g, ' ')} done.`);
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Action failed.');
    }
  }

  const currentIdx = ORDER.indexOf(app.status);
  const stepIndex = STEPS.findIndex((s) => s.statuses.includes(app.status));

  return (
    <>
      <PageTitle title="My Applications">One application per scheme. History is preserved even if your profile changes.</PageTitle>

      {applications.length > 1 && (
        <div className="app-switcher">
          {applications.map((a) => (
            <button key={a.id} className={a.id === app.id ? 'active' : ''} onClick={() => select(a.id)}>
              {a.reference} · {a.schemeCode} · {STATUS_LABELS[a.status]}
            </button>
          ))}
        </div>
      )}

      <article className="card application-hero">
        <div>
          <span className="app-id">
            Application · {app.reference} {app.scheme?.provider && <DemoBadge>demo scheme</DemoBadge>}
          </span>
          <h2>
            {app.scheme?.name} — {app.scheme?.program}
          </h2>
          <p>
            <AlertTriangle /> {STATUS_LABELS[app.status]}
            {app.lastReviewNote ? ` — “${app.lastReviewNote}”` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {app.status === 'DRAFT' && (
            <Button onClick={() => run('submit')} loading={action.isPending}>
              Submit application
            </Button>
          )}
          {app.status === 'CHANGES_REQUESTED' && (
            <Button onClick={() => run('resubmit')} loading={action.isPending}>
              Resubmit for review
            </Button>
          )}
          {app.status === 'DRAFT' && (
            <button className="button outline" onClick={() => navigate('/documents')}>
              Prepare documents <ChevronRight size={16} />
            </button>
          )}
        </div>
      </article>

      <article className="card timeline-card">
        <h2>Application journey</h2>
        <div className="timeline">
          {STEPS.map((step, i) => (
            <div className={i < stepIndex ? 'complete' : i === stepIndex ? 'current' : ''} key={step.label}>
              <i>{i < stepIndex ? <Check /> : i + 1}</i>
              <b>{step.label}</b>
              <small>{i < stepIndex ? 'Done' : i === stepIndex ? 'Current' : 'Upcoming'}</small>
            </div>
          ))}
        </div>
        <p className="inline-note warn">{app.workflowNote}</p>
      </article>

      <div className="application-details">
        <article className="card">
          <Landmark />
          <div>
            <small>Assigned partner</small>
            <b>{app.assignedPartnerName ?? 'Not assigned yet'}</b>
            <span>
              {app.assignment
                ? `Routing score ${app.assignment.routingScore ?? '—'} · ${app.assignment.assignmentType.replace(/_/g, ' ')}`
                : 'An administrator assigns a partner after submission.'}
            </span>
          </div>
        </article>
        <article className="card">
          <FileText />
          <div>
            <small>Readiness</small>
            <b>
              {app.readiness ? `${app.readiness.requiredVerified}/${app.readiness.requiredTotal} verified` : '—'}
            </b>
            <span>{app.readiness ? `${app.readiness.requiredSubmitted} submitted` : 'No documents yet'}</span>
          </div>
        </article>
      </div>

      {app.financingSnapshot && (
        <article className="card">
          <div className="card-head">
            <h2>Submission snapshot</h2>
            <span>Frozen at {formatDateTime(app.submittedAt)}</span>
          </div>
          <div className="results-row">
            <div>
              <span>Project cost</span>
              <b>{formatPaise(app.financingSnapshot.projectCostPaise)}</b>
            </div>
            <div>
              <span>Requested loan</span>
              <b>{formatPaise(app.financingSnapshot.requestedLoanPaise)}</b>
            </div>
            <div>
              <span>Own contribution</span>
              <b>{formatPaise(app.financingSnapshot.ownContributionPaise)}</b>
            </div>
          </div>
          {app.financePlanSnapshot && (
            <p className="inline-note">
              Illustrative EMI at submission: {formatPaise(app.financePlanSnapshot.monthlyInstalmentPaise)} over{' '}
              {app.financePlanSnapshot.repaymentMonths} months · total interest{' '}
              {formatPaise(app.financePlanSnapshot.totalInterestPaise)}.
            </p>
          )}
          <p className="inline-note">
            Eligibility at submission: <b>{app.eligibilitySnapshot?.status}</b>. Editing your profile now will not change
            this record.
          </p>
        </article>
      )}

      <article className="card">
        <div className="card-head">
          <h2>Timeline</h2>
        </div>
        <div className="cond-list">
          {app.timeline
            .slice()
            .reverse()
            .map((t: TimelineEntry, i) => (
              <div key={i} className="passed">
                <ChevronRight size={14} />
                <span>
                  <b>{t.action.replace(/_/g, ' ')}</b> — {t.fromStatus ? `${t.fromStatus} → ` : ''}
                  {t.toStatus} · {t.actorRole} · {formatDate(t.at)}
                  {t.reason ? ` · “${t.reason}”` : ''}
                </span>
              </div>
            ))}
        </div>
      </article>
    </>
  );
}
