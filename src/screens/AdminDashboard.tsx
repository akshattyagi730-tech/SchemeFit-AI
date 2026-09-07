import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ClipboardList, WalletCards, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { PageTitle, Loading, ErrorState, EmptyState, DemoBadge } from '../components/ui';
import { useAdminKpis, useAdminApplications, useAdminAssign } from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { formatPaise, STATUS_LABELS } from '../lib/format';

export function AdminDashboard() {
  const { data, isLoading, isError, error, refetch } = useAdminKpis();
  const [statusFilter, setStatusFilter] = useState('');
  const apps = useAdminApplications({ status: statusFilter || undefined });
  const assign = useAdminAssign();
  const { toast, errorToast } = useToast();

  if (isLoading) return <Loading label="Loading KPIs…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  async function doAssign(appId: string) {
    try {
      await assign.mutateAsync({ appId });
      toast('Application assigned to the top routing match.');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Assignment failed.');
    }
  }

  return (
    <>
      <PageTitle title="Admin Dashboard" action={<DemoBadge>{data.dataClassification}</DemoBadge>}>
        {data.demoNote}
      </PageTitle>

      <section className="admin-kpis">
        <article className="card">
          <span>
            <ClipboardList />
          </span>
          <div>
            <b>{data.applications.submitted}</b>
            <small>Submitted applications (drafts excluded)</small>
          </div>
        </article>
        <article className="card">
          <span>
            <WalletCards />
          </span>
          <div>
            <b>{formatPaise(data.funding.requestedTotalPaise)}</b>
            <small>Requested funding (sum of requested loans, not scheme ceilings)</small>
          </div>
        </article>
        <article className="card">
          <span>
            <CheckCircle2 />
          </span>
          <div>
            <b>{data.pipeline.submittedToReviewRate.value}%</b>
            <small>
              Reached review or decision ({data.pipeline.submittedToReviewRate.numerator}/
              {data.pipeline.submittedToReviewRate.denominator})
            </small>
          </div>
        </article>
        <article className="card">
          <span>
            <AlertTriangle />
          </span>
          <div>
            <b>{data.documentChangesRequested.reduce((s, d) => s + d.count, 0)}</b>
            <small>Documents currently needing changes</small>
          </div>
        </article>
      </section>

      <div className="admin-grid">
        <article className="card district-chart">
          <div className="card-head">
            <h2>Applications by scheme</h2>
            <span>Submitted only</span>
          </div>
          {data.schemesDistribution.length ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.schemesDistribution.map((s) => ({ name: s.schemeCode, value: s.submittedApplications }))}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="value" fill="#087b5d" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No submitted applications yet" />
          )}
        </article>

        <article className="card partner-load">
          <div className="card-head">
            <h2>Partner load</h2>
            <span>Simulated operational metrics</span>
          </div>
          {data.partnerLoad.map((p) => (
            <div key={p.name}>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.activeAssignments}/{p.capacity} · {p.status}/{p.authorization}
                </small>
              </span>
              <div className="load-bar">
                <i style={{ width: `${Math.min(100, p.utilisationPct)}%` }} />
              </div>
              <b>{p.utilisationPct}%</b>
            </div>
          ))}
        </article>

        <article className="card rejection-chart">
          <div className="card-head">
            <h2>Documents needing changes</h2>
          </div>
          {data.documentChangesRequested.length ? (
            data.documentChangesRequested.map((d) => (
              <div className="reason" key={d.type}>
                <span>{d.type.replace(/_/g, ' ')}</span>
                <i style={{ width: `${Math.min(100, d.count * 20)}%` }} />
                <b>{d.count}</b>
              </div>
            ))
          ) : (
            <EmptyState title="No documents flagged" />
          )}
        </article>

        <article className="card pie-card">
          <div className="card-head">
            <h2>Pipeline</h2>
          </div>
          <div className="legend" style={{ marginTop: 8 }}>
            {Object.entries(data.applications.statusCounts).map(([k, v]) => (
              <span key={k}>
                <i style={{ background: '#087b5d' }} />
                {STATUS_LABELS[k] ?? k}: {v}
              </span>
            ))}
            <span>
              <i style={{ background: '#62cbb0' }} />
              Approved: {data.pipeline.decisions.approved} · Rejected: {data.pipeline.decisions.rejected}
            </span>
          </div>
        </article>
      </div>

      <article className="card recent-apps">
        <div className="card-head">
          <h2>Applications</h2>
          <div className="sort">
            {['', 'SUBMITTED', 'ASSIGNED', 'UNDER_REVIEW', 'APPROVED'].map((s) => (
              <button key={s || 'all'} className={statusFilter === s ? 'selected' : ''} onClick={() => setStatusFilter(s)}>
                {s ? STATUS_LABELS[s] : 'All'}
              </button>
            ))}
          </div>
        </div>
        {apps.isLoading ? (
          <Loading />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Scheme</th>
                <th>Requested</th>
                <th>Readiness</th>
                <th>Status</th>
                <th>Partner</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(apps.data?.items ?? []).map((a) => (
                <tr key={a.id}>
                  <td>
                    <b>{a.reference}</b>
                  </td>
                  <td>{a.schemeCode}</td>
                  <td>{formatPaise(a.financingSnapshot?.requestedLoanPaise ?? a.financing.requestedLoanPaise)}</td>
                  <td>
                    <b className="score-text">
                      {a.readiness ? `${a.readiness.requiredVerified}/${a.readiness.requiredTotal}` : '—'}
                    </b>
                  </td>
                  <td>
                    <span className="admin-status">{STATUS_LABELS[a.status]}</span>
                  </td>
                  <td>{a.assignedPartnerName ?? '—'}</td>
                  <td>
                    {a.status === 'SUBMITTED' && (
                      <button className="select-route" onClick={() => doAssign(a.id)} disabled={assign.isPending}>
                        Assign <ArrowRight size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </article>
    </>
  );
}
