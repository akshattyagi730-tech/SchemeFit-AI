import { DocumentModel } from '../../models/Document';
import type { SchemeDoc } from '../../models/Scheme';
import { computeReadiness, type CurrentDoc, type ReadinessResult } from '../../domain/readiness';

/**
 * Compute document readiness for an application from the SELECTED SCHEME's
 * required-document list and the current (non-superseded) uploaded versions.
 * This is the single source used by dashboard counts, the citizen document
 * screen, the partner review view and the application timeline.
 */
export async function readinessForApplication(applicationId: string, scheme: SchemeDoc): Promise<ReadinessResult> {
  const docs = await DocumentModel.find({ applicationId, supersededAt: null }).lean();
  const current: CurrentDoc[] = docs.map((d) => ({
    type: d.type,
    reviewStatus: d.reviewStatus as CurrentDoc['reviewStatus'],
  }));
  return computeReadiness(
    (scheme.requiredDocuments ?? []).map((r) => ({ type: r.type, label: r.label, optional: r.optional })),
    current,
  );
}
