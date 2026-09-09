import { useState } from 'react';
import { FileText, Check, Clock, AlertTriangle, ChevronDown, FolderCheck } from 'lucide-react';
import { useDocumentChecklist } from '../api/hooks';
import { useLang, useLabels } from '../i18n';
import { Loading, ErrorState, EmptyState } from './ui';

const STATE_ICON: Record<string, typeof Check> = {
  verified: Check,
  changes_requested: AlertTriangle,
  under_review: Clock,
  uploaded: Clock,
  missing: AlertTriangle,
};

export function DocumentChecklist({ compact = false }: { compact?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useDocumentChecklist();
  const { t } = useLang();
  const L = useLabels();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <Loading label={t('dc.building')} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  if (data.items.length === 0) {
    return <EmptyState title={t('dc.empty')} hint={t('dc.emptyHint')} />;
  }

  const s = data.summary;

  return (
    <article className="card doc-checklist">
      <div className="card-head">
        <div className="title-icon">
          <FolderCheck />
          <div>
            <h2>{t('dc.title')}</h2>
            <p>{t('dc.sub', { n: s.consideredSchemeCount })}</p>
          </div>
        </div>
        <span className="checklist-progress">
          {t('dc.progress', { provided: s.mandatoryProvided, total: s.mandatoryDocuments, verified: s.mandatoryVerified })}
        </span>
      </div>

      <div className="checklist-rows">
        {data.items.map((it) => {
          const Icon = STATE_ICON[it.status] ?? Clock;
          const open = expanded === it.type;
          const count = it.requiredByCount || it.optionalForCount;
          return (
            <div className={`checklist-row ${it.status}`} key={it.type}>
              <span className="doc-icon">
                <FileText size={15} />
              </span>
              <div className="checklist-main">
                <b>
                  {it.label}
                  {it.mandatory ? <span className="tag req">{t('dc.mandatory')}</span> : <span className="tag opt">{t('dc.optional')}</span>}
                </b>
                <button className="auth-switch" onClick={() => setExpanded(open ? null : it.type)}>
                  {t('dc.neededBy', { n: count })}
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
                        {x.name} ({t('common.optional')})
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {it.status !== 'missing' && (
                <span className={`case-doc-status ${it.status === 'verified' ? 'ok' : 'wait'}`}>
                  <Icon size={13} /> {L.docState(it.status)}
                </span>
              )}
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
