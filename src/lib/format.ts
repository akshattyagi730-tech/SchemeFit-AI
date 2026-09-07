export { formatPaise, paiseToRupees, rupeesToPaise } from './finance';

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const formatDate = (iso?: string | null): string => (iso ? dateFmt.format(new Date(iso)) : '—');
export const formatDateTime = (iso?: string | null): string => (iso ? dateTimeFmt.format(new Date(iso)) : '—');

export const bpsToPct = (bps: number): string => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : 2)}%`;

export const PURPOSE_LABELS: Record<string, string> = {
  business_new: 'Start a new business',
  business_expansion: 'Expand an existing business',
  equipment_purchase: 'Purchase equipment',
  working_capital: 'Working capital',
  education: 'Formal education',
  skilling: 'Certified skilling course',
};

export const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'General',
  OBC: 'OBC',
  SC: 'Scheduled Caste (SC)',
  ST: 'Scheduled Tribe (ST)',
  EWS: 'EWS',
  MINORITY: 'Minority',
};

export const AREA_LABELS: Record<string, string> = { rural: 'Rural', urban: 'Urban', semi_urban: 'Semi-urban' };

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  ASSIGNED: 'Partner assigned',
  UNDER_REVIEW: 'Under review',
  CHANGES_REQUESTED: 'Changes requested',
  APPROVED: 'Approved (prototype)',
  REJECTED: 'Rejected (prototype)',
};

export const DOC_STATE_LABELS: Record<string, string> = {
  missing: 'Missing',
  uploaded: 'Submitted',
  under_review: 'Under review',
  verified: 'Verified',
  changes_requested: 'Changes requested',
};
