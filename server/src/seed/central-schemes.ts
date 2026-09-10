/**
 * Well-known central-government schemes across benefit types (not just loans):
 * income support, pensions, insurance, housing, scholarships, skilling, welfare.
 *
 * DEMONSTRATION DATA. Eligibility bands and figures are ILLUSTRATIVE and
 * approximate — `source.url` is the official portal where the real rules must be
 * confirmed and where a citizen actually applies. Not official policy.
 */
import { rupeesToPaise } from '../lib/money';

const R = rupeesToPaise;
const DEMO_SOURCE = (url = '', version = 'demo-2026-09') => ({
  url,
  verificationDate: null,
  effectiveFrom: null,
  effectiveTo: null,
  version,
  demoData: true,
});

// Placeholder loan fields — required by the Scheme model but IGNORED by the rule
// engine for every non-'financing' kind.
const NON_LOAN = {
  supportedPurposes: [] as string[],
  financing: { minAmountPaise: R(0), maxAmountPaise: R(1), maxProjectCostSharePct: 100, minOwnContributionPct: 0 },
  terms: {
    minInterestRateBps: 0,
    maxInterestRateBps: 0,
    minTenureMonths: 1,
    maxTenureMonths: 1,
    moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced' as const, tenureIncludesMoratorium: true },
  },
  status: 'active' as const,
};

const ID = { type: 'identity_proof', label: 'Identity proof (Aadhaar)' };
const BANK = { type: 'bank_statement', label: 'Bank account details / passbook' };
const INCOME = { type: 'income_certificate', label: 'Income certificate' };
const CASTE = { type: 'caste_certificate', label: 'Caste certificate' };
const RATION = { type: 'address_proof', label: 'Ration card' };
const ENROL = { type: 'education_proof', label: 'Bonafide student / enrolment certificate' };
const MARKS = { type: 'academic_records', label: 'Previous year marksheet' };
const DISAB = { type: 'disability_certificate', label: 'Disability (UDID) certificate' };
const LAND = { type: 'land_record', label: 'Land record (RoR)' };

