import { useState } from 'react';
import { FileText, Check, Clock, AlertTriangle, ChevronDown, FolderCheck } from 'lucide-react';
import { useDocumentChecklist } from '../api/hooks';
import { DOC_STATE_LABELS } from '../lib/format';
import { Loading, ErrorState, EmptyState } from './ui';

const STATE_ICON: Record<string, typeof Check> = {
  verified: Check,
  changes_requested: AlertTriangle,
  under_review: Clock,
  uploaded: Clock,
  missing: AlertTriangle,
};

/**
 * The de-duplicated union of documents needed across every scheme the citizen is
 * eligible for or that needs more information. Server-computed.
 */
export function DocumentChecklist({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useDocumentChecklist();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <Loading label="Building your document checklist…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return (
      <EmptyState
        title="No document checklist yet"
        hint="Complete your profile so the rule engine can match schemes and list what they ask for."
      />
    );
  }

  const s = data.summary;

  return (
    <article className="card doc-checklist">
      <div className="card-head">
        <div className="title-icon">
          <FolderCheck />
          <div>
            <h2>Documents you’ll need</h2>
            <p>
              Combined from {s.consideredSchemeCount} matched scheme{s.consideredSchemeCount === 1 ? '' : 's'} · listed once
              even if several schemes ask for it.
            </p>
          </div>
        </div>
        <span className="checklist-progress">
          {s.mandatoryProvided}/{s.mandatoryDocuments} mandatory added · {s.mandatoryVerified} verified
        </span>
      </div>

      <div className="checklist-rows">
        {data.items.map((it) => {
          const Icon = STATE_ICON[it.status] ?? Clock;
          const open = expanded === it.type;
          return (
            <div className={`checklist-row ${it.status}`} key={it.type}>
              <span className="doc-icon">
                <FileText size={15} />
              </span>
              <div className="checklist-main">
                <b>
                  {it.label}
                  {it.mandatory ? (
                    <span className="tag req">Mandatory</span>
                  ) : (
                    <span className="tag opt">Optional</span>
                  )}
                </b>
                <button className="auth-switch" onClick={() => setExpanded(open ? null : it.type)}>
                  Needed by {it.requiredByCount || it.optionalForCount} scheme
                  {(it.requiredByCount || it.optionalForCount) === 1 ? '' : 's'}
                  <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : undefined }} />
                </button>
                {open && (
                  <div className="checklist-schemes">
                    {it.requiredBy.map((x) => (
                      <span key={x.code} className="pill req">
                        {x.name}
                      </span>
                    ))}
                    {it.optionalFor.map((x) => (
                      <span key={x.code} className="pill opt">
                        {x.name} (optional)
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className={`case-doc-status ${it.status === 'verified' ? 'ok' : it.status === 'missing' ? 'miss' : 'wait'}`}>
                <Icon size={13} /> {DOC_STATE_LABELS[it.status]}
              </span>
            </div>
          );
        })}
      </div>

      {!compact && (
        <p className="inline-note">
          {data.notes.map((n, i) => (
            <span key={i}>
              {n}
              <br />
            </span>
          ))}
        </p>
      )}
    </article>
  );
}
