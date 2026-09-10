import { Scheme } from '../../src/models/Scheme';
import { PartnerOrganization } from '../../src/models/PartnerOrganization';
import { schemes as loanSchemes, partners as demoPartners } from '../../src/seed/fixtures';
import { centralSchemes } from '../../src/seed/central-schemes';

const demoSchemes = [...loanSchemes, ...centralSchemes];

/** Idempotent: safe to call multiple times within one test. */
export async function installDemoSchemes() {
  await Promise.all(
    demoSchemes.map((s) => Scheme.updateOne({ code: s.code }, { $set: s }, { upsert: true })),
  );
}

export async function installDemoPartners() {
  await Promise.all(
    demoPartners.map((p) =>
      PartnerOrganization.updateOne({ name: p.name }, { $set: { ...p, metricsAsOf: new Date() } }, { upsert: true }),
    ),
  );
}

export async function installDemoReferenceData() {
  await installDemoSchemes();
  await installDemoPartners();
}