export const centralSchemes = [
  // ── Income support / direct benefit ──────────────────────────────────────
  {
    code: 'PM-KISAN', name: 'PM-KISAN Samman Nidhi', provider: 'Department of Agriculture & Farmers Welfare',
    program: 'Pradhan Mantri Kisan Samman Nidhi — ₹6,000/year income support — demonstration rule set',
    displayCategory: 'Income support', kind: 'income_support',
    description: '₹6,000 a year in three instalments to landholding farmer families. Institutional landholders, income-tax payers and government employees are excluded. Demonstration figures only.',
    eligibility: { occupations: ['farmer'], maxLandHoldingHectares: 2 },
    requiredDocuments: [ID, BANK, LAND],
    source: DEMO_SOURCE('https://pmkisan.gov.in/'),
  },
  {
    code: 'PMMVY', name: 'PM Matru Vandana Yojana', provider: 'Ministry of Women & Child Development',
    program: 'Pradhan Mantri Matru Vandana Yojana — maternity benefit — demonstration rule set',
    displayCategory: 'Income support', kind: 'income_support',
    description: 'Conditional cash transfer to pregnant and lactating women for the first child (and ₹6,000 for a second child if a girl). Demonstration figures only.',
    eligibility: { genders: ['female'], minAge: 19 },
    requiredDocuments: [ID, BANK, { type: 'address_proof', label: 'MCP card / pregnancy registration' }],
    source: DEMO_SOURCE('https://pmmvy.wcd.gov.in/'),
  },
  {
    code: 'PMUY', name: 'PM Ujjwala Yojana (LPG)', provider: 'Ministry of Petroleum & Natural Gas',
    program: 'Pradhan Mantri Ujjwala Yojana 2.0 — free LPG connection — demonstration rule set',
    displayCategory: 'Subsidy', kind: 'income_support',
    description: 'A deposit-free LPG connection with the first refill and stove, for an adult woman of a poor household (SC/ST, PMAY, AAY, forest dwellers, most-backward classes or a poverty self-declaration). Demonstration figures only.',
    eligibility: { genders: ['female'], minAge: 18, rationCardTypes: ['BPL', 'AAY', 'PHH'] },
    requiredDocuments: [ID, BANK, RATION],
    source: DEMO_SOURCE('https://www.pmuy.gov.in/'),
  },
  {
    code: 'NFBS', name: 'National Family Benefit Scheme', provider: 'Ministry of Rural Development (NSAP)',
    program: 'NSAP — National Family Benefit Scheme — one-time death relief — demonstration rule set',
    displayCategory: 'Welfare', kind: 'welfare',
    description: 'A one-time lump sum to a BPL household on the death of the primary breadwinner (aged 18–59). Demonstration figures only.',
    eligibility: { rationCardTypes: ['BPL', 'AAY'] },
    requiredDocuments: [ID, BANK, RATION, { type: 'address_proof', label: 'Death certificate of breadwinner' }],
    source: DEMO_SOURCE('https://nsap.nic.in/'),
  },

  // ── Pensions (NSAP + contributory) ───────────────────────────────────────
  {
    code: 'IGNOAPS', name: 'Indira Gandhi Old Age Pension', provider: 'Ministry of Rural Development (NSAP)',
    program: 'NSAP — Indira Gandhi National Old Age Pension Scheme — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'Monthly pension for people aged 60+ belonging to a household below the poverty line. Demonstration figures only.',
    eligibility: { minAge: 60, rationCardTypes: ['BPL', 'AAY'] },
    requiredDocuments: [ID, BANK, RATION],
    source: DEMO_SOURCE('https://nsap.nic.in/'),
  },
  {
    code: 'IGNWPS', name: 'Indira Gandhi Widow Pension', provider: 'Ministry of Rural Development (NSAP)',
    program: 'NSAP — Indira Gandhi National Widow Pension Scheme — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'Monthly pension for widows aged 40–79 belonging to a household below the poverty line. Demonstration figures only.',
    eligibility: { genders: ['female'], minAge: 40, maxAge: 79, rationCardTypes: ['BPL', 'AAY'] },
    requiredDocuments: [ID, BANK, RATION, { type: 'address_proof', label: "Husband's death certificate" }],
    source: DEMO_SOURCE('https://nsap.nic.in/'),
  },
  {
    code: 'IGNDPS', name: 'Indira Gandhi Disability Pension', provider: 'Ministry of Rural Development (NSAP)',
    program: 'NSAP — Indira Gandhi National Disability Pension Scheme — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'Monthly pension for people aged 18+ with severe or multiple disability, in a household below the poverty line. Demonstration figures only.',
    eligibility: { minAge: 18, minDisabilityPct: 80, rationCardTypes: ['BPL', 'AAY'] },
    requiredDocuments: [ID, BANK, RATION, DISAB],
    source: DEMO_SOURCE('https://nsap.nic.in/'),
  },
  {
    code: 'APY', name: 'Atal Pension Yojana', provider: 'PFRDA',
    program: 'Atal Pension Yojana — guaranteed pension for the unorganised sector — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'A contributory scheme giving a guaranteed ₹1,000–₹5,000 monthly pension from age 60. Join between 18 and 40; income-tax payers are excluded. Demonstration figures only.',
    eligibility: { minAge: 18, maxAge: 40 },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://www.npscra.nsdl.co.in/scheme-details.php'),
  },
  {
    code: 'PM-SYM', name: 'PM Shram Yogi Maandhan', provider: 'Ministry of Labour & Employment',
    program: 'PM-SYM — pension for unorganised workers — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'A voluntary, contributory pension (₹3,000/month from age 60) for unorganised workers earning up to ₹15,000 a month, aged 18–40. Demonstration figures only.',
    eligibility: {
      minAge: 18, maxAge: 40, maxAnnualIncomePaise: R(1_80_000),
      occupations: ['daily_wager', 'domestic_worker', 'street_vendor', 'artisan', 'agri_labourer', 'self_employed'],
    },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://maandhan.in/'),
  },
  {
    code: 'PM-KMY', name: 'PM Kisan Maandhan', provider: 'Department of Agriculture & Farmers Welfare',
    program: 'PM-KMY — pension for small & marginal farmers — demonstration rule set',
    displayCategory: 'Pension', kind: 'pension',
    description: 'A voluntary, contributory pension (₹3,000/month from age 60) for small and marginal farmers (up to 2 ha), aged 18–40. Demonstration figures only.',
    eligibility: { minAge: 18, maxAge: 40, occupations: ['farmer'], maxLandHoldingHectares: 2 },
    requiredDocuments: [ID, BANK, LAND],
    source: DEMO_SOURCE('https://maandhan.in/'),
  },

  // ── Insurance / health ───────────────────────────────────────────────────
  {
    code: 'PMJJBY', name: 'PM Jeevan Jyoti Bima Yojana', provider: 'Department of Financial Services',
    program: 'PMJJBY — life cover — demonstration rule set',
    displayCategory: 'Insurance', kind: 'insurance',
    description: 'A one-year renewable term life cover of ₹2 lakh for a small annual premium, for bank/post-office account holders aged 18–50. Demonstration figures only.',
    eligibility: { minAge: 18, maxAge: 50 },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://www.jansuraksha.gov.in/'),
  },
  {
    code: 'PMSBY', name: 'PM Suraksha Bima Yojana', provider: 'Department of Financial Services',
    program: 'PMSBY — accident cover — demonstration rule set',
    displayCategory: 'Insurance', kind: 'insurance',
    description: 'A one-year renewable accidental death and disability cover of ₹2 lakh for ₹20 a year, for account holders aged 18–70. Demonstration figures only.',
    eligibility: { minAge: 18, maxAge: 70 },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://www.jansuraksha.gov.in/'),
  },
  {
    code: 'AB-PMJAY', name: 'Ayushman Bharat (PM-JAY)', provider: 'National Health Authority',
    program: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana — ₹5 lakh health cover — demonstration rule set',
    displayCategory: 'Health', kind: 'health',
    description: 'Cashless hospitalisation cover of ₹5 lakh per family per year for deprived rural households and identified urban occupational categories (SECC / State lists), plus all senior citizens aged 70+. Demonstration figures only.',
    eligibility: { rationCardTypes: ['BPL', 'AAY', 'PHH'], maxAnnualIncomePaise: R(3_00_000) },
    requiredDocuments: [ID, RATION],
    source: DEMO_SOURCE('https://pmjay.gov.in/'),
  },
  {
    code: 'PMFBY', name: 'PM Fasal Bima Yojana', provider: 'Department of Agriculture & Farmers Welfare',
    program: 'Pradhan Mantri Fasal Bima Yojana — crop insurance — demonstration rule set',
    displayCategory: 'Insurance', kind: 'insurance',
    description: 'Subsidised crop insurance against natural calamities, pests and disease for notified crops in notified areas. Demonstration figures only.',
    eligibility: { occupations: ['farmer', 'agri_labourer'] },
    requiredDocuments: [ID, BANK, LAND, { type: 'business_proof', label: 'Sowing certificate / crop details' }],
    source: DEMO_SOURCE('https://pmfby.gov.in/'),
  },

  // ── Housing ──────────────────────────────────────────────────────────────
  {
    code: 'PMAY-G', name: 'PM Awas Yojana — Gramin', provider: 'Ministry of Rural Development',
    program: 'PMAY-Gramin — pucca house assistance — demonstration rule set',
    displayCategory: 'Housing', kind: 'housing',
    description: 'Financial assistance to build a pucca house for rural households that are houseless or living in a kutcha house, as per the SECC / Awaas+ list. Demonstration figures only.',
    eligibility: { location: { areaTypes: ['rural'] }, rationCardTypes: ['BPL', 'AAY', 'PHH'], maxAnnualIncomePaise: R(3_00_000) },
    requiredDocuments: [ID, BANK, RATION, { type: 'no_house_declaration', label: 'No-pucca-house declaration' }],
    source: DEMO_SOURCE('https://pmayg.nic.in/'),
  },
  {
    code: 'PMAY-U2', name: 'PM Awas Yojana — Urban 2.0', provider: 'Ministry of Housing & Urban Affairs',
    program: 'PMAY-Urban 2.0 — housing for EWS / LIG / MIG — demonstration rule set',
    displayCategory: 'Housing', kind: 'housing',
    description: 'Assistance to buy, build or take a subsidised home loan for urban EWS / LIG / MIG families that do not own a pucca house anywhere in India. Demonstration figures only.',
    eligibility: { location: { areaTypes: ['urban', 'semi_urban'] }, maxAnnualIncomePaise: R(9_00_000) },
    requiredDocuments: [ID, BANK, INCOME, { type: 'no_house_declaration', label: 'No-pucca-house self-declaration' }],
    source: DEMO_SOURCE('https://pmay-urban.gov.in/'),
  },

  // ── Scholarships (National Scholarship Portal) ───────────────────────────
  {
    code: 'SCH-PREMATRIC-SC', name: 'Pre-Matric Scholarship (SC)', provider: 'Ministry of Social Justice & Empowerment',
    program: 'Pre-Matric Scholarship for SC students (Class 9–10) — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for Scheduled Caste students in Class 9 and 10 whose parents/guardians earn up to ₹2.5 lakh a year. Demonstration figures only.',
    eligibility: { categories: ['SC'], studentRequired: true, minEducationLevel: 'class_8', maxEducationLevel: 'class_10', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, CASTE, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'SCH-POSTMATRIC-SC', name: 'Post-Matric Scholarship (SC)', provider: 'Ministry of Social Justice & Empowerment',
    program: 'Post-Matric Scholarship for SC students — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for Scheduled Caste students studying at Class 11 and above (including college), family income up to ₹2.5 lakh a year. Demonstration figures only.',
    eligibility: { categories: ['SC'], studentRequired: true, minEducationLevel: 'class_10', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, CASTE, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'SCH-PREMATRIC-OBC', name: 'Pre-Matric Scholarship (OBC)', provider: 'Ministry of Social Justice & Empowerment',
    program: 'Pre-Matric Scholarship for OBC students (Class 9–10) — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for OBC students in Class 9 and 10, family income up to ₹2.5 lakh a year. Demonstration figures only.',
    eligibility: { categories: ['OBC'], studentRequired: true, minEducationLevel: 'class_8', maxEducationLevel: 'class_10', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, CASTE, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'SCH-POSTMATRIC-OBC', name: 'Post-Matric Scholarship (OBC)', provider: 'Ministry of Social Justice & Empowerment',
    program: 'Post-Matric Scholarship for OBC students — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for OBC students at Class 11 and above, family income up to ₹1.5 lakh a year. Demonstration figures only.',
    eligibility: { categories: ['OBC'], studentRequired: true, minEducationLevel: 'class_10', maxAnnualIncomePaise: R(1_50_000) },
    requiredDocuments: [ID, BANK, CASTE, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'PM-YASASVI', name: 'PM-YASASVI Scholarship', provider: 'Ministry of Social Justice & Empowerment',
    program: 'PM Young Achievers Scholarship (OBC / EBC / DNT) — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Top-class scholarship for OBC, Economically Backward Class and De-notified Tribe students from Class 9 upward, family income up to ₹2.5 lakh a year, selected through the YASASVI entrance test. Demonstration figures only.',
    eligibility: { categories: ['OBC', 'EWS'], studentRequired: true, minEducationLevel: 'class_8', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, CASTE, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'SCH-MCM-MINORITY', name: 'Merit-cum-Means Scholarship (Minority)', provider: 'Ministry of Minority Affairs',
    program: 'Merit-cum-Means based scholarship for professional & technical courses (minority) — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for students of notified minority communities in professional and technical courses at UG/PG level, family income up to ₹2.5 lakh a year. Demonstration figures only.',
    eligibility: { categories: ['MINORITY'], studentRequired: true, minEducationLevel: 'class_12', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, INCOME, ENROL, MARKS, { type: 'minority_declaration', label: 'Minority community declaration' }],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'NMMSS', name: 'National Means-cum-Merit Scholarship', provider: 'Department of School Education & Literacy',
    program: 'NMMSS — scholarship for meritorious students Class 9–12 — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship of ₹12,000 a year for meritorious students of economically weaker sections from Class 9 to 12, family income up to ₹3.5 lakh a year, selected through a State test. Demonstration figures only.',
    eligibility: { studentRequired: true, minEducationLevel: 'class_8', maxEducationLevel: 'class_12', maxAnnualIncomePaise: R(3_50_000) },
    requiredDocuments: [ID, BANK, INCOME, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },
  {
    code: 'CBSE-SGC', name: 'CBSE Single Girl Child Scholarship', provider: 'Central Board of Secondary Education',
    program: 'CBSE Merit Scholarship Scheme for Single Girl Child — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for a single girl child of her parents who has secured 60%+ in the CBSE Class 10 exam and is continuing in Class 11–12 in a CBSE school. Demonstration figures only.',
    eligibility: { genders: ['female'], studentRequired: true, minEducationLevel: 'class_10', maxEducationLevel: 'class_12' },
    requiredDocuments: [ID, BANK, ENROL, MARKS, { type: 'address_proof', label: 'Single girl child affidavit' }],
    source: DEMO_SOURCE('https://www.cbse.gov.in/'),
  },
  {
    code: 'AICTE-PRAGATI', name: 'AICTE Pragati Scholarship (Girls)', provider: 'All India Council for Technical Education',
    program: 'AICTE Pragati — scholarship for girl students in technical education — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Tuition and incidental support for up to two girls per family admitted to a degree or diploma in a technical institution, family income up to ₹8 lakh a year. Demonstration figures only.',
    eligibility: { genders: ['female'], studentRequired: true, minEducationLevel: 'class_12', maxAnnualIncomePaise: R(8_00_000) },
    requiredDocuments: [ID, BANK, INCOME, ENROL, { type: 'admission_letter', label: 'Admission letter (technical course)' }],
    source: DEMO_SOURCE('https://www.aicte-india.org/schemes/students-development-schemes'),
  },
  {
    code: 'AICTE-SAKSHAM', name: 'AICTE Saksham Scholarship (Disability)', provider: 'All India Council for Technical Education',
    program: 'AICTE Saksham — scholarship for differently-abled students in technical education — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Support for specially-abled students (40%+ disability) admitted to a technical degree or diploma, family income up to ₹8 lakh a year. Demonstration figures only.',
    eligibility: { minDisabilityPct: 40, studentRequired: true, minEducationLevel: 'class_12', maxAnnualIncomePaise: R(8_00_000) },
    requiredDocuments: [ID, BANK, INCOME, DISAB, { type: 'admission_letter', label: 'Admission letter (technical course)' }],
    source: DEMO_SOURCE('https://www.aicte-india.org/schemes/students-development-schemes'),
  },
  {
    code: 'PWD-PREMATRIC', name: 'Pre-Matric Scholarship (Disability)', provider: 'Department of Empowerment of Persons with Disabilities',
    program: 'Pre-Matric Scholarship for students with disabilities (Class 9–10) — demonstration rule set',
    displayCategory: 'Scholarship', kind: 'scholarship',
    description: 'Scholarship for students with 40%+ disability in Class 9 and 10, family income up to ₹2.5 lakh a year. Demonstration figures only.',
    eligibility: { minDisabilityPct: 40, studentRequired: true, minEducationLevel: 'class_8', maxEducationLevel: 'class_10', maxAnnualIncomePaise: R(2_50_000) },
    requiredDocuments: [ID, BANK, INCOME, DISAB, ENROL, MARKS],
    source: DEMO_SOURCE('https://scholarships.gov.in/'),
  },

  // ── Girl child / women savings ───────────────────────────────────────────
  {
    code: 'SSY', name: 'Sukanya Samriddhi Yojana', provider: 'Department of Economic Affairs / India Post',
    program: 'Sukanya Samriddhi Account — small savings for a girl child — demonstration rule set',
    displayCategory: 'Savings', kind: 'welfare',
    description: 'A high-interest, tax-free savings account a parent/guardian opens for a girl child before she turns 10. Demonstration figures only.',
    eligibility: { genders: ['female'], maxAge: 10 },
    requiredDocuments: [ID, { type: 'address_proof', label: "Girl child's birth certificate" }],
    source: DEMO_SOURCE('https://www.nsiindia.gov.in/InternalPage.aspx?Id_Pk=89'),
  },
  {
    code: 'MSSC', name: 'Mahila Samman Savings Certificate', provider: 'Department of Economic Affairs / India Post',
    program: 'Mahila Samman Savings Certificate — two-year deposit for women — demonstration rule set',
    displayCategory: 'Savings', kind: 'welfare',
    description: 'A two-year small-savings deposit (up to ₹2 lakh) at a fixed 7.5% for any woman or a guardian on behalf of a girl. Demonstration figures only.',
    eligibility: { genders: ['female'] },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://www.nsiindia.gov.in/'),
  },

  // ── Skilling / employment ────────────────────────────────────────────────
  {
    code: 'PMKVY', name: 'PM Kaushal Vikas Yojana', provider: 'Ministry of Skill Development & Entrepreneurship',
    program: 'PMKVY 4.0 — free short-term skill training & certification — demonstration rule set',
    displayCategory: 'Skilling', kind: 'skilling',
    description: 'Free short-term skill training, assessment and certification (with some on-the-job training) for school/college dropouts and unemployed youth. Demonstration figures only.',
    eligibility: { minAge: 15, maxAge: 45, occupations: ['unemployed', 'student', 'daily_wager', 'homemaker'] },
    requiredDocuments: [ID, BANK],
    source: DEMO_SOURCE('https://www.pmkvyofficial.org/'),
  },
  {
    code: 'DDU-GKY', name: 'DDU-GKY (Rural Skilling)', provider: 'Ministry of Rural Development',
    program: 'Deen Dayal Upadhyaya Grameen Kaushalya Yojana — placement-linked skilling — demonstration rule set',
    displayCategory: 'Skilling', kind: 'skilling',
    description: 'Placement-linked skill training for rural poor youth aged 15–35, with wage-employment on completion. Demonstration figures only.',
    eligibility: { location: { areaTypes: ['rural'] }, minAge: 15, maxAge: 35, occupations: ['unemployed', 'daily_wager', 'agri_labourer', 'homemaker'] },
    requiredDocuments: [ID, BANK, RATION],
    source: DEMO_SOURCE('https://ddugky.gov.in/'),
  },
  {
    code: 'PM-DAKSH', name: 'PM-DAKSH Skilling', provider: 'Ministry of Social Justice & Empowerment',
    program: 'PM-DAKSH Yojana — skill training for target-group households — demonstration rule set',
    displayCategory: 'Skilling', kind: 'skilling',
    description: 'Free skill development training with a stipend for SC, OBC, EWS, DNT, safai karamchari and waste-picker households, aged 18–45. Demonstration figures only.',
    eligibility: { categories: ['SC', 'OBC', 'EWS', 'MINORITY'], minAge: 18, maxAge: 45 },
    requiredDocuments: [ID, BANK, CASTE, INCOME],
    source: DEMO_SOURCE('https://pmdaksh.dosje.gov.in/'),
  },
  {
    code: 'NAPS', name: 'National Apprenticeship (NAPS)', provider: 'Ministry of Skill Development & Entrepreneurship',
    program: 'National Apprenticeship Promotion Scheme — apprenticeship with stipend — demonstration rule set',
    displayCategory: 'Skilling', kind: 'skilling',
    description: 'Apprenticeship training with a monthly stipend (part shared by the government) for candidates aged 14+ who have passed at least Class 8. Demonstration figures only.',
    eligibility: { minAge: 14, minEducationLevel: 'class_8' },
    requiredDocuments: [ID, BANK, MARKS],
    source: DEMO_SOURCE('https://www.apprenticeshipindia.gov.in/'),
  },
  {
    code: 'PM-INTERNSHIP', name: 'PM Internship Scheme', provider: 'Ministry of Corporate Affairs',
    program: 'PM Internship Scheme — 12-month internships in top companies — demonstration rule set',
    displayCategory: 'Skilling', kind: 'skilling',
    description: 'A 12-month internship in a top company with a monthly assistance and a one-time grant, for youth aged 21–24 who are not employed full-time or in full-time education, family income up to ₹8 lakh a year. Demonstration figures only.',
    eligibility: { minAge: 21, maxAge: 24, occupations: ['unemployed', 'student'], maxAnnualIncomePaise: R(8_00_000) },
    requiredDocuments: [ID, BANK, MARKS],
    source: DEMO_SOURCE('https://pminternship.mca.gov.in/'),
  },

  // ── Farmer / women collectives ──────────────────────────────────────────
  {
    code: 'PM-KUSUM', name: 'PM-KUSUM (Solar for Farmers)', provider: 'Ministry of New & Renewable Energy',
    program: 'PM-KUSUM — solar pumps and grid-connected solar plants for farmers — demonstration rule set',
    displayCategory: 'Subsidy', kind: 'income_support',
    description: 'Central and State subsidy (typically ~60%) for standalone solar pumps or small grid-connected solar plants on a farmer’s land, with a bank loan for the rest. Demonstration figures only.',
    eligibility: { occupations: ['farmer'] },
    requiredDocuments: [ID, BANK, LAND],
    source: DEMO_SOURCE('https://pmkusum.mnre.gov.in/'),
  },
  {
    code: 'LAKHPATI-DIDI', name: 'Lakhpati Didi', provider: 'Ministry of Rural Development (DAY-NRLM)',
    program: 'Lakhpati Didi initiative — skilling & enterprise support for SHG women — demonstration rule set',
    displayCategory: 'Livelihood', kind: 'welfare',
    description: 'Skilling, credit linkage and enterprise support for women in Self-Help Groups under DAY-NRLM, aimed at a household income of at least ₹1 lakh a year. Demonstration figures only.',
    eligibility: { genders: ['female'], occupations: ['shg_member', 'homemaker', 'self_employed', 'farmer'] },
    requiredDocuments: [ID, BANK, { type: 'shg_membership_proof', label: 'SHG membership proof' }],
    source: DEMO_SOURCE('https://www.myscheme.gov.in/schemes/ld'),
  },

  // ── Startup ─────────────────────────────────────────────────────────────
  {
    code: 'SISFS', name: 'Startup India Seed Fund', provider: 'DPIIT',
    program: 'Startup India Seed Fund Scheme — grant / debt for early-stage startups — demonstration rule set',
    displayCategory: 'Startup', kind: 'welfare',
    description: 'Up to ₹20 lakh as a grant for proof of concept, and up to ₹50 lakh as debt/convertible for commercialisation, for DPIIT-recognised startups incorporated not more than 2 years ago. Demonstration figures only.',
    eligibility: { minAge: 18, occupations: ['self_employed', 'unemployed', 'private_salaried', 'student'] },
    requiredDocuments: [ID, BANK, { type: 'project_report', label: 'Pitch deck / project report' }, { type: 'business_proof', label: 'DPIIT recognition certificate' }],
    source: DEMO_SOURCE('https://seedfund.startupindia.gov.in/'),
  },
].map((s) => ({ ...NON_LOAN, ...s }));
