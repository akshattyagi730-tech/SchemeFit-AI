import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, FileText, Upload, Check, AlertTriangle, Clock, Download, ShieldCheck, ShieldAlert, X,
} from 'lucide-react';
import { PageTitle, Button, ScoreRing, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import {
  useApplication,
  useDocuments,
  useUploadDocument,
  useDigiLockerStatus,
  useDigiLockerConnect,
  useDigiLockerDisconnect,
  useDigiLockerIssued,
  useDigiLockerImport,
} from '../api/hooks';
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
  if (doc.source === 'digilocker') {
    return (
      <span className="auth-badge good" title={doc.issuedBy ?? undefined}>
        <ShieldCheck size={12} /> {t('auth.viaDigilocker')}
      </span>
    );
  }
  if (!a || a.method === 'none') return null;
  const strong = a.trustLevel === 'issuer_verified' || a.trustLevel === 'e_signed';
  const bad = a.trustLevel === 'invalid';
  return (
    <span className={`auth-badge ${strong ? 'good' : bad ? 'bad' : 'weak'}`} title={a.summary}>
      {strong ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />} {t(TRUST_LABEL[a.trustLevel])}
    </span>
  );
}

function DigiLockerPanel({ appId, lines, t }: { appId: string; lines: ReadinessLine[]; t: TFn }) {
  const status = useDigiLockerStatus();
  const connect = useDigiLockerConnect();
  const disconnect = useDigiLockerDisconnect();
  const [open, setOpen] = useState(false);
  const issued = useDigiLockerIssued(open);
  const importDoc = useDigiLockerImport(appId);
  const { toast, errorToast } = useToast();
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Set<string>>(new Set());

  const connected = status.data?.connected ?? false;
  const slotLabel = new Map(lines.map((l) => [l.type, l.label]));

  async function runImport(uri: string, docType: string) {
    if (!docType) return;
    try {
      await importDoc.mutateAsync({ uri, docType });
      setDone((s) => new Set(s).add(uri));
      toast(t('dl.importedToast'));
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : t('doc.uploadFailToast'));
    }
  }

  return (
    <div className="dl-panel">
      <div className="dl-panel-main">
        <ShieldCheck size={20} />
        <div>
          <b>{t('dl.panelTitle')}</b>
          <span>
            {connected && status.data?.name ? t('dl.connectedAs', { name: status.data.name }) : t('dl.panelIntro')}
          </span>
          {status.data?.provider === 'mock' && <small>{t('dl.mockNote')}</small>}
        </div>
        <div className="dl-panel-actions">
          {connected ? (
            <>
              <Button onClick={() => setOpen(true)}>{t('dl.importDocs')}</Button>
              <button className="auth-switch" onClick={() => disconnect.mutate()}>
                {t('dl.disconnect')}
              </button>
            </>
          ) : (
            <Button onClick={() => connect.mutate()} loading={connect.isPending}>
              {connect.isPending ? t('dl.connecting') : t('dl.connect')}
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div className="modal-wrap" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}>
              <X />
            </button>
            <h2>{t('dl.modalTitle')}</h2>
            <p>{t('dl.modalIntro')}</p>
            {issued.isLoading && <Loading label={t('common.loading')} />}
            {issued.data && (
              <div className="dl-issued-list">
                {lines.length === 0 && <p className="inline-note">{t('dl.noneRelevant')}</p>}
                {issued.data.documents.map((d) => {
                  const imported = done.has(d.uri);
                  const suggested = d.mapsTo && slotLabel.has(d.mapsTo) ? d.mapsTo : '';
                  const picked = choice[d.uri] ?? suggested;
                  return (
                    <div className="dl-issued-row" key={d.uri}>
                      <FileText size={16} />
                      <div className="dl-issued-info">
                        <b>{d.name}</b>
                        <small>{t('dl.issuedBy', { issuer: d.issuer })}</small>
                      </div>
                      {imported ? (
                        <span className="auth-badge good">
                          <Check size={12} /> {t('dl.imported')}
                        </span>
                      ) : (
                        <>
                          <select
                            value={picked}
                            onChange={(e) => setChoice((c) => ({ ...c, [d.uri]: e.target.value }))}
                          >
                            <option value="">{t('dl.chooseSlot')}</option>
                            {lines.map((l) => (
                              <option key={l.type} value={l.type}>
                                {l.label}
                              </option>
                            ))}
                          </select>
                          <button
                            className="button"
                            disabled={!picked || importDoc.isPending}
                            onClick={() => runImport(d.uri, picked)}
                          >
                            {importDoc.isPending ? t('dl.importing') : t('dl.import')}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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

  // Return from the DigiLocker OAuth redirect.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dl = params.get('digilocker');
    if (!dl) return;
    if (dl === 'connected') toast(t('dl.connectedToast'));
    else if (dl === 'error') errorToast(t('dl.errorToast'));
    params.delete('digilocker');
    params.delete('reason');
    const qs = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (qs ? `?${qs}` : ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {editable && <DigiLockerPanel appId={activeId} lines={lines} t={t} />}

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
