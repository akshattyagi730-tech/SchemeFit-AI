import { useMemo, useRef, useState } from 'react';
import { Sparkles, FileText, Upload, Check, AlertTriangle, Clock, Download, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useApplication, useDocuments, useUploadDocument } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError, downloadDocument } from '../api/client';
import { useLang, useLabels, type TFn } from '../i18n';
import type { DictKey } from '../i18n/dict';
import type { DocumentInfo, DocTrustLevel, ReadinessLine } from '../api/types';

const STATE_ICON: Record<string, typeof Check> = {
  verified: Check,
  changes_requested: AlertTriangle,
  under_review: Clock,
  uploaded: Clock,
  missing: AlertTriangle,
};

const TRUST_LABEL: Record<DocTrustLevel, DictKey> = {
  issuer_verified: 'auth.issuerVerified',
  e_signed: 'auth.eSigned',
  signed_untrusted: 'auth.signedUntrusted',
  self_signed: 'auth.selfSigned',
  invalid: 'auth.invalidSig',
  unsigned: 'auth.unsigned',
  not_applicable: 'auth.unsigned',
};

function AuthenticityBadge({ doc, t }: { doc: DocumentInfo; t: TFn }) {
  const a = doc.authenticity;
  if (!a || a.method === 'none') return null;
  const strong = a.trustLevel === 'issuer_verified' || a.trustLevel === 'e_signed';
  const bad = a.trustLevel === 'invalid';
  return (
    <span className={`auth-badge ${strong ? 'good' : bad ? 'bad' : 'weak'}`} title={a.summary}>
      {strong ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />} {t(TRUST_LABEL[a.trustLevel])}
    </span>
  );
}

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

  const byType = useMemo(
    () => new Map((data?.documents ?? []).filter((d) => d.current).map((d) => [d.type, d])),
    [data],
  );

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
  const lines = readiness?.lines ?? [];

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

  return (
    <>
      <PageTitle title={t('doc.title')}>{t('doc.intro', { ref: application?.reference ?? '', scheme: application?.scheme?.name ?? '' })}</PageTitle>

      {editable && (
        <div className="inline-callout" style={{ marginBottom: 14 }}>
          <Info size={15} />
          <span>{t('doc.verifyHelp')}</span>
        </div>
      )}

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
          {lines.map((line: ReadinessLine) => {
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
                    {doc && <AuthenticityBadge doc={doc} t={t} />}
                  </b>
                  <small>
                    {L.docState(line.state)}
                    {doc ? ` · v${doc.version} · ${(doc.byteSize / 1024).toFixed(0)} KB` : ''}
                    {doc?.authenticity?.systemVerified ? ` · ${t('auth.autoVerified')}` : ''}
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
