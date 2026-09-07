/**
 * Deterministic development fixtures. Everything here is DEMONSTRATION DATA:
 *  - scheme rule sets carry source.demoData = true and are NOT official policy,
 *  - partner operational metrics are simulated,
 *  - citizen records and documents are synthetic (no real personal data).
 */
import { rupeesToPaise } from '../lib/money';

export const DEMO_SOURCE = (version = 'demo-2026-09') => ({
  url: '',
  verificationDate: null,
  effectiveFrom: null,
  effectiveTo: null,
  version,
  demoData: true,
});

const R = rupeesToPaise;

export const schemes = [
  {
    code: 'PMMY-KISHOR',
    name: 'Term Loan (Kishor)',
    provider: 'Member Lending Institutions under PMMY',
    program: 'Pradhan Mantri Mudra Yojana (PMMY) — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Collateral-free working-capital / term finance for micro enterprises in manufacturing, trading and services. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'],
    eligibility: {
      // Open to all social categories — NOT category restricted.
      minAge: 18,
      maxAge: 65,
      requiresBusinessPlan: false,
    },
    financing: {
      minAmountPaise: R(50_000),
      maxAmountPaise: R(5_00_000),
      maxProjectCostSharePct: 85,
      minOwnContributionPct: 10,
    },
    terms: {
      minInterestRateBps: 950,
      maxInterestRateBps: 1250,
      minTenureMonths: 12,
      maxTenureMonths: 60,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'pan_card', label: 'PAN card' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)' },
      { type: 'business_proof', label: 'Business registration / proof' },
      { type: 'quotation', label: 'Quotation / project report', optional: true },
    ],
    source: DEMO_SOURCE(),
    status: 'active',
  },
  {
    code: 'NSFDC-TL',
    name: 'NSFDC Term Loan',
    provider: 'National Scheduled Castes Finance & Development Corporation (channelled via SCAs)',
    program: 'NSFDC concessional term loan — demonstration rule set',
    displayCategory: 'Term Loan',
    description:
      'Concessional term finance routed through State Channelising Agencies for Scheduled Caste entrepreneurs below a household income ceiling. This is a DISTINCT scheme from PMMY / Mudra — different eligibility, limits and rate.',
    supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
    eligibility: {
      categories: ['SC'],
      minAge: 18,
      maxAge: 60,
      maxAnnualIncomePaise: R(3_00_000),
      requiresBusinessPlan: true,
    },
    financing: {
      minAmountPaise: R(1_00_000),
      maxAmountPaise: R(30_00_000),
      maxProjectCostSharePct: 90,
      minOwnContributionPct: 5,
    },
    terms: {
      minInterestRateBps: 600,
      maxInterestRateBps: 800,
      minTenureMonths: 24,
      maxTenureMonths: 120,
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
    source: DEMO_SOURCE(),
    status: 'active',
  },
  {
    code: 'MICRO-CREDIT',
    name: 'Micro Enterprise Credit',
    provider: 'Partner NBFCs and RRBs',
    program: 'Micro enterprise credit line — demonstration rule set',
    displayCategory: 'Micro Finance',
    description: 'Small-ticket, fast-turnaround credit for micro and nano enterprises. Demonstration figures only.',
    supportedPurposes: ['business_new', 'business_expansion', 'working_capital'],
    eligibility: { minAge: 18, maxAge: 70 },
    financing: {
      minAmountPaise: R(10_000),
      maxAmountPaise: R(1_50_000),
      maxProjectCostSharePct: 80,
      minOwnContributionPct: 15,
    },
    terms: {
      minInterestRateBps: 1400,
      maxInterestRateBps: 1800,
      minTenureMonths: 6,
      maxTenureMonths: 36,
      moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)' },
      { type: 'address_proof', label: 'Address proof' },
    ],
    source: DEMO_SOURCE(),
    status: 'active',
  },
  {
    code: 'EDU-SKILL',
    name: 'Skill & Education Finance',
    provider: 'Partner banks (education finance vertical)',
    program: 'Skilling and education loan — demonstration rule set',
    displayCategory: 'Education Loan',
    description: 'Finance for certified skilling programmes and formal education, with a study-period moratorium.',
    supportedPurposes: ['education', 'skilling'],
    eligibility: { minAge: 17, maxAge: 45 },
    financing: {
      minAmountPaise: R(25_000),
      maxAmountPaise: R(7_50_000),
      maxProjectCostSharePct: 95,
      minOwnContributionPct: 0,
    },
    terms: {
      minInterestRateBps: 800,
      maxInterestRateBps: 1100,
      minTenureMonths: 12,
      maxTenureMonths: 84,
      // Study-period moratorium, interest capitalised, and the quoted tenure INCLUDES it.
      moratorium: { allowed: true, maxMonths: 12, interestHandling: 'capitalised', tenureIncludesMoratorium: true },
    },
    requiredDocuments: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)' },
      { type: 'admission_letter', label: 'Admission / enrolment letter' },
      { type: 'fee_schedule', label: 'Course fee schedule' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)', optional: true },
    ],
    source: DEMO_SOURCE(),
    status: 'active',
  },
] as const;

export const partners = [
  {
    name: 'SCA Ghaziabad (demo)',
    type: 'state_channeling_agency',
    serviceAreas: { national: false, states: ['Uttar Pradesh'], districts: ['Ghaziabad', 'Gautam Buddha Nagar'] },
    location: { lat: 28.6692, lng: 77.4538, address: 'Ghaziabad, Uttar Pradesh' },
    supportedSchemeCodes: ['PMMY-KISHOR', 'NSFDC-TL'],
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
    supportedSchemeCodes: ['PMMY-KISHOR', 'MICRO-CREDIT', 'EDU-SKILL'],
    focusSchemeCodes: ['PMMY-KISHOR'],
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
    supportedSchemeCodes: ['PMMY-KISHOR'],
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
    supportedSchemeCodes: ['NSFDC-TL', 'PMMY-KISHOR', 'EDU-SKILL'],
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
];
