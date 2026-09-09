/**
 * Deterministic development fixtures. Everything here is DEMONSTRATION DATA:
 *  - scheme rule sets carry source.demoData = true and are NOT official policy.
 *    Numeric limits, rates, tenures and eligibility bands are ILLUSTRATIVE and
 *    approximate. `source.url` points to the official scheme page so the real
 *    parameters can be verified and entered later (`verificationDate` stays null
 *    until that happens).
 *  - partner operational metrics are simulated,
 *  - citizen records and documents are synthetic (no real personal data).
 *
 * The app is about entrepreneurship + education/skilling finance. Pure consumer
 * credit (home / vehicle / personal loans) is a different product and is out of
 * scope for this prototype.
 */
import { rupeesToPaise } from '../lib/money';

export const DEMO_SOURCE = (url = '', version = 'demo-2026-09') => ({
  url,
  verificationDate: null, // set this once the rule set has been checked against `url`
  effectiveFrom: null,
  effectiveTo: null,
  version,
  demoData: true,
});

const R = rupeesToPaise;
const pct = (bps: number) => bps; // basis points helper for readability: 700 = 7.00%

export const schemes = [
  // ─────────────────────────────────────────────────────────────────────────
  // A. PRADHAN MANTRI MUDRA YOJANA (PMMY) — collateral-free micro credit
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'PMMY-SHISHU',
    name: 'MUDRA Loan — Shishu',
    provider: 'Member Lending Institutions under PMMY',
    program: 'Pradhan Mantri Mudra Yojana (PMMY) — Shishu — demonstration rule set',
    displayCategory: 'Micro Credit',
    description:
      'Smallest MUDRA tier: collateral-free finance for very small / nano enterprises just starting out. Open to all categories. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'working_capital', 'equipment_purchase'],
    eligibility: { minAge: 18, maxAge: 65 },
    financing: { minAmountPaise: R(1_000), maxAmountPaise: R(50_000), maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(1000), maxInterestRateBps: pct(1600),
      minTenureMonths: 12, maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)' },
      { type: 'business_proof', label: 'Business activity proof', optional: true },
    ],
    source: DEMO_SOURCE('https://www.mudra.org.in/'),
    status: 'active',
  },
  {
    code: 'PMMY-KISHOR',
    name: 'MUDRA Loan — Kishor',
    provider: 'Member Lending Institutions under PMMY',
    program: 'Pradhan Mantri Mudra Yojana (PMMY) — Kishor — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Mid MUDRA tier: collateral-free working-capital / term finance for micro enterprises in manufacturing, trading and services. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: false },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(5_00_000), maxProjectCostSharePct: 85, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(950), maxInterestRateBps: pct(1250),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
      { type: 'business_proof', label: 'Business registration / proof' },
      { type: 'quotation', label: 'Quotation / project report', optional: true },
    ],
    source: DEMO_SOURCE('https://www.mudra.org.in/'),
    status: 'active',
  },
  {
    code: 'PMMY-TARUN',
    name: 'MUDRA Loan — Tarun',
    provider: 'Member Lending Institutions under PMMY',
    program: 'Pradhan Mantri Mudra Yojana (PMMY) — Tarun — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Top MUDRA tier: collateral-free finance for established micro units scaling up. Demonstration figures only.',
    supportedPurposes: ['business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(5_00_000), maxAmountPaise: R(10_00_000), maxProjectCostSharePct: 80, minOwnContributionPct: 15 },
    terms: {
      minInterestRateBps: pct(950), maxInterestRateBps: pct(1300),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 3, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
      { type: 'business_proof', label: 'Business registration / Udyam' },
      { type: 'project_report', label: 'Project report' },
    ],
    source: DEMO_SOURCE('https://www.mudra.org.in/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // B. CENTRAL EMPLOYMENT-GENERATION / ENTERPRISE SCHEMES
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'PMEGP',
    name: "Prime Minister's Employment Generation Programme",
    provider: 'KVIC (nodal), routed via banks / KVIB / DIC',
    program: 'PMEGP margin-money scheme — demonstration rule set',
    displayCategory: 'Enterprise Setup',
    description:
      'Credit-linked subsidy (margin money) for setting up new micro enterprises in manufacturing or service. Requires a project report. Demonstration figures only.',
    supportedPurposes: ['business_new', 'equipment_purchase'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(25_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(1050), maxInterestRateBps: pct(1250),
      minTenureMonths: 36, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'project_report', label: 'Detailed project report' },
      { type: 'education_proof', label: 'Education proof (if project > threshold)', optional: true },
      { type: 'caste_certificate', label: 'Category certificate (for higher subsidy)', optional: true },
    ],
    source: DEMO_SOURCE('https://www.kviconline.gov.in/pmegpeportal/'),
    status: 'active',
  },
  {
    code: 'STANDUP-INDIA',
    name: 'Stand-Up India',
    provider: 'Scheduled commercial banks (SIDBI as nodal)',
    program: 'Stand-Up India — demonstration rule set',
    displayCategory: 'Enterprise Setup',
    description:
      'Bank loans for GREENFIELD (first-time) enterprises. Targeted at Scheduled Caste / Scheduled Tribe and women entrepreneurs — the category rule here models SC/ST only; the women pathway is not represented because this prototype has no gender field. Demonstration figures only.',
    supportedPurposes: ['business_new'],
    eligibility: { categories: ['SC', 'ST'], minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(10_00_000), maxAmountPaise: R(1_00_00_000), maxProjectCostSharePct: 85, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(900), maxInterestRateBps: pct(1150),
      minTenureMonths: 60, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 18, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'caste_certificate', label: 'Caste certificate (SC/ST)' },
      { type: 'project_report', label: 'Detailed project report' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE('https://www.standupmitra.in/'),
    status: 'active',
  },
  {
    code: 'PM-SVANIDHI',
    name: 'PM Street Vendor’s AtmaNirbhar Nidhi (PM SVANidhi)',
    provider: 'MoHUA — banks, SFBs, NBFC-MFIs, SHG banks',
    program: 'PM SVANidhi working-capital ladder — demonstration rule set',
    displayCategory: 'Working Capital',
    description:
      'Collateral-free working-capital loan for URBAN street vendors, in a ladder: first ₹10,000, then ₹20,000, then ₹50,000 on timely repayment. Demonstration figures only.',
    supportedPurposes: ['working_capital', 'business_expansion'],
    eligibility: { minAge: 18, maxAge: 70, location: { areaTypes: ['urban', 'semi_urban'] } },
    financing: { minAmountPaise: R(10_000), maxAmountPaise: R(50_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(700), maxInterestRateBps: pct(1200),
      minTenureMonths: 12, maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'vending_certificate', label: 'Certificate of Vending / letter of recommendation' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)', optional: true },
    ],
    source: DEMO_SOURCE('https://pmsvanidhi.mohua.gov.in/'),
    status: 'active',
  },
  {
    code: 'CGTMSE-CREDIT',
    name: 'Collateral-free MSE Credit (CGTMSE-backed)',
    provider: 'Member banks / NBFCs under the CGTMSE guarantee',
    program: 'Credit Guarantee Fund Trust for Micro & Small Enterprises — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Term / working-capital credit to micro & small enterprises WITHOUT third-party collateral, backed by a guarantee cover. Demonstration figures only (real cover extends much higher).',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(50_00_000), maxProjectCostSharePct: 85, minOwnContributionPct: 15 },
    terms: {
      minInterestRateBps: pct(1000), maxInterestRateBps: pct(1400),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'business_proof', label: 'Udyam registration' },
      { type: 'project_report', label: 'Project report / financials' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE('https://www.cgtmse.in/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // C. SOCIAL-CATEGORY DEVELOPMENT CORPORATIONS (concessional term loans)
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'NSFDC-TL',
    name: 'NSFDC Term Loan',
    provider: 'National Scheduled Castes Finance & Development Corporation (via SCAs)',
    program: 'NSFDC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional term finance routed through State Channelising Agencies for Scheduled Caste entrepreneurs below a household income ceiling. A DISTINCT scheme from PMMY / MUDRA — different eligibility, limits and rate. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
    eligibility: { categories: ['SC'], minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(30_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(600), maxInterestRateBps: pct(800),
      minTenureMonths: 24, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'caste_certificate', label: 'Caste certificate (SC)' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
      { type: 'project_report', label: 'Detailed project report / business plan' },
    ],
    source: DEMO_SOURCE('https://nsfdc.nic.in/'),
    status: 'active',
  },
  {
    code: 'NBCFDC-TL',
    name: 'NBCFDC Term Loan',
    provider: 'National Backward Classes Finance & Development Corporation (via SCAs)',
    program: 'NBCFDC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional term finance for Other Backward Classes entrepreneurs below a household income ceiling, routed via State Channelising Agencies. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
    eligibility: { categories: ['OBC'], minAge: 18, maxAge: 55, maxAnnualIncomePaise: R(3_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(15_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(600), maxInterestRateBps: pct(900),
      minTenureMonths: 24, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'caste_certificate', label: 'OBC certificate' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'project_report', label: 'Project report' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE('https://nbcfdc.gov.in/'),
    status: 'active',
  },
  {
    code: 'NMDFC-TL',
    name: 'NMDFC Term Loan',
    provider: 'National Minorities Development & Finance Corporation (via SCAs)',
    program: 'NMDFC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional finance for entrepreneurs from notified minority communities below an income ceiling, routed via State Channelising Agencies. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { categories: ['MINORITY'], minAge: 18, maxAge: 55, maxAnnualIncomePaise: R(6_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(20_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(600), maxInterestRateBps: pct(800),
      minTenureMonths: 24, maxTenureMonths: 96,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'minority_declaration', label: 'Minority community declaration / certificate' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'project_report', label: 'Project report' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE('https://nmdfc.org/'),
    status: 'active',
  },
  {
    code: 'NHFDC-TL',
    name: 'NDFDC / NHFDC Term Loan (Persons with Disabilities)',
    provider: 'National Divyangjan Finance & Development Corporation (via SCAs)',
    program: 'NHFDC/NDFDC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional self-employment finance for persons with benchmark disabilities. Disability status is NOT part of the profile model in this prototype, so no eligibility rule enforces it here — treat this scheme as informational. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'skilling'],
    eligibility: { minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(15_00_000), maxProjectCostSharePct: 95, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(500), maxInterestRateBps: pct(800),
      minTenureMonths: 24, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'disability_certificate', label: 'Disability certificate (UDID)' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'project_report', label: 'Project report' },
    ],
    source: DEMO_SOURCE('https://ndfdc.nic.in/'),
    status: 'active',
  },
  {
    code: 'PM-VISHWAKARMA',
    name: 'PM Vishwakarma — Credit Support',
    provider: 'MoMSME — public sector banks, RRBs, SFBs',
    program: 'PM Vishwakarma enterprise development loan — demonstration rule set',
    displayCategory: 'Artisan Credit',
    description:
      'Collateral-free credit for registered traditional artisans and craftspeople (18 listed trades) in two tranches (first ₹1 lakh, then ₹2 lakh) at a concessional fixed rate. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 70 },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(3_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(500), maxInterestRateBps: pct(500),
      minTenureMonths: 18, maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'vishwakarma_certificate', label: 'PM Vishwakarma registration certificate' },
      { type: 'trade_certificate', label: 'Skill / trade recognition', optional: true },
    ],
    source: DEMO_SOURCE('https://pmvishwakarma.gov.in/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // D. WOMEN ENTREPRENEURS
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'MAHILA-UDYAM',
    name: 'Mahila Udyam Nidhi (Women Enterprise Finance)',
    provider: 'SIDBI-refinanced banks / SFBs',
    program: 'Women entrepreneur term loan — demonstration rule set',
    displayCategory: 'Women Enterprise',
    description:
      'Term finance for enterprises owned and controlled by women. Gender is not part of the profile model in this prototype, so no eligibility rule enforces it here — treat as informational. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(10_00_000), maxProjectCostSharePct: 85, minOwnContributionPct: 15 },
    terms: {
      minInterestRateBps: pct(850), maxInterestRateBps: pct(1200),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'business_proof', label: 'Enterprise ownership proof' },
      { type: 'project_report', label: 'Project report' },
    ],
    source: DEMO_SOURCE('https://www.sidbi.in/'),
    status: 'active',
  },
  {
    code: 'ANNAPURNA',
    name: 'Annapurna Scheme (Women — Food Catering)',
    provider: 'Public sector banks',
    program: 'Annapurna food-catering micro loan — demonstration rule set',
    displayCategory: 'Women Enterprise',
    description:
      'Small loan for women setting up a food-catering / tiffin unit, to buy utensils, a gas connection, a mixer-grinder, a hot case, etc. Demonstration figures only.',
    supportedPurposes: ['business_new', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000) },
    financing: { minAmountPaise: R(5_000), maxAmountPaise: R(50_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(1100), maxInterestRateBps: pct(1300),
      minTenureMonths: 12, maxTenureMonths: 36,
      moratorium: { allowed: true, maxMonths: 1, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'quotation', label: 'Quotation for utensils / equipment' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)', optional: true },
    ],
    source: DEMO_SOURCE('https://www.myscheme.gov.in/schemes/as'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // E. EDUCATION & SKILLING
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'EDU-SKILL',
    name: 'Skill & Education Finance',
    provider: 'Partner banks (education finance vertical)',
    program: 'Skilling and education loan — demonstration rule set',
    displayCategory: 'Education Loan',
    description: 'General-purpose finance for certified skilling programmes and formal education, with a study-period moratorium.',
    supportedPurposes: ['education', 'skilling'],
    eligibility: { minAge: 17, maxAge: 45 },
    financing: { minAmountPaise: R(25_000), maxAmountPaise: R(7_50_000), maxProjectCostSharePct: 95, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(800), maxInterestRateBps: pct(1100),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'capitalised', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Admission / enrolment letter' },
      { type: 'fee_schedule', label: 'Course fee schedule' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)', optional: true },
    ],
    source: DEMO_SOURCE('https://www.vidyalakshmi.co.in/'),
    status: 'active',
  },
  {
    code: 'EDU-VIDYALAKSHMI',
    name: 'Education Loan (Model Scheme via Vidya Lakshmi)',
    provider: 'Scheduled banks on the Vidya Lakshmi portal',
    program: 'IBA Model Education Loan Scheme — demonstration rule set',
    displayCategory: 'Education Loan',
    description:
      'Loan for higher education in India or abroad; collateral-free up to the demonstration ceiling. Repayment begins after the course plus a grace period (moratorium); interest accrued during the moratorium is capitalised. Demonstration figures only.',
    supportedPurposes: ['education'],
    eligibility: { minAge: 16, maxAge: 35 },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(7_50_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(850), maxInterestRateBps: pct(1150),
      minTenureMonths: 60, maxTenureMonths: 180,
      moratorium: { allowed: true, maxMonths: 60, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Admission letter / offer' },
      { type: 'fee_schedule', label: 'Course fee schedule' },
      { type: 'academic_records', label: 'Marksheets (last qualifying exam)' },
      { type: 'co_applicant_kyc', label: 'Co-applicant / guardian KYC & income proof' },
    ],
    source: DEMO_SOURCE('https://www.vidyalakshmi.co.in/'),
    status: 'active',
  },
  {
    code: 'SKILL-LOAN',
    name: 'Model Skill Loan Scheme',
    provider: 'Member banks (NCGTC skill loan guarantee)',
    program: 'Skill Loan Scheme — demonstration rule set',
    displayCategory: 'Skilling Loan',
    description:
      'Collateral-free, no-margin loan for a course run by an ITI / polytechnic / training partner aligned to the National Skills Qualification Framework. Demonstration figures only.',
    supportedPurposes: ['skilling'],
    eligibility: { minAge: 16, maxAge: 45 },
    financing: { minAmountPaise: R(5_000), maxAmountPaise: R(7_50_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(1050), maxInterestRateBps: pct(1300),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Course enrolment confirmation' },
      { type: 'fee_schedule', label: 'Course fee breakdown' },
    ],
    source: DEMO_SOURCE('https://www.myscheme.gov.in/schemes/sls'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // F. AGRICULTURE & ALLIED (self-employment / equipment)
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'KCC',
    name: 'Kisan Credit Card',
    provider: 'Commercial banks, RRBs, cooperative banks',
    program: 'Kisan Credit Card — demonstration rule set',
    displayCategory: 'Farm Credit',
    description:
      'Revolving working-capital credit for cultivation and allied activities (dairy, poultry, fisheries). Interest-subvented for prompt repayment. Demonstration figures only.',
    supportedPurposes: ['working_capital', 'equipment_purchase'],
    eligibility: { minAge: 18, maxAge: 75, location: { areaTypes: ['rural', 'semi_urban'] } },
    financing: { minAmountPaise: R(10_000), maxAmountPaise: R(3_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(400), maxInterestRateBps: pct(900),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'land_record', label: 'Land record / cultivation proof' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)', optional: true },
    ],
    source: DEMO_SOURCE('https://www.myscheme.gov.in/schemes/kcc'),
    status: 'active',
  },
  {
    code: 'DAIRY-ENTRE',
    name: 'Dairy / Animal Husbandry Entrepreneurship Loan',
    provider: 'NABARD-refinanced banks',
    program: 'Dairy & animal husbandry enterprise loan — demonstration rule set',
    displayCategory: 'Allied Enterprise',
    description:
      'Term finance to set up or expand a dairy unit, cattle shed, milk chilling / processing, poultry or small-ruminant unit. Requires a project report. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(25_00_000), maxProjectCostSharePct: 75, minOwnContributionPct: 25 },
    terms: {
      minInterestRateBps: pct(850), maxInterestRateBps: pct(1100),
      minTenureMonths: 36, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'project_report', label: 'Dairy / livestock project report' },
      { type: 'quotation', label: 'Quotation for cattle / equipment / shed' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE('https://www.nabard.org/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // G. LIVELIHOOD / SELF-HELP-GROUP LINKED
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'DAY-NRLM',
    name: 'DAY-NRLM SHG Bank Linkage (Rural)',
    provider: 'Banks under the National Rural Livelihoods Mission',
    program: 'DAY-NRLM SHG / individual livelihood loan — demonstration rule set',
    displayCategory: 'Livelihood Loan',
    description:
      'Low-interest credit for members of a mature rural Self-Help Group, for individual or group livelihood activities. Interest subvention applies in many districts. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'working_capital', 'equipment_purchase'],
    eligibility: { minAge: 18, maxAge: 65, location: { areaTypes: ['rural'] } },
    financing: { minAmountPaise: R(10_000), maxAmountPaise: R(6_00_000), maxProjectCostSharePct: 95, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(700), maxInterestRateBps: pct(1200),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: true, maxMonths: 3, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'shg_membership_proof', label: 'SHG membership / grading proof' },
      { type: 'bank_statement', label: 'SHG or member bank statement', optional: true },
    ],
    source: DEMO_SOURCE('https://aajeevika.gov.in/'),
    status: 'active',
  },
  {
    code: 'DAY-NULM-SEP',
    name: 'DAY-NULM Self-Employment Programme (Urban)',
    provider: 'Banks under the National Urban Livelihoods Mission',
    program: 'DAY-NULM SEP individual micro-enterprise loan — demonstration rule set',
    displayCategory: 'Livelihood Loan',
    description:
      'Subsidised individual micro-enterprise credit for the urban poor, with interest subvention above a threshold. Demonstration figures only (group loans go higher).',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000), location: { areaTypes: ['urban', 'semi_urban'] } },
    financing: { minAmountPaise: R(20_000), maxAmountPaise: R(2_00_000), maxProjectCostSharePct: 95, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(700), maxInterestRateBps: pct(1200),
      minTenureMonths: 24, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'address_proof', label: 'Urban residence proof' },
      { type: 'project_report', label: 'Micro-enterprise plan' },
    ],
    source: DEMO_SOURCE('https://nulm.gov.in/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // H. GENERAL MICRO FINANCE
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'MICRO-CREDIT',
    name: 'Micro Enterprise Credit',
    provider: 'Partner NBFCs and RRBs',
    program: 'Micro enterprise credit line — demonstration rule set',
    displayCategory: 'Micro Finance',
    description: 'Small-ticket, fast-turnaround credit for micro and nano enterprises. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 70 },
    financing: { minAmountPaise: R(10_000), maxAmountPaise: R(1_50_000), maxProjectCostSharePct: 80, minOwnContributionPct: 15 },
    terms: {
      minInterestRateBps: pct(1400), maxInterestRateBps: pct(1800),
      minTenureMonths: 6, maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)' },
      { type: 'address_proof', label: 'Address proof' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // I. MORE CENTRAL SCHEMES
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'NSTFDC-TL',
    name: 'NSTFDC Term Loan',
    provider: 'National Scheduled Tribes Finance & Development Corporation (via SCAs)',
    program: 'NSTFDC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional self-employment finance for Scheduled Tribe entrepreneurs below a household income ceiling, routed via State Channelising Agencies. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'agriculture'],
    eligibility: { categories: ['ST'], minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(25_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
    terms: {
      minInterestRateBps: pct(400), maxInterestRateBps: pct(800),
      minTenureMonths: 24, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'caste_certificate', label: 'Scheduled Tribe certificate' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'project_report', label: 'Detailed project report' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE('https://nstfdc.tribal.gov.in/'),
    status: 'active',
  },
  {
    code: 'NSKFDC-TL',
    name: 'NSKFDC Term Loan (Sanitation Workers)',
    provider: 'National Safai Karamcharis Finance & Development Corporation (via SCAs)',
    program: 'NSKFDC self-employment term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional finance for Safai Karamcharis, manual scavengers and their dependants to move to alternative self-employment. Occupation-based eligibility is not modelled by the profile in this prototype — treat as informational. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'vehicle'],
    eligibility: { minAge: 18, maxAge: 60, maxAnnualIncomePaise: R(3_00_000), requiresBusinessPlan: true },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(15_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(400), maxInterestRateBps: pct(600),
      minTenureMonths: 24, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'occupation_certificate', label: 'Safai Karamchari / occupation certificate' },
      { type: 'income_certificate', label: 'Income certificate' },
      { type: 'project_report', label: 'Project report' },
    ],
    source: DEMO_SOURCE('https://nskfdc.nic.in/'),
    status: 'active',
  },
  {
    code: 'PM-VIDYALAXMI',
    name: 'PM Vidyalaxmi',
    provider: 'Scheduled banks (merit-based, on the Vidya Lakshmi portal)',
    program: 'PM Vidyalaxmi collateral-free education loan — demonstration rule set',
    displayCategory: 'Education Loan',
    description:
      'Collateral-free, guarantor-free education loan for students admitted to a listed quality higher-education institution, with a partial interest subvention for lower-income families. Demonstration figures only.',
    supportedPurposes: ['education'],
    eligibility: { minAge: 16, maxAge: 30, maxAnnualIncomePaise: R(8_00_000) },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(10_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(800), maxInterestRateBps: pct(1050),
      minTenureMonths: 60, maxTenureMonths: 180,
      moratorium: { allowed: true, maxMonths: 60, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Admission letter (listed institution)' },
      { type: 'academic_records', label: 'Qualifying-exam marksheets' },
      { type: 'income_certificate', label: 'Family income proof (for subvention)' },
      { type: 'fee_schedule', label: 'Institution fee schedule' },
    ],
    source: DEMO_SOURCE('https://www.vidyalakshmi.co.in/'),
    status: 'active',
  },
  {
    code: 'PMMSY-CREDIT',
    name: 'Fisheries Enterprise Loan (PMMSY-linked)',
    provider: 'Banks refinanced under Pradhan Mantri Matsya Sampada Yojana',
    program: 'PMMSY fisheries & aquaculture enterprise loan — demonstration rule set',
    displayCategory: 'Allied Enterprise',
    description:
      'Term finance for fish / shrimp farming, ornamental fish units, fish feed, cold chain, transport and marketing. Requires a project report. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'agriculture'],
    eligibility: { minAge: 18, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(30_00_000), maxProjectCostSharePct: 75, minOwnContributionPct: 25 },
    terms: {
      minInterestRateBps: pct(800), maxInterestRateBps: pct(1100),
      minTenureMonths: 36, maxTenureMonths: 96,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'project_report', label: 'Fisheries project report' },
      { type: 'land_record', label: 'Pond / land lease or ownership proof' },
      { type: 'quotation', label: 'Quotation for equipment / inputs' },
    ],
    source: DEMO_SOURCE('https://pmmsy.dof.gov.in/'),
    status: 'active',
  },
  {
    code: 'AIF',
    name: 'Agriculture Infrastructure Fund',
    provider: 'Banks / cooperatives under the AIF (interest subvention + guarantee)',
    program: 'Agriculture Infrastructure Fund term loan — demonstration rule set',
    displayCategory: 'Farm Infrastructure',
    description:
      'Medium–long term finance for post-harvest management infrastructure and community farming assets — warehouses, cold stores, grading/sorting units, primary processing. Interest subvention up to a ceiling. Demonstration figures only.',
    supportedPurposes: ['agriculture', 'equipment_purchase', 'business_expansion'],
    eligibility: { minAge: 18, maxAge: 70, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(5_00_000), maxAmountPaise: R(50_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(600), maxInterestRateBps: pct(900),
      minTenureMonths: 48, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 24, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'project_report', label: 'Infrastructure project report (DPR)' },
      { type: 'land_record', label: 'Land ownership / long lease proof' },
      { type: 'business_proof', label: 'Entity registration (FPO / society / firm)', optional: true },
    ],
    source: DEMO_SOURCE('https://agriinfra.dac.gov.in/'),
    status: 'active',
  },
  {
    code: 'WEAVER-MUDRA',
    name: 'Weaver MUDRA Scheme',
    provider: 'Banks under the Ministry of Textiles handloom scheme',
    program: 'Weaver MUDRA concessional credit + margin money — demonstration rule set',
    displayCategory: 'Artisan Credit',
    description:
      'Concessional working-capital and term credit for handloom weavers, with margin money assistance and interest subvention. Demonstration figures only.',
    supportedPurposes: ['working_capital', 'equipment_purchase', 'business_expansion'],
    eligibility: { minAge: 18, maxAge: 70 },
    financing: { minAmountPaise: R(10_000), maxAmountPaise: R(5_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(600), maxInterestRateBps: pct(900),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'weaver_id', label: 'Weaver / Pehchan ID card' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)', optional: true },
    ],
    source: DEMO_SOURCE('https://handlooms.nic.in/'),
    status: 'active',
  },
  {
    code: 'ACABC',
    name: 'Agri-Clinics & Agri-Business Centres Loan',
    provider: 'Banks (NABARD-supported, MANAGE training)',
    program: 'ACABC venture loan for trained agri-professionals — demonstration rule set',
    displayCategory: 'Allied Enterprise',
    description:
      'Venture finance for agriculture graduates / trained persons setting up an agri-clinic or agri-business centre (soil testing, input supply, custom hiring, advisory). Demonstration figures only.',
    supportedPurposes: ['business_new', 'equipment_purchase', 'agriculture'],
    eligibility: { minAge: 18, maxAge: 60, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(2_00_000), maxAmountPaise: R(20_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(900), maxInterestRateBps: pct(1200),
      minTenureMonths: 36, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 24, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'training_certificate', label: 'ACABC / agriculture training certificate' },
      { type: 'project_report', label: 'Venture project report' },
    ],
    source: DEMO_SOURCE('https://www.acabcmis.gov.in/'),
    status: 'active',
  },
  {
    code: 'PMAY-CLSS',
    name: 'Home Loan with PMAY Credit-Linked Subsidy',
    provider: 'Banks / HFCs (subsidy via NHB / HUDCO)',
    program: 'PMAY Credit-Linked Subsidy Scheme — demonstration rule set',
    displayCategory: 'Housing Loan',
    description:
      'Home loan for construction, purchase or extension by an EWS / LIG / MIG household, with an upfront interest-subsidy on part of the loan. Household must not already own a pucca house. Demonstration figures only.',
    supportedPurposes: ['housing'],
    eligibility: { minAge: 21, maxAge: 65, maxAnnualIncomePaise: R(18_00_000) },
    financing: { minAmountPaise: R(3_00_000), maxAmountPaise: R(35_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(800), maxInterestRateBps: pct(1050),
      minTenureMonths: 60, maxTenureMonths: 240,
      moratorium: { allowed: true, maxMonths: 18, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'income_certificate', label: 'Household income proof' },
      { type: 'property_documents', label: 'Property / plot documents' },
      { type: 'no_house_declaration', label: 'Declaration of no existing pucca house' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE('https://pmaymis.gov.in/'),
    status: 'active',
  },
  {
    code: 'LIVELIHOOD-VEHICLE',
    name: 'Livelihood Vehicle Loan (e-rickshaw / auto / goods carrier)',
    provider: 'Banks / NBFCs (often DAY-NULM or state-scheme linked)',
    program: 'Livelihood transport-asset loan — demonstration rule set',
    displayCategory: 'Vehicle Loan',
    description:
      'Loan to buy an income-generating vehicle — an e-rickshaw, auto, small goods carrier or delivery two-wheeler — where the vehicle itself is the primary security. Demonstration figures only.',
    supportedPurposes: ['vehicle', 'business_new', 'business_expansion'],
    eligibility: { minAge: 21, maxAge: 60, maxAnnualIncomePaise: R(5_00_000) },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(6_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(950), maxInterestRateBps: pct(1600),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: true, maxMonths: 2, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'driving_licence', label: 'Driving licence' },
      { type: 'quotation', label: 'Vehicle quotation / proforma invoice' },
      { type: 'permit_proof', label: 'Route permit / registration intent', optional: true },
    ],
    source: DEMO_SOURCE('https://nulm.gov.in/'),
    status: 'active',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // J. GENERAL BANK PRODUCTS (indicative categories — terms vary by bank)
  //    provider = "Scheduled commercial banks (indicative terms)"
  // ─────────────────────────────────────────────────────────────────────────
  {
    code: 'BANK-BUSINESS-LOAN',
    name: 'Bank Business Loan (unsecured)',
    provider: 'Scheduled commercial banks (indicative terms)',
    program: 'Generic unsecured business loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'Unsecured loan for an existing business with a track record and filed returns. No collateral, higher rate, shorter tenure. Indicative category — actual terms vary by bank and borrower profile.',
    supportedPurposes: ['business_expansion', 'working_capital', 'equipment_purchase'],
    eligibility: { minAge: 21, maxAge: 65, requiresBusinessPlan: false },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(40_00_000), maxProjectCostSharePct: 80, minOwnContributionPct: 20 },
    terms: {
      minInterestRateBps: pct(1400), maxInterestRateBps: pct(2200),
      minTenureMonths: 12, maxTenureMonths: 60,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'business_proof', label: 'Business registration / Udyam / GST' },
      { type: 'itr', label: 'Income-tax returns (last 2 years)' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-WORKING-CAPITAL',
    name: 'Cash Credit / Overdraft (Working Capital)',
    provider: 'Scheduled commercial banks (indicative terms)',
    program: 'Generic working-capital limit — indicative category',
    displayCategory: 'Bank Product',
    description:
      'A revolving cash-credit or overdraft limit against stock and receivables, renewed annually. Interest is charged only on the amount used. Indicative category — terms vary by bank.',
    supportedPurposes: ['working_capital'],
    eligibility: { minAge: 21, maxAge: 70, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(50_00_000), maxProjectCostSharePct: 75, minOwnContributionPct: 25 },
    terms: {
      minInterestRateBps: pct(1000), maxInterestRateBps: pct(1500),
      minTenureMonths: 12, maxTenureMonths: 12,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'business_proof', label: 'Business registration / Udyam / GST' },
      { type: 'financial_statements', label: 'Audited financials / provisional' },
      { type: 'stock_statement', label: 'Stock & receivables statement' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-TERM-LOAN',
    name: 'Secured Business Term Loan',
    provider: 'Scheduled commercial banks (indicative terms)',
    program: 'Generic secured term loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'Term loan for plant, machinery, a commercial vehicle fleet or a business premises, secured by the asset and/or additional collateral. Indicative category — terms vary by bank.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
    eligibility: { minAge: 21, maxAge: 65, requiresBusinessPlan: true },
    financing: { minAmountPaise: R(2_00_000), maxAmountPaise: R(75_00_000), maxProjectCostSharePct: 75, minOwnContributionPct: 25 },
    terms: {
      minInterestRateBps: pct(1000), maxInterestRateBps: pct(1400),
      minTenureMonths: 24, maxTenureMonths: 120,
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'business_proof', label: 'Business registration / Udyam / GST' },
      { type: 'project_report', label: 'Project report with financial projections' },
      { type: 'itr', label: 'Income-tax returns (last 2-3 years)' },
      { type: 'collateral_documents', label: 'Collateral / security documents' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-LAP',
    name: 'Loan Against Property',
    provider: 'Scheduled commercial banks / HFCs (indicative terms)',
    program: 'Generic loan against property — indicative category',
    displayCategory: 'Bank Product',
    description:
      'A loan secured by a mortgage on residential or commercial property you own, usable for a business or a large personal need. Lower rate and longer tenure than an unsecured loan, but the property is at risk. Indicative category.',
    supportedPurposes: ['business_expansion', 'working_capital', 'personal'],
    eligibility: { minAge: 21, maxAge: 70 },
    financing: { minAmountPaise: R(3_00_000), maxAmountPaise: R(1_00_00_000), maxProjectCostSharePct: 65, minOwnContributionPct: 35 },
    terms: {
      minInterestRateBps: pct(950), maxInterestRateBps: pct(1400),
      minTenureMonths: 36, maxTenureMonths: 180,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'property_documents', label: 'Property title & chain documents' },
      { type: 'income_proof', label: 'Income proof (salary slips / ITR)' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-EDUCATION-LOAN',
    name: 'Bank Education Loan (standard)',
    provider: 'Scheduled commercial banks (indicative terms)',
    program: 'Generic education loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'Standard education loan for studies in India or abroad; collateral-free up to a threshold, collateral required above it. Repayment after the course plus a grace period. Indicative category.',
    supportedPurposes: ['education'],
    eligibility: { minAge: 16, maxAge: 35 },
    financing: { minAmountPaise: R(50_000), maxAmountPaise: R(50_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(950), maxInterestRateBps: pct(1300),
      minTenureMonths: 60, maxTenureMonths: 180,
      moratorium: { allowed: true, maxMonths: 60, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Admission letter' },
      { type: 'fee_schedule', label: 'Course fee schedule' },
      { type: 'academic_records', label: 'Academic records' },
      { type: 'co_applicant_kyc', label: 'Co-applicant KYC & income proof' },
      { type: 'collateral_documents', label: 'Collateral documents (above threshold)', optional: true },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-GOLD-LOAN',
    name: 'Gold Loan',
    provider: 'Scheduled commercial banks / NBFCs (indicative terms)',
    program: 'Generic gold loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'A fast, minimal-documentation loan against gold jewellery or coins. Short tenure, disbursed the same day. Useful as bridge or emergency finance. Indicative category.',
    supportedPurposes: ['working_capital', 'personal', 'agriculture', 'business_expansion'],
    eligibility: { minAge: 18, maxAge: 75 },
    financing: { minAmountPaise: R(5_000), maxAmountPaise: R(25_00_000), maxProjectCostSharePct: 75, minOwnContributionPct: 25 },
    terms: {
      minInterestRateBps: pct(900), maxInterestRateBps: pct(1800),
      minTenureMonths: 3, maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'address_proof', label: 'Address proof' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-VEHICLE-LOAN',
    name: 'Commercial Vehicle Loan',
    provider: 'Scheduled commercial banks / NBFCs (indicative terms)',
    program: 'Generic commercial vehicle loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'Loan to buy a commercial vehicle — taxi, goods carrier, tempo, bus — where the vehicle is hypothecated to the lender. Indicative category — terms vary with the vehicle and operator profile.',
    supportedPurposes: ['vehicle', 'business_new', 'business_expansion'],
    eligibility: { minAge: 21, maxAge: 65 },
    financing: { minAmountPaise: R(1_00_000), maxAmountPaise: R(40_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(1000), maxInterestRateBps: pct(1600),
      minTenureMonths: 12, maxTenureMonths: 84,
      moratorium: { allowed: true, maxMonths: 3, interestHandling: 'serviced', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'driving_licence', label: 'Driving licence' },
      { type: 'quotation', label: 'Vehicle proforma invoice' },
      { type: 'income_proof', label: 'Income proof / existing route earnings' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-PERSONAL-LOAN',
    name: 'Personal Loan (unsecured)',
    provider: 'Scheduled commercial banks / NBFCs (indicative terms)',
    program: 'Generic personal loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'An unsecured, multi-purpose loan based on income and credit history. Highest rate of the bank products here — best used only when a purpose-specific or subsidised scheme is not available. Indicative category.',
    supportedPurposes: ['personal', 'education', 'housing'],
    eligibility: { minAge: 21, maxAge: 60, minAnnualIncomePaise: R(1_80_000) },
    financing: { minAmountPaise: R(20_000), maxAmountPaise: R(20_00_000), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
    terms: {
      minInterestRateBps: pct(1100), maxInterestRateBps: pct(2400),
      minTenureMonths: 6, maxTenureMonths: 72,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'income_proof', label: 'Salary slips / ITR' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
  {
    code: 'BANK-HOME-LOAN',
    name: 'Home Loan (standard)',
    provider: 'Scheduled commercial banks / HFCs (indicative terms)',
    program: 'Generic home loan — indicative category',
    displayCategory: 'Bank Product',
    description:
      'Standard housing loan for buying, building or renovating a home, secured by a mortgage on the property. Lowest rate and longest tenure of the products here. Check PMAY-CLSS eligibility first for a possible subsidy. Indicative category.',
    supportedPurposes: ['housing'],
    eligibility: { minAge: 21, maxAge: 70, minAnnualIncomePaise: R(3_00_000) },
    financing: { minAmountPaise: R(3_00_000), maxAmountPaise: R(2_00_00_000), maxProjectCostSharePct: 90, minOwnContributionPct: 10 },
    terms: {
      minInterestRateBps: pct(820), maxInterestRateBps: pct(1050),
      minTenureMonths: 60, maxTenureMonths: 360,
      moratorium: { allowed: true, maxMonths: 24, interestHandling: 'capitalised', tenureIncludesMoratorium: false },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'income_proof', label: 'Income proof (salary slips / ITR)' },
      { type: 'property_documents', label: 'Property agreement & title documents' },
      { type: 'bank_statement', label: 'Bank statement (last 12 months)' },
    ],
    source: DEMO_SOURCE(''),
    status: 'active',
  },
] as const;

// Codes grouped for partner wiring below.
const MUDRA = ['PMMY-SHISHU', 'PMMY-KISHOR', 'PMMY-TARUN'];
const BANK_PRODUCTS = [
  'BANK-BUSINESS-LOAN', 'BANK-WORKING-CAPITAL', 'BANK-TERM-LOAN', 'BANK-LAP', 'BANK-EDUCATION-LOAN',
  'BANK-GOLD-LOAN', 'BANK-VEHICLE-LOAN', 'BANK-PERSONAL-LOAN', 'BANK-HOME-LOAN',
];
const BUSINESS_GENERIC = [...MUDRA, 'CGTMSE-CREDIT', 'MICRO-CREDIT', 'PMEGP', 'PM-VISHWAKARMA', 'WEAVER-MUDRA'];
const SOCIAL_CORP = ['NBCFDC-TL', 'NMDFC-TL', 'NHFDC-TL', 'NSTFDC-TL', 'NSKFDC-TL', 'STANDUP-INDIA', 'PMEGP', 'PM-VISHWAKARMA', 'ANNAPURNA', 'MAHILA-UDYAM'];
const EDUCATION = ['EDU-SKILL', 'EDU-VIDYALAKSHMI', 'PM-VIDYALAXMI', 'SKILL-LOAN', 'BANK-EDUCATION-LOAN'];
const RURAL_LIVELIHOOD = ['KCC', 'DAIRY-ENTRE', 'PMMSY-CREDIT', 'AIF', 'ACABC', 'DAY-NRLM', 'PMMY-SHISHU', 'PMMY-KISHOR'];
const URBAN_LIVELIHOOD = ['DAY-NULM-SEP', 'PM-SVANIDHI', 'LIVELIHOOD-VEHICLE', 'PMMY-SHISHU', 'PMMY-KISHOR', 'MICRO-CREDIT'];
const HOUSING = ['PMAY-CLSS', 'BANK-HOME-LOAN'];

export const partners = [
  // ── Local demo partners (kept from the original fixture set) ──────────────
  {
    name: 'SCA Ghaziabad (demo)',
    type: 'state_channeling_agency',
    serviceAreas: { national: false, states: ['Uttar Pradesh'], districts: ['Ghaziabad', 'Gautam Buddha Nagar'] },
    location: { lat: 28.6692, lng: 77.4538, address: 'Ghaziabad, Uttar Pradesh' },
    supportedSchemeCodes: ['PMMY-KISHOR', 'NSFDC-TL', 'NBCFDC-TL', 'PM-VISHWAKARMA', 'PMEGP'],
    focusSchemeCodes: ['NSFDC-TL'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 20,
    operationalMetricsSimulated: true,
    contactEmail: 'sca.ghaziabad@partners.schemefit.dev',
  },
  {
    name: 'Bank A — Public Sector (demo)',
    type: 'public_sector_bank',
    serviceAreas: { national: false, states: ['Uttar Pradesh'], districts: ['Ghaziabad', 'Gautam Buddha Nagar'] },
    location: { lat: 28.6745, lng: 77.439, address: 'Ghaziabad, Uttar Pradesh' },
    supportedSchemeCodes: ['PMMY-SHISHU', 'PMMY-KISHOR', 'PMMY-TARUN', 'MICRO-CREDIT', 'EDU-SKILL', 'CGTMSE-CREDIT', 'STANDUP-INDIA', 'PM-SVANIDHI'],
    focusSchemeCodes: ['PMMY-KISHOR', 'CGTMSE-CREDIT'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 30,
    operationalMetricsSimulated: true,
    contactEmail: 'bank.a@partners.schemefit.dev',
  },
  {
    name: 'Bank B — Regional Rural (demo)',
    type: 'regional_rural_bank',
    serviceAreas: { national: false, states: ['Uttar Pradesh'], districts: ['Ghaziabad'] },
    location: { lat: 28.6645, lng: 77.428, address: 'Ghaziabad, Uttar Pradesh' },
    supportedSchemeCodes: ['PMMY-SHISHU', 'PMMY-KISHOR', 'KCC', 'DAY-NRLM'],
    focusSchemeCodes: [],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 10,
    operationalMetricsSimulated: true,
    contactEmail: 'bank.b@partners.schemefit.dev',
  },
  {
    name: 'Bihar SCA (demo)',
    type: 'state_channeling_agency',
    serviceAreas: { national: false, states: ['Bihar'], districts: [] },
    location: { lat: 25.5941, lng: 85.1376, address: 'Patna, Bihar' },
    supportedSchemeCodes: ['NSFDC-TL', 'NBCFDC-TL', 'NMDFC-TL', 'PMMY-KISHOR', 'EDU-SKILL', 'SKILL-LOAN', 'PM-VISHWAKARMA'],
    focusSchemeCodes: ['NSFDC-TL', 'EDU-SKILL'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 25,
    operationalMetricsSimulated: true,
    contactEmail: 'sca.bihar@partners.schemefit.dev',
  },
  {
    name: 'Pending NBFC (demo, not yet authorised)',
    type: 'nbfc',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 28.61, lng: 77.23, address: 'New Delhi' },
    supportedSchemeCodes: ['PMMY-KISHOR', 'MICRO-CREDIT'],
    focusSchemeCodes: [],
    authorization: 'pending', // routing filters must exclude this partner
    status: 'active',
    acceptingApplications: true,
    capacity: 15,
    operationalMetricsSimulated: true,
    contactEmail: 'pending.nbfc@partners.schemefit.dev',
  },

  // ── National aggregator partners so every scheme has a routable partner ───
  {
    name: 'SIDBI Aggregator Cell (demo)',
    type: 'development_finance_institution',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 26.8467, lng: 80.9462, address: 'Lucknow (national desk)' },
    supportedSchemeCodes: [...BUSINESS_GENERIC, 'STANDUP-INDIA', 'MAHILA-UDYAM'],
    focusSchemeCodes: ['CGTMSE-CREDIT', 'MAHILA-UDYAM', 'STANDUP-INDIA'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 60,
    operationalMetricsSimulated: true,
    contactEmail: 'sidbi.cell@partners.schemefit.dev',
  },
  {
    name: 'Social Welfare Finance Board (demo)',
    type: 'state_channeling_agency',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 28.6139, lng: 77.209, address: 'New Delhi (national desk)' },
    supportedSchemeCodes: SOCIAL_CORP,
    focusSchemeCodes: ['NBCFDC-TL', 'NMDFC-TL', 'PM-VISHWAKARMA'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 45,
    operationalMetricsSimulated: true,
    contactEmail: 'welfare.board@partners.schemefit.dev',
  },
  {
    name: 'National Education Finance Cell (demo)',
    type: 'public_sector_bank',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 19.076, lng: 72.8777, address: 'Mumbai (education desk)' },
    supportedSchemeCodes: EDUCATION,
    focusSchemeCodes: EDUCATION,
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 50,
    operationalMetricsSimulated: true,
    contactEmail: 'edu.cell@partners.schemefit.dev',
  },
  {
    name: 'NABARD Rural Finance Partner (demo)',
    type: 'regional_rural_bank',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 23.2599, lng: 77.4126, address: 'Bhopal (rural desk)' },
    supportedSchemeCodes: RURAL_LIVELIHOOD,
    focusSchemeCodes: ['KCC', 'DAIRY-ENTRE', 'DAY-NRLM'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 40,
    operationalMetricsSimulated: true,
    contactEmail: 'nabard.partner@partners.schemefit.dev',
  },
  {
    name: 'Urban Livelihood Mission Cell (demo)',
    type: 'urban_local_body',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 28.7041, lng: 77.1025, address: 'Delhi (urban livelihoods desk)' },
    supportedSchemeCodes: URBAN_LIVELIHOOD,
    focusSchemeCodes: ['DAY-NULM-SEP', 'PM-SVANIDHI'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 35,
    operationalMetricsSimulated: true,
    contactEmail: 'nulm.cell@partners.schemefit.dev',
  },
  {
    name: 'Housing Finance Partner (demo)',
    type: 'public_sector_bank',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 28.5672, lng: 77.321, address: 'Noida (housing finance desk)' },
    supportedSchemeCodes: [...HOUSING, 'BANK-LAP', 'BANK-PERSONAL-LOAN'],
    focusSchemeCodes: ['PMAY-CLSS'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 40,
    operationalMetricsSimulated: true,
    contactEmail: 'housing.partner@partners.schemefit.dev',
  },
  {
    name: 'Universal Bank Desk (demo)',
    type: 'public_sector_bank',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 22.5726, lng: 88.3639, address: 'Kolkata (national retail desk)' },
    supportedSchemeCodes: [...BANK_PRODUCTS, 'PMMY-KISHOR', 'PMMY-TARUN', 'CGTMSE-CREDIT'],
    focusSchemeCodes: ['BANK-BUSINESS-LOAN', 'BANK-TERM-LOAN'],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 55,
    operationalMetricsSimulated: true,
    contactEmail: 'universal.bank@partners.schemefit.dev',
  },
] as const;

export interface SeedCitizen {
  email: string;
  password: string;
  fullName: string;
  profile: Record<string, unknown>;
}

export const citizens: SeedCitizen[] = [
  {
    email: 'ravi.kumar@citizens.schemefit.dev',
    password: 'CitizenRavi!2026',
    fullName: 'Ravi Kumar',
    profile: {
      age: 28,
      annualIncomePaise: R(2_40_000),
      category: 'SC',
      state: 'Bihar',
      district: 'Sitamarhi',
      areaType: 'rural',
      location: { lat: 26.5927, lng: 85.4916 },
      purpose: 'business_expansion',
      businessDetails: { activity: 'Furniture repair and carpentry', stage: 'existing', yearsRunning: 3 },
      hasBusinessPlan: true,
      projectCostPaise: R(6_00_000),
      ownContributionPaise: R(60_000),
      requestedLoanPaise: R(5_40_000),
    },
  },
  {
    email: 'shabnam.ali@citizens.schemefit.dev',
    password: 'CitizenShabnam!2026',
    fullName: 'Shabnam Ali',
    profile: {
      age: 34,
      annualIncomePaise: R(1_80_000),
      category: 'MINORITY',
      state: 'Uttar Pradesh',
      district: 'Ghaziabad',
      areaType: 'urban',
      location: { lat: 28.6692, lng: 77.4538 },
      purpose: 'business_new',
      businessDetails: { activity: 'Home tailoring unit', stage: 'idea', yearsRunning: 0 },
      hasBusinessPlan: true,
      projectCostPaise: R(1_40_000),
      ownContributionPaise: R(25_000),
      requestedLoanPaise: R(1_15_000),
    },
  },
  {
    email: 'ankit.verma@citizens.schemefit.dev',
    password: 'CitizenAnkit!2026',
    fullName: 'Ankit Verma',
    profile: {
      age: 41,
      annualIncomePaise: R(5_00_000),
      category: 'GENERAL',
      state: 'Uttar Pradesh',
      district: 'Gautam Buddha Nagar',
      areaType: 'semi_urban',
      location: { lat: 28.5355, lng: 77.391 },
      purpose: 'equipment_purchase',
      businessDetails: { activity: 'Printing press', stage: 'expansion', yearsRunning: 7 },
      hasBusinessPlan: true,
      projectCostPaise: R(3_50_000),
      ownContributionPaise: R(50_000),
      requestedLoanPaise: R(3_00_000),
    },
  },
  {
    email: 'meena.devi@citizens.schemefit.dev',
    password: 'CitizenMeena!2026',
    fullName: 'Meena Devi',
    profile: {
      age: 22,
      annualIncomePaise: R(1_20_000),
      category: 'ST',
      state: 'Bihar',
      district: 'Gaya',
      areaType: 'rural',
      location: { lat: 24.7955, lng: 85.0002 },
      purpose: 'skilling',
      educationDetails: { level: 'Class 12', course: 'ITI — Electrician', institution: 'Govt ITI Gaya' },
      hasBusinessPlan: false,
      projectCostPaise: R(1_20_000),
      ownContributionPaise: R(10_000),
      requestedLoanPaise: R(1_10_000),
    },
  },
  {
    email: 'new.applicant@citizens.schemefit.dev',
    password: 'CitizenNewbie!2026',
    fullName: 'Priya Nair',
    // Deliberately sparse profile -> recommendations should be "needs_information".
    profile: { state: 'Kerala', district: 'Ernakulam' },
  },
];

export const partnerUsers = [
  { email: 'officer.ghaziabad@partners.schemefit.dev', password: 'PartnerGzb!2026', displayName: 'A. Sharma (SCA Ghaziabad)', partnerName: 'SCA Ghaziabad (demo)' },
  { email: 'officer.banka@partners.schemefit.dev', password: 'PartnerBankA!2026', displayName: 'R. Iyer (Bank A)', partnerName: 'Bank A — Public Sector (demo)' },
  { email: 'officer.bihar@partners.schemefit.dev', password: 'PartnerBihar!2026', displayName: 'S. Prasad (Bihar SCA)', partnerName: 'Bihar SCA (demo)' },
  { email: 'officer.edu@partners.schemefit.dev', password: 'PartnerEdu!2026', displayName: 'K. Menon (Education Finance Cell)', partnerName: 'National Education Finance Cell (demo)' },
  { email: 'officer.welfare@partners.schemefit.dev', password: 'PartnerWelfare!2026', displayName: 'D. Rao (Social Welfare Finance Board)', partnerName: 'Social Welfare Finance Board (demo)' },
];
