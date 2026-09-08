import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { Scheme } from '../../models/Scheme';
import { CitizenProfile } from '../../models/CitizenProfile';
import { DocumentModel } from '../../models';
import { evaluateEligibility } from '../../domain/eligibility';
import { scoreScheme } from '../../domain/ranking';
import {
  hasCompleteFinancing,
  profileToFacts,
  profileToFinancing,
  schemeToRankable,
  schemeToRuleSet,
} from '../../domain/adapters';
import { serializeScheme } from '../schemes/schemes.serialize';

/**
 * Deterministic recommendation set for the signed-in citizen.
 * Recomputed on every request from the current profile + active schemes, so a
 * profile edit is reflected immediately — without touching submitted
 * applications (which carry their own snapshots).
 */
export async function getRecommendations(req: Request, res: Response): Promise<void> {
  const profile = await CitizenProfile.findOne({ userId: req.auth!.userId });
  if (!profile) throw notFound('Complete your profile first');

  const facts = profileToFacts(profile);
  const financing = profileToFinancing(profile);
  const financingComplete = hasCompleteFinancing(financing);

  const schemes = await Scheme.find({ status: 'active' }).sort({ name: 1 });

  const eligible: unknown[] = [];
  const needsInfo: unknown[] = [];
  const ineligible: unknown[] = [];

  for (const scheme of schemes) {
    const evaluation = evaluateEligibility(schemeToRuleSet(scheme), facts, financing);
    const base = {
      scheme: serializeScheme(scheme),
      eligibility: {
        status: evaluation.status,
        conditions: evaluation.conditions,
        passed: evaluation.passed.map((c) => c.key),
        failed: evaluation.failed.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
        unknown: evaluation.unknown.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
        advisories: evaluation.advisories.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
      },
    };

    if (evaluation.status === 'eligible' && financingComplete) {
      const suitability = scoreScheme(schemeToRankable(scheme), facts, financing);
      eligible.push({ ...base, suitability });
    } else if (evaluation.status === 'ineligible') {
      ineligible.push(base);
    } else {
      // eligible-but-missing-financing also lands here: not a confident claim.
      needsInfo.push(base);
    }
  }

  eligible.sort((a, b) => (b as { suitability: { score: number } }).suitability.score - (a as { suitability: { score: number } }).suitability.score);

  ok(res, {
    generatedAt: new Date().toISOString(),
    profileComplete: financingComplete && !!facts.category && !!facts.purpose,
    counts: { eligible: eligible.length, needsInformation: needsInfo.length, ineligible: ineligible.length },
    eligible,
    needsInformation: needsInfo,
    ineligible,
    notes: [
      'Eligibility is decided by a deterministic rule engine against each scheme’s stored rules. No language model is involved.',
      'Suitability score is a transparent ranking of how well a scheme’s terms fit your inputs — not a loan-approval probability or a sanction.',
      'Seeded schemes are demonstration data (source.demoData = true) and are not a statement of official government policy.',
    ],
  });
}

type DocState = 'missing' | 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
const DOC_STATUS_RANK: Record<string, number> = { verified: 4, under_review: 3, uploaded: 2, changes_requested: 1, missing: 0 };

/**
 * Consolidated document checklist: the de-duplicated UNION of required documents
 * across every scheme the citizen is eligible for or that needs more information
 * (ineligible schemes excluded). Each document is listed once, with which
 * schemes need it and the citizen's current upload status for that type.
 */
export async function getDocumentChecklist(req: Request, res: Response): Promise<void> {
  const profile = await CitizenProfile.findOne({ userId: req.auth!.userId });
  if (!profile) throw notFound('Complete your profile first');

  const facts = profileToFacts(profile);
  const financing = profileToFinancing(profile);
  const schemes = await Scheme.find({ status: 'active' }).sort({ name: 1 });

  const considered: { code: string; name: string; status: 'eligible' | 'needs_information' }[] = [];
  const relevantSchemes: typeof schemes = [];
  for (const scheme of schemes) {
    const evaluation = evaluateEligibility(schemeToRuleSet(scheme), facts, financing);
    if (evaluation.status === 'ineligible') continue;
    relevantSchemes.push(scheme);
    considered.push({ code: scheme.code, name: scheme.name, status: evaluation.status });
  }

  // Current (non-superseded) documents this citizen has uploaded, best status per type.
  const docs = await DocumentModel.find({ ownerUserId: req.auth!.userId, supersededAt: null });
  const statusByType = new Map<string, DocState>();
  for (const d of docs) {
    const existing = statusByType.get(d.type);
    if (!existing || DOC_STATUS_RANK[d.reviewStatus]! > DOC_STATUS_RANK[existing]!) {
      statusByType.set(d.type, d.reviewStatus as DocState);
    }
  }

  const map = new Map<
    string,
    { type: string; label: string; requiredBy: { code: string; name: string }[]; optionalFor: { code: string; name: string }[] }
  >();
  for (const scheme of relevantSchemes) {
    for (const rd of scheme.requiredDocuments) {
      let entry = map.get(rd.type);
      if (!entry) {
        entry = { type: rd.type, label: rd.label, requiredBy: [], optionalFor: [] };
        map.set(rd.type, entry);
      }
      const ref = { code: scheme.code, name: scheme.name };
      if (rd.optional) entry.optionalFor.push(ref);
      else {
        entry.requiredBy.push(ref);
        entry.label = rd.label; // prefer the label from a scheme that treats it as mandatory
      }
    }
  }

  const items = [...map.values()]
    .map((e) => {
      const mandatory = e.requiredBy.length > 0;
      const status: DocState = statusByType.get(e.type) ?? 'missing';
      return {
        type: e.type,
        label: e.label,
        mandatory,
        status,
        provided: status !== 'missing',
        requiredByCount: e.requiredBy.length,
        optionalForCount: e.optionalFor.length,
        requiredBy: e.requiredBy,
        optionalFor: e.optionalFor,
      };
    })
    .sort(
      (a, b) =>
        Number(b.mandatory) - Number(a.mandatory) ||
        b.requiredByCount - a.requiredByCount ||
        a.label.localeCompare(b.label),
    );

  const mandatoryItems = items.filter((i) => i.mandatory);

  ok(res, {
    generatedAt: new Date().toISOString(),
    consideredSchemes: considered,
    summary: {
      consideredSchemeCount: considered.length,
      distinctDocuments: items.length,
      mandatoryDocuments: mandatoryItems.length,
      mandatoryProvided: mandatoryItems.filter((i) => i.provided).length,
      mandatoryVerified: mandatoryItems.filter((i) => i.status === 'verified').length,
    },
    items,
    notes: [
      'This is the union of required documents across every scheme you are eligible for or that needs more information. Ineligible schemes are excluded.',
      'Each document is listed once even if several schemes need it. "Mandatory" means at least one of those schemes requires it (not optional).',
      'Upload status reflects documents already added to any of your applications. Uploading never marks a document verified — a reviewer does that.',
    ],
  });
}
