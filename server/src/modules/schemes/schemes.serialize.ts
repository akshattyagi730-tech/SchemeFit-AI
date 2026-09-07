import type { SchemeDoc } from '../../models/Scheme';

export function serializeScheme(s: SchemeDoc) {
  const o = s.toObject();
  return {
    id: String(o._id),
    code: o.code,
    name: o.name,
    provider: o.provider,
    program: o.program,
    displayCategory: o.displayCategory,
    description: o.description,
    supportedPurposes: o.supportedPurposes,
    eligibility: {
      categories: o.eligibility?.categories ?? null,
      minAge: o.eligibility?.minAge ?? null,
      maxAge: o.eligibility?.maxAge ?? null,
      minAnnualIncomePaise: o.eligibility?.minAnnualIncomePaise ?? null,
      maxAnnualIncomePaise: o.eligibility?.maxAnnualIncomePaise ?? null,
      location: {
        states: o.eligibility?.location?.states ?? null,
        districts: o.eligibility?.location?.districts ?? null,
        areaTypes: o.eligibility?.location?.areaTypes ?? null,
      },
      requiresBusinessPlan: !!o.eligibility?.requiresBusinessPlan,
    },
    financing: o.financing,
    terms: o.terms,
    requiredDocuments: o.requiredDocuments,
    source: {
      url: o.source?.url ?? '',
      verificationDate: o.source?.verificationDate ?? null,
      effectiveFrom: o.source?.effectiveFrom ?? null,
      effectiveTo: o.source?.effectiveTo ?? null,
      version: o.source?.version ?? 'demo-1',
      demoData: o.source?.demoData ?? true,
    },
    // Explicit, machine-readable label so the UI can badge unverified rules.
    dataClassification: o.source?.demoData ? 'demonstration-data' : 'verified',
    status: o.status,
    updatedAt: o.updatedAt,
  };
}
