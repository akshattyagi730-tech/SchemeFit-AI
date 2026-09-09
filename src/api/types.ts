/** Wire types for the SchemeFit AI API. All money is integer paise. */

export type Role = 'CITIZEN' | 'PARTNER' | 'ADMIN';
export type Workspace = 'citizen' | 'partner';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  displayName: string;
  partnerOrganizationId: string | null;
  accountStatus: 'active' | 'suspended';
}

export interface MeResponse {
  user: AuthUser;
  session: { expiresAt: string; issuedAt: string };
  profileComplete: boolean;
}

export type SocialCategory = 'GENERAL' | 'OBC' | 'SC' | 'ST' | 'EWS' | 'MINORITY';
export type AreaType = 'rural' | 'urban' | 'semi_urban';
export type Purpose =
  | 'business_new'
  | 'business_expansion'
  | 'equipment_purchase'
  | 'working_capital'
  | 'education'
  | 'skilling'
  | 'agriculture'
  | 'housing'
  | 'vehicle'
  | 'personal';

export interface CitizenProfile {
  id: string;
  fullName: string;
  age: number | null;
  annualIncomePaise: number | null;
  category: SocialCategory | null;
  /** Only meaningful when category === 'OBC'. true = Creamy Layer, false = Non-Creamy Layer. */
  obcCreamyLayer: boolean | null;
  state: string | null;
  district: string | null;
  areaType: AreaType | null;
  location: { lat: number; lng: number } | null;
  purpose: Purpose | null;
  businessDetails: { activity: string; stage: string; yearsRunning: number | null };
  educationDetails: { level: string; course: string; institution: string };
  hasBusinessPlan: boolean | null;
  projectCostPaise: number | null;
  ownContributionPaise: number | null;
  requestedLoanPaise: number | null;
  updatedAt: string;
}

export interface ProfileResponse {
  profile: CitizenProfile;
  completeness: { percent: number; missing: string[] };
}

export interface SchemeMoratorium {
  allowed: boolean;
  maxMonths: number;
  interestHandling: 'serviced' | 'capitalised';
  tenureIncludesMoratorium: boolean;
}

export interface Scheme {
  id: string;
  code: string;
  name: string;
  provider: string;
  program: string;
  displayCategory: string;
  description: string;
  supportedPurposes: Purpose[];
  eligibility: Record<string, unknown>;
  financing: {
    minAmountPaise: number;
    maxAmountPaise: number;
    maxProjectCostSharePct: number;
    minOwnContributionPct: number;
  };
  terms: {
    minInterestRateBps: number;
    maxInterestRateBps: number;
    minTenureMonths: number;
    maxTenureMonths: number;
    moratorium: SchemeMoratorium;
  };
  requiredDocuments: { type: string; label: string; optional?: boolean }[];
  source: { url: string; version: string; demoData: boolean; verificationDate: string | null };
  /** Official / authorised government portal for this scheme (HTTPS), or null when none applies. */
  officialUrl: string | null;
  dataClassification: 'demonstration-data' | 'verified';
  status: 'active' | 'archived';
}

export interface Condition {
  key: string;
  label: string;
  outcome: 'passed' | 'failed' | 'unknown';
  detail: string;
}

export interface RankingFactor {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  explanation: string;
}

export interface Recommendation {
  scheme: Scheme;
  eligibility: {
    status: 'eligible' | 'ineligible' | 'needs_information';
    conditions: Condition[];
    passed: string[];
    failed: { key: string; label: string; detail: string }[];
    unknown: { key: string; label: string; detail: string }[];
    advisories: { key: string; label: string; detail: string }[];
  };
  suitability?: { score: number; factors: RankingFactor[]; disclaimer: string };
}

export interface RecommendationsResponse {
  generatedAt: string;
  profileComplete: boolean;
  counts: { eligible: number; needsInformation: number; ineligible: number };
  eligible: Recommendation[];
  needsInformation: Recommendation[];
  ineligible: Recommendation[];
  notes: string[];
}

export interface DocChecklistItem {
  type: string;
  label: string;
  mandatory: boolean;
  status: 'missing' | 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
  provided: boolean;
  requiredByCount: number;
  optionalForCount: number;
  requiredBy: { code: string; name: string }[];
  optionalFor: { code: string; name: string }[];
}

export interface DocumentChecklistResponse {
  generatedAt: string;
  consideredSchemes: { code: string; name: string; status: 'eligible' | 'needs_information' }[];
  summary: {
    consideredSchemeCount: number;
    distinctDocuments: number;
    mandatoryDocuments: number;
    mandatoryProvided: number;
    mandatoryVerified: number;
  };
  items: DocChecklistItem[];
  notes: string[];
}

export interface AmortRow {
  period: number;
  openingBalancePaise: number;
  paymentPaise: number;
  principalPaise: number;
  interestPaise: number;
  closingBalancePaise: number;
}

export interface FinancePlan {
  currency: 'INR-paise';
  principalPaise: number;
  schemeFinancingCapPaise: number;
  financingGapPaise: number;
  repaymentMonths: number;
  monthlyInstalmentPaise: number;
  finalInstalmentPaise: number;
  totalInterestPaise: number;
  totalRepaymentPaise: number;
  moratoriumInterestPaise: number;
  moratoriumSchedule: { period: number; interestPaise: number; paymentPaise: number }[];
  amortizationSchedule: AmortRow[];
  assumptions: string[];
  validationMessages: string[];
}

export interface RoutingFactor {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  detail: string;
}

export interface PartnerRoute {
  partnerId: string;
  name: string;
  type: string;
  score: number;
  factors: RoutingFactor[];
  distanceKm: number | null;
  distanceBasis: 'haversine_straight_line';
  metricsSimulated: boolean;
  metricsAsOf: string;
  reason: string;
}

