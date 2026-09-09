import { useRef, useState } from 'react';
import { Sparkles, FileText, Upload, Check, AlertTriangle, Clock, Download } from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useApplication, useDocuments, useUploadDocument } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError, downloadDocument } from '../api/client';
import { useLang, useLabels } from '../i18n';
import type { DocumentInfo, ReadinessLine } from '../api/types';

const STATE_ICON: Record<string, typeof Check> = {
  verified: Check,
  changes_requested: AlertTriangle,
  under_review: Clock,
  uploaded: Clock,
  missing: AlertTriangle,
};

export function Documents({ navigate }: { navigate: (to: string) => void }) {
  const { activeId, isLoading: appsLoading } = useActiveApplication();
  const { data: application } = useApplication(activeId ?? undefined);
  // Poll while this screen is open so a partner's review shows up without a manual refresh.
  const { data, isLoading, isError, error, refetch } = useDocuments(activeId ?? undefined, true);
  const upload = useUploadDocument(activeId ?? '');
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const L = useLabels();
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (appsLoading || isLoading) return <Loading label={t('doc.loading')} />;
  if (!activeId)
    return (
      <>
        <PageTitle title={t('doc.title')}>{t('doc.introNoApp')}</PageTitle>
        <DocumentChecklist />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>{t('pr.goToSchemeMatches')}</Button>
        </div>
      </>
    );
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data) return null;

  const readiness = data.readiness;
  const editable = application?.status !== 'APPROVED' && application?.status !== 'REJECTED';

  async function pick(type: string, file: File | undefined) {
    if (!file) return;
    setUploadingType(type);
    try {
      await upload.mutateAsync({ file, type });
      toast(t('doc.uploadedToast'));
    } catch (err) {
      if (err instanceof ApiError) errorToast(err.message);
      else errorToast(t('doc.uploadFailToast'));
    } finally {
      setUploadingType(null);
    }
  }

  async function download(doc: DocumentInfo) {
    try {
      const { url, filename } = await downloadDocument(doc.id);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      errorToast(t('doc.downloadFailToast'));
    }
  }

  const byType = new Map(data.documents.filter((d) => d.current).map((d) => [d.type, d]));

  return (
    <>
      <PageTitle title={t('doc.title')}>{t('doc.intro', { ref: application?.reference ?? '', scheme: application?.scheme?.name ?? '' })}</PageTitle>
      <div className="documents-layout">
        <article className="card document-score">
          <ScoreRing score={readiness?.verifiedPct ?? 0} label="/100" />
          <h2>{t('doc.readiness')}</h2>
          <p>
            {t('doc.readinessLine', { v: readiness?.requiredVerified ?? 0, t: readiness?.requiredTotal ?? 0, s: readiness?.requiredSubmitted ?? 0 })}
            {readiness?.changesRequested ? ` ${t('doc.needChanges', { n: readiness.changesRequested })}` : ''}
          </p>
          <div className="ai">
            <Sparkles size={14} /> {t('doc.countNote')}
          </div>
        </article>

        <article className="card docs-card">
          <div className="card-head">
            <h2>{t('doc.required')}</h2>
            <small>{t('doc.verifiedOfRequired', { v: readiness?.requiredVerified ?? 0, t: readiness?.requiredTotal ?? 0 })}</small>
          </div>
          {(readiness?.lines ?? []).map((line: ReadinessLine) => {
            const doc = byType.get(line.type);
            const Icon = STATE_ICON[line.state] ?? Clock;
            const isUploading = uploadingType === line.type;
            return (
              <div className="document-row" key={line.type}>
                <span className="doc-icon">
                  <FileText />
                </span>
                <div>
                  <b>
                    {line.label}
                    {line.optional ? ` (${t('common.optional')})` : ''}
                  </b>
                  <small>
                    {L.docState(line.state)}
                    {doc ? ` · v${doc.version} · ${(doc.byteSize / 1024).toFixed(0)} KB` : ''}
                    {doc?.reviewFeedback && line.state === 'changes_requested' ? ` — “${doc.reviewFeedback}”` : ''}
                  </small>
                </div>
                <span className={`case-doc-status ${line.state === 'verified' ? 'ok' : line.state === 'missing' ? 'miss' : 'wait'}`}>
                  <Icon size={13} /> {L.docState(line.state)}
                </span>
                {doc && (
                  <button className="upload" onClick={() => download(doc)} title={t('doc.download')}>
                    <Download size={15} />
                  </button>
                )}
                {editable && (
                  <button
                    className="upload upload-drop"
                    onClick={() => fileInputs.current[line.type]?.click()}
                    disabled={isUploading}
                  >
                    <Upload size={15} /> {isUploading ? t('doc.uploading') : doc ? t('doc.replace') : t('doc.upload')}
                    <input
                      ref={(el) => {
                        fileInputs.current[line.type] = el;
                      }}
                      type="file"
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => {
                        pick(line.type, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </button>
                )}
              </div>
            );
          })}
          <p className="inline-note">{t('doc.uploadNote')}</p>
        </article>
      </div>
    </>
  );
}
