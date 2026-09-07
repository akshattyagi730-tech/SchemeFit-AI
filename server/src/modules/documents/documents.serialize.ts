import type { DocumentDoc } from '../../models/Document';

/** Never exposes the storage key or raw bytes. */
export function serializeDocument(d: DocumentDoc) {
  const o = d.toObject();
  return {
    id: String(o._id),
    applicationId: String(o.applicationId),
    type: o.type,
    label: o.label,
    version: o.version,
    current: o.supersededAt == null,
    supersededAt: o.supersededAt ?? null,
    originalFilename: o.originalFilename,
    contentType: o.contentType,
    byteSize: o.byteSize,
    sha256: o.sha256,
    reviewStatus: o.reviewStatus,
    reviewFeedback: o.reviewFeedback,
    reviewedAt: o.reviewedAt ?? null,
    reviewHistory: (o.reviewHistory ?? []).map((r) => ({ status: r.status, feedback: r.feedback, at: r.at })),
    downloadUrl: `/api/v1/documents/${String(o._id)}/download`,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}