export interface RoutingOutcome {
  matched: boolean;
  schemeCode: string;
  recommended: PartnerRoute | null;
  candidates: PartnerRoute[];
  excluded: { partnerId: string; name: string; reasons: string[] }[];
  reason: string;
}

export interface PartnerPublic {
  id: string;
  name: string;
  type: string;
  location: { lat: number; lng: number; address: string };
  supportedSchemeCodes: string[];
  focusSchemeCodes: string[];
  authorization: string;
  status: string;
  acceptingApplications: boolean;
  capacity: number;
  activeAssignments: number;
  freeSlots: number;
  operationalMetricsSimulated: boolean;
}

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'ASSIGNED'
  | 'UNDER_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'APPROVED'
  | 'REJECTED';

export interface ReadinessLine {
  type: string;
  label: string;
  optional: boolean;
  state: 'missing' | 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
}

export interface Readiness {
  requiredTotal: number;
  requiredSubmitted: number;
  requiredVerified: number;
  optionalSubmitted: number;
  optionalVerified: number;
  submittedPct: number;
  verifiedPct: number;
  changesRequested: number;
  complete: boolean;
  lines: ReadinessLine[];
}

export interface TimelineEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorRole: string;
  reason: string;
  at: string;
}

export interface Application {
  id: string;
  reference: string;
  status: ApplicationStatus;
  schemeCode: string;
  schemeVersion: string;
  scheme: { code: string; name: string; provider: string; program: string; displayCategory: string } | null;
  financing: {
    projectCostPaise: number | null;
    ownContributionPaise: number | null;
    requestedLoanPaise: number | null;
    interestRateBps: number | null;
    tenureMonths: number | null;
    moratoriumMonths: number;
  };
  financingSnapshot: Record<string, number> | null;
  profileSnapshot: Record<string, unknown> | null;
  eligibilitySnapshot: { status: string | null; conditions: Condition[]; evaluatedAt: string | null } | null;
  financePlanSnapshot: FinancePlan | null;
  assignedPartnerId: string | null;
  assignedPartnerName: string | null;
  assignment: {
    id: string;
    partnerId: string;
    assignmentType: string;
    routingScore: number | null;
    routingFactors: RoutingFactor[];
    routingReason: string;
    distanceKm: number | null;
    distanceBasis: string;
    metricsSimulated: boolean;
    reason: string;
    assignedAt: string;
  } | null;
  readiness: Readiness | null;
  submittedAt: string | null;
  decidedAt: string | null;
  lastReviewNote: string;
  timeline: TimelineEntry[];
  createdAt: string;
  updatedAt: string;
  workflowNote: string;
}

export interface DocumentInfo {
  id: string;
  applicationId: string;
  type: string;
  label: string;
  version: number;
  current: boolean;
  supersededAt: string | null;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  reviewStatus: 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
  reviewFeedback: string;
  reviewedAt: string | null;
  reviewHistory: { status: string; feedback: string; system?: boolean; at: string }[];
  source: 'manual' | 'digilocker';
  issuedBy: string | null;
  authenticity: DocumentAuthenticity | null;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
}

export type DocTrustLevel =
  | 'issuer_verified'
  | 'e_signed'
  | 'signed_untrusted'
  | 'self_signed'
  | 'invalid'
  | 'unsigned'
  | 'not_applicable';

export interface DocumentAuthenticity {
  method: 'none' | 'pdf_signature' | 'digilocker_api';
  trustLevel: DocTrustLevel;
  authority: string | null;
  signerName: string | null;
  issuerName: string | null;
  signedAt: string | null;
  systemVerified: boolean;
  summary: string;
}

export interface DigiLockerStatus {
  connected: boolean;
  provider: 'mock' | 'live';
  name: string | null;
  maskedAadhaar: string | null;
  connectedAt: string | null;
}

export interface DigiLockerIssuedDoc {
  uri: string;
  name: string;
  docTypeCode: string;
  issuer: string;
  mime: 'application/pdf';
  sizeBytes: number;
  mapsTo: string | null;
}

export interface DocumentsResponse {
  documents: DocumentInfo[];
  requiredDocuments: { type: string; label: string; optional?: boolean }[];
  readiness: Readiness | null;
}

export interface NotificationItem {
  id: string;
  event: string;
  title: string;
  message: string;
  link: string;
  applicationId: string | null;
  read: boolean;
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PartnerSummary {
  organisation: {
    id: string;
    name: string;
    type: string;
    capacity: number;
    activeAssignments: number;
    freeSlots: number;
    acceptingApplications: boolean;
    authorization: string;
    operationalMetricsSimulated: boolean;
  } | null;
  assignedTotal: number;
  statusCounts: Record<string, number>;
  actionNeeded: number;
  note: string;
}

export interface AdminKpis {
  generatedAt: string;
  dataClassification: string;
  demoNote: string;
  applications: { total: number; drafts: number; submitted: number; statusCounts: Record<string, number> };
  funding: { requestedTotalPaise: number; basis: string };
  pipeline: {
    submittedToReviewRate: { value: number; numerator: number; denominator: number; definition: string };
    decisions: { approved: number; rejected: number };
  };
  schemesDistribution: { schemeCode: string; submittedApplications: number }[];
  partnerLoad: { name: string; capacity: number; activeAssignments: number; utilisationPct: number; status: string; authorization: string }[];
  documentChangesRequested: { type: string; count: number }[];
  counts: { citizens: number; partnersWithVerifiedDocs: number };
}

export interface Envelope<T> {
  data: T;
  meta?: { pagination?: Pagination };
}
