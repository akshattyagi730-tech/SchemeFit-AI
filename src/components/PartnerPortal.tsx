import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileText,
  Landmark,
  LogOut,
  Search,
  ShieldCheck,
  UsersRound,
  Download,
} from 'lucide-react';
import './partner-portal.css';
import { BrandMark } from './BrandMark';
import { Button, Loading, ErrorState, EmptyState, DemoBadge } from './ui';
import {
  usePartnerSummary,
  usePartnerApplications,
  useApplication,
  useDocuments,
  useReviewDocument,
  usePartnerApplicationAction,
  useLogout,
} from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError, downloadDocument } from '../api/client';
import { formatPaise, formatDate, STATUS_LABELS, DOC_STATE_LABELS } from '../lib/format';
import type { AuthUser } from '../api/types';

function DocStatus({ value }: { value: string }) {
  return (
    <span className={`case-doc-status ${value === 'verified' ? 'ok' : value === 'missing' ? 'miss' : 'wait'}`}>
      {value === 'verified' ? <CheckCircle2 /> : <CircleAlert />}
      {DOC_STATE_LABELS[value] ?? value}
    </span>
  );
}

export function PartnerPortal({ user }: { user: AuthUser }) {
  const summary = usePartnerSummary();
  const [filters, setFilters] = useState<{ status?: string; q?: string }>({});
  const list = usePartnerApplications(filters);
  const [activeId, setActiveId] = useState<string | null>(null);
  const logout = useLogout();
  const { toast, errorToast } = useToast();

  useEffect(() => {
    if (!activeId && list.data?.items?.length) setActiveId(list.data.items[0].id);
  }, [list.data, activeId]);

  const { data: application } = useApplication(activeId ?? undefined);
  const docs = useDocuments(activeId ?? undefined, true);
  const review = useReviewDocument(activeId ?? '');
  const action = usePartnerApplicationAction(activeId ?? '');

  async function transition(act: string, needReason = false) {
    let reason: string | undefined;
    if (needReason) {
      reason = window.prompt(`Reason for "${act.replace(/-/g, ' ')}":`) ?? undefined;
      if (!reason) return;
    }
    try {
      await action.mutateAsync({ action: act, body: reason ? { reason } : undefined });
      toast(`Application ${act.replace(/-/g, ' ')} recorded.`);
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Action failed.');
    }
  }

  async function reviewDoc(id: string, decision: string) {
    let feedback: string | undefined;
    if (decision === 'changes_requested') {
      feedback = window.prompt('What does the applicant need to change (and for which document)?') ?? undefined;
      if (!feedback) return;
    }
    try {
      await review.mutateAsync({ id, decision, feedback });
      toast(decision === 'verified' ? 'Document verified.' : decision === 'changes_requested' ? 'Change request sent to the applicant.' : 'Marked under review.');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Review failed.');
    }
  }

  async function download(id: string) {
    try {
      const { url, filename } = await downloadDocument(id);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      errorToast('Could not download this document.');
    }
  }

  const org = summary.data?.organisation;

  return (
    <main className="partner-page">
      <header className="partner-header">
        <div className="partner-logo">
          <BrandMark size={26} />
          <span className="partner-wordmark">Scheme<i>Fit</i></span>
          <b>Partner Portal</b>
        </div>
        <div>
          <span className="partner-agency">
            <Landmark /> {org?.name ?? user.displayName}
          </span>
          <button onClick={() => logout.mutate()}>
            <LogOut /> Sign out
          </button>
        </div>
      </header>

      <div className="partner-shell">
        <section className="partner-intro">
          <div>
            <span className="portal-eyebrow">CHANNEL PARTNER WORKSPACE</span>
            <h1>Assigned applications</h1>
            <p>{summary.data?.note ?? 'You see only applications routed to your organisation.'}</p>
          </div>
          <div className="portal-stat">
            <UsersRound />
            <span>
              <b>{summary.data?.assignedTotal ?? 0}</b> Assigned cases
            </span>
          </div>
        </section>

        <section className="partner-kpis">
          <div>
            <FileText />
            <span>
              <b>{summary.data?.assignedTotal ?? 0}</b>Assigned applications
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              <b>{org ? `${org.activeAssignments}/${org.capacity}` : '—'}</b>Case-load capacity
            </span>
          </div>
          <div>
            <CircleAlert />
            <span>
              <b>{summary.data?.actionNeeded ?? 0}</b>Action needed
            </span>
          </div>
        </section>

        <div className="partner-content">
          <aside className="case-list">
            <div className="case-search">
              <Search />
              <input
                placeholder="Search reference or scheme"
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))}
              />
            </div>
            <div className="case-filter-row">
              {['', 'ASSIGNED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'APPROVED'].map((s) => (
                <button
                  key={s || 'all'}
                  className={filters.status === (s || undefined) ? 'active' : ''}
                  onClick={() => setFilters((f) => ({ ...f, status: s || undefined }))}
                >
                  {s ? STATUS_LABELS[s] : 'All'}
                </button>
              ))}
            </div>
            {list.isLoading ? (
              <Loading />
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={list.refetch} />
            ) : (list.data?.items.length ?? 0) === 0 ? (
              <EmptyState title="No assigned applications" hint="Applications appear here once an administrator routes them to you." />
            ) : (
              list.data!.items.map((item) => (
                <button
                  className={item.id === activeId ? 'active-case' : ''}
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                >
                  <span className="case-avatar">{item.reference.slice(-2)}</span>
                  <span>
                    <b>{item.reference}</b>
                    <small>
                      {item.schemeCode} ·{' '}
                      {item.readiness ? `${item.readiness.requiredVerified}/${item.readiness.requiredTotal} verified` : 'no docs'}
                    </small>
                    <em>{STATUS_LABELS[item.status]}</em>
                  </span>
                  <ChevronRight />
                </button>
              ))
            )}
          </aside>

          <section className="case-detail">
            {!application ? (
              <EmptyState title="Select an application" />
            ) : (
              <>
                <div className="case-detail-head">
                  <div>
                    <span className="portal-eyebrow">
                      ASSIGNED CASE · {application.reference} <DemoBadge>demo scheme</DemoBadge>
                    </span>
                    <h2>{application.scheme?.name}</h2>
                    <p>
                      {application.scheme?.program} · {STATUS_LABELS[application.status]}
                    </p>
                  </div>
                  <span className="case-score">
                    {application.readiness
                      ? `${application.readiness.verifiedPct}% verified`
                      : '—'}
                  </span>
                </div>

                <div className="case-summary">
                  <div>
                    <small>Requested funding (from applicant)</small>
                    <b>{formatPaise(application.financingSnapshot?.requestedLoanPaise ?? application.financing.requestedLoanPaise)}</b>
                  </div>
                  <div>
                    <small>Project cost / own contribution</small>
                    <b>
                      {formatPaise(application.financingSnapshot?.projectCostPaise ?? application.financing.projectCostPaise)} /{' '}
                      {formatPaise(application.financingSnapshot?.ownContributionPaise ?? application.financing.ownContributionPaise)}
                    </b>
                  </div>
                  <div>
                    <small>Eligibility at submission</small>
                    <b>{application.eligibilitySnapshot?.status ?? '—'}</b>
                  </div>
                </div>

                {application.assignment && (
                  <article className="case-documents">
                    <div>
                      <h3>Routing explanation</h3>
                      <p>{application.assignment.routingReason || 'Assigned by an administrator.'}</p>
                    </div>
                    <p className="inline-note">
                      Score {application.assignment.routingScore ?? '—'} ·{' '}
                      {application.assignment.distanceKm != null
                        ? `${application.assignment.distanceKm} km straight-line`
                        : 'distance n/a'}{' '}
                      · {application.assignment.metricsSimulated ? 'simulated metrics' : 'live metrics'}
                    </p>
                  </article>
                )}

                {application.financePlanSnapshot && (
                  <article className="case-documents">
                    <div>
                      <h3>Financing snapshot</h3>
                      <p>Frozen at submission — illustrative only, not a sanction.</p>
                    </div>
                    <p className="inline-note">
                      EMI {formatPaise(application.financePlanSnapshot.monthlyInstalmentPaise)} ·{' '}
                      {application.financePlanSnapshot.repaymentMonths} months · total interest{' '}
                      {formatPaise(application.financePlanSnapshot.totalInterestPaise)} · moratorium interest{' '}
                      {formatPaise(application.financePlanSnapshot.moratoriumInterestPaise)}
                    </p>
                  </article>
                )}

                <article className="case-documents">
                  <div>
                    <h3>Document review</h3>
                    <p>Visible because this application is assigned to your organisation. Verifying a document does not approve the application.</p>
                  </div>
                  {docs.isLoading ? (
                    <Loading />
                  ) : (
                    (docs.data?.readiness?.lines ?? []).map((line) => {
                      const doc = docs.data?.documents.find((d) => d.type === line.type && d.current);
                      return (
                        <div className="case-document" key={line.type}>
                          <span>
                            <FileText />
                          </span>
                          <b>
                            {line.label}
                            {doc ? ` · v${doc.version}` : ''}
                            {doc?.source === 'digilocker' && <span className="prov-tag good">DigiLocker</span>}
                            {doc?.source === 'manual' && doc.authenticity && doc.authenticity.method !== 'none' && (
                              <span
                                className={`prov-tag ${
                                  doc.authenticity.trustLevel === 'issuer_verified' || doc.authenticity.trustLevel === 'e_signed'
                                    ? 'good'
                                    : doc.authenticity.trustLevel === 'invalid'
                                      ? 'bad'
                                      : 'weak'
                                }`}
                                title={doc.authenticity.summary}
                              >
                                {doc.authenticity.trustLevel.replace(/_/g, ' ')}
                              </span>
                            )}
                          </b>
                          <DocStatus value={line.state} />
                          <div className="review-actions">
                            {doc && (
                              <button className="neutral" onClick={() => download(doc.id)}>
                                <Download size={12} /> Open
                              </button>
                            )}
                            {doc && line.state !== 'verified' && (
                              <button className="verify" onClick={() => reviewDoc(doc.id, 'verified')} disabled={review.isPending}>
                                Verify
                              </button>
                            )}
                            {doc && (
                              <button className="changes" onClick={() => reviewDoc(doc.id, 'changes_requested')} disabled={review.isPending}>
                                Request update
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </article>

                <div className="case-actions">
                  {application.status === 'ASSIGNED' || application.status === 'CHANGES_REQUESTED' ? (
                    <button className="primary-action" onClick={() => transition('start-review')}>
                      Start review <ChevronRight />
                    </button>
                  ) : application.status === 'UNDER_REVIEW' ? (
                    <>
                      <button className="secondary-action" onClick={() => transition('request-changes', true)}>
                        Request changes
                      </button>
                      <button className="secondary-action" onClick={() => transition('reject', true)}>
                        Reject
                      </button>
                      <button className="primary-action" onClick={() => transition('approve')}>
                        Approve <ChevronRight />
                      </button>
                    </>
                  ) : (
                    <span className="inline-note">
                      {STATUS_LABELS[application.status]} — no further partner action.{' '}
                      {application.status === 'APPROVED' || application.status === 'REJECTED'
                        ? 'This is a demonstration workflow outcome, not a government decision or disbursement.'
                        : ''}
                    </span>
                  )}
                </div>

                <article className="case-documents">
                  <div>
                    <h3>Timeline</h3>
                  </div>
                  {application.timeline
                    .slice()
                    .reverse()
                    .map((t, i) => (
                      <p className="inline-note" key={i}>
                        <b>{t.action.replace(/_/g, ' ')}</b> · {t.toStatus} · {t.actorRole} · {formatDate(t.at)}
                        {t.reason ? ` · “${t.reason}”` : ''}
                      </p>
                    ))}
                </article>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
