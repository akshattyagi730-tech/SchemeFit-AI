import { useRef, useState } from 'react';
import { Sparkles, FileText, Upload, Check, AlertTriangle, Clock, Download } from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useApplication, useDocuments, useUploadDocument } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError, downloadDocument } from '../api/client';
import { DOC_STATE_LABELS } from '../lib/format';
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
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (appsLoading || isLoading) return <Loading label="Loading your documents…" />;
  if (!activeId)
    return (
      <>
        <PageTitle title="Documents">
          Start an application to upload and track documents. Meanwhile, here is everything your matched schemes ask for.
        </PageTitle>
        <DocumentChecklist />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>Go to Scheme Matches</Button>
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
      toast('Document uploaded and sent for review. It is not verified yet.');
    } catch (err) {
      if (err instanceof ApiError) errorToast(err.message);
      else errorToast('Upload failed. Nothing was saved — please retry.');
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
      errorToast('Could not download this document.');
    }
  }

  const byType = new Map(data.documents.filter((d) => d.current).map((d) => [d.type, d]));

  return (
    <>
      <PageTitle title="Documents">
        {application?.reference} · {application?.scheme?.name}. Readiness is computed on the server from this scheme’s
        required documents.
      </PageTitle>
      <div className="documents-layout">
        <article className="card document-score">
          <ScoreRing score={readiness?.verifiedPct ?? 0} label="/100" />
          <h2>Application Readiness</h2>
          <p>
            {readiness?.requiredVerified ?? 0} of {readiness?.requiredTotal ?? 0} required documents verified ·{' '}
            {readiness?.requiredSubmitted ?? 0} submitted.
            {readiness?.changesRequested ? ` ${readiness.changesRequested} need changes.` : ''}
          </p>
          <div className="ai">
            <Sparkles size={14} /> Submitted and verified are counted separately. Optional documents don’t affect this
            percentage.
          </div>
        </article>

        <article className="card docs-card">
          <div className="card-head">
            <h2>Required documents</h2>
            <small>
              {readiness?.requiredVerified ?? 0} verified · {readiness?.requiredTotal ?? 0} required
            </small>
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
                    {line.optional ? ' (optional)' : ''}
                  </b>
                  <small>
                    {DOC_STATE_LABELS[line.state]}
                    {doc ? ` · v${doc.version} · ${(doc.byteSize / 1024).toFixed(0)} KB` : ''}
                    {doc?.reviewFeedback && line.state === 'changes_requested' ? ` — “${doc.reviewFeedback}”` : ''}
                  </small>
                </div>
                <span className={`case-doc-status ${line.state === 'verified' ? 'ok' : line.state === 'missing' ? 'miss' : 'wait'}`}>
                  <Icon size={13} /> {DOC_STATE_LABELS[line.state]}
                </span>
                {doc && (
                  <button className="upload" onClick={() => download(doc)} title="Download (authenticated)">
                    <Download size={15} />
                  </button>
                )}
                {editable && (
                  <button
                    className="upload upload-drop"
                    onClick={() => fileInputs.current[line.type]?.click()}
                    disabled={isUploading}
                  >
                    <Upload size={15} /> {isUploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}
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
          <p className="inline-note">
            Accepted: PDF, JPEG, PNG. File contents are checked against the declared type. Replacing a document creates a
            new version and its previous review no longer counts.
          </p>
        </article>
      </div>
    </>
  );
}
