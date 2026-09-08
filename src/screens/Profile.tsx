import { useEffect, useState } from 'react';
import { PageTitle, Button, Loading, ErrorState } from '../components/ui';
import { useProfile, useUpdateProfile } from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { paiseToRupees, rupeesToPaise, placeError } from '../lib/format';
import type { AreaType, Purpose, SocialCategory } from '../api/types';

const CATEGORIES: SocialCategory[] = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const AREAS: AreaType[] = ['rural', 'urban', 'semi_urban'];
const PURPOSES: Purpose[] = [
  'business_new', 'business_expansion', 'equipment_purchase', 'working_capital',
  'education', 'skilling', 'agriculture', 'housing', 'vehicle', 'personal',
];

type FormState = {
  fullName: string;
  age: string;
  annualIncome: string;
  category: string;
  state: string;
  district: string;
  areaType: string;
  purpose: string;
  hasBusinessPlan: string;
  businessActivity: string;
  educationCourse: string;
  projectCost: string;
  ownContribution: string;
  requestedLoan: string;
};

const rupeeStr = (paise: number | null | undefined) => (paise == null ? '' : String(paiseToRupees(paise)));

export function Profile() {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const { toast, errorToast } = useToast();
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      fullName: p.fullName ?? '',
      age: p.age != null ? String(p.age) : '',
      annualIncome: rupeeStr(p.annualIncomePaise),
      category: p.category ?? '',
      state: p.state ?? '',
      district: p.district ?? '',
      areaType: p.areaType ?? '',
      purpose: p.purpose ?? '',
      hasBusinessPlan: p.hasBusinessPlan == null ? '' : p.hasBusinessPlan ? 'yes' : 'no',
      businessActivity: p.businessDetails?.activity ?? '',
      educationCourse: p.educationDetails?.course ?? '',
      projectCost: rupeeStr(p.projectCostPaise),
      ownContribution: rupeeStr(p.ownContributionPaise),
      requestedLoan: rupeeStr(p.requestedLoanPaise),
    });
  }, [data]);

  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (isLoading || !form || !data) return <Loading label="Loading your profile…" />;

  const MAX_RUPEES = 100_000_000; // ₹10 crore — matches the server cap
  const FIELD_TO_PATH: Partial<Record<keyof FormState, string>> = {
    annualIncome: 'annualIncomePaise',
    projectCost: 'projectCostPaise',
    ownContribution: 'ownContributionPaise',
    requestedLoan: 'requestedLoanPaise',
  };
  const set = (k: keyof FormState, v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    const path = FIELD_TO_PATH[k] ?? k;
    setFieldErrors((e) => (e[path] || e[k] ? { ...e, [path]: '', [k]: '' } : e));
  };
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  /** Client-side validation so garbage never silently coerces to null on save. */
  function validate(f: FormState): Record<string, string> {
    const e: Record<string, string> = {};
    if (f.fullName.trim() && f.fullName.trim().length < 2) e.fullName = 'Enter your full name';
    if (f.age.trim() !== '') {
      if (!/^\d+$/.test(f.age.trim())) e.age = 'Age must be a whole number (digits only)';
      else if (Number(f.age) < 16 || Number(f.age) > 100) e.age = 'Age must be between 16 and 100';
    }
    for (const k of ['state', 'district'] as const) {
      const pe = placeError(f[k]);
      if (pe) e[k] = pe;
    }
    const money: [keyof FormState, string][] = [
      ['annualIncome', 'annualIncomePaise'],
      ['projectCost', 'projectCostPaise'],
      ['ownContribution', 'ownContributionPaise'],
      ['requestedLoan', 'requestedLoanPaise'],
    ];
    for (const [k, path] of money) {
      const raw = f[k].trim();
      if (raw === '') continue;
      if (!/^\d+$/.test(raw)) e[path] = 'Enter a whole rupee amount (digits only)';
      else if (Number(raw) > MAX_RUPEES) e[path] = `Enter rupees, not paise — maximum ₹${MAX_RUPEES.toLocaleString('en-IN')}`;
    }
    return e;
  }

  async function save() {
    if (!form) return;
    const clientErrs = validate(form);
    if (Object.keys(clientErrs).length) {
      setFieldErrors(clientErrs);
      errorToast('Please correct the highlighted fields.');
      return;
    }
    setFieldErrors({});
    const patch: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      age: num(form.age),
      annualIncomePaise: form.annualIncome.trim() === '' ? null : rupeesToPaise(Number(form.annualIncome)),
      category: form.category || null,
      state: form.state.trim() || null,
      district: form.district.trim() || null,
      areaType: form.areaType || null,
      purpose: form.purpose || null,
      hasBusinessPlan: form.hasBusinessPlan === '' ? null : form.hasBusinessPlan === 'yes',
      businessDetails: { activity: form.businessActivity.trim() },
      educationDetails: { course: form.educationCourse.trim() },
      projectCostPaise: form.projectCost.trim() === '' ? null : rupeesToPaise(Number(form.projectCost)),
      ownContributionPaise: form.ownContribution.trim() === '' ? null : rupeesToPaise(Number(form.ownContribution)),
      requestedLoanPaise: form.requestedLoan.trim() === '' ? null : rupeesToPaise(Number(form.requestedLoan)),
    };
    try {
      await update.mutateAsync(patch);
      toast('Profile saved. Your recommendations have been refreshed.');
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        errorToast('Please correct the highlighted fields.');
      } else {
        errorToast(err instanceof ApiError ? err.message : 'Could not save your profile.');
      }
    }
  }

  const pct = data.completeness.percent;
  const err = (k: string) => fieldErrors[k] && <span className="field-error">{fieldErrors[k]}</span>;

  return (
    <>
      <PageTitle title="My Profile">Keep your details current for more accurate scheme recommendations.</PageTitle>
      <article className="card form-card">
        <div className="profile-progress">
          <div>
            <b>Profile Completion: {pct}%</b>
            <span>{data.completeness.missing.length} detail(s) still needed for full matching</span>
          </div>
          <div className="progress">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="form-grid">
          <label>
            Full name
            <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            {err('fullName')}
          </label>
          <label>
            Age
            <input type="number" inputMode="numeric" min={16} max={100} value={form.age} onChange={(e) => set('age', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('age')}
          </label>
          <label>
            Annual household income (₹)
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.annualIncome} onChange={(e) => set('annualIncome', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('annualIncomePaise')}
          </label>
          <label>
            Category
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label>
            State
            <input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={60} />
            {err('state')}
          </label>
          <label>
            District
            <input value={form.district} onChange={(e) => set('district', e.target.value)} maxLength={60} />
            {err('district')}
          </label>
          <label>
            Area type
            <select value={form.areaType} onChange={(e) => set('areaType', e.target.value)}>
              <option value="">Select…</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Financing purpose
            <select value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
              <option value="">Select…</option>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label>
            Business / activity
            <input value={form.businessActivity} onChange={(e) => set('businessActivity', e.target.value)} />
          </label>
          <label>
            Course (if education/skilling)
            <input value={form.educationCourse} onChange={(e) => set('educationCourse', e.target.value)} />
          </label>
          <label>
            Have a business plan / project report?
            <select value={form.hasBusinessPlan} onChange={(e) => set('hasBusinessPlan', e.target.value)}>
              <option value="">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label>
            Project cost (₹)
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.projectCost} onChange={(e) => set('projectCost', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('projectCostPaise')}
          </label>
          <label>
            Own contribution (₹)
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.ownContribution} onChange={(e) => set('ownContribution', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('ownContributionPaise')}
          </label>
          <label>
            Requested loan (₹)
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.requestedLoan} onChange={(e) => set('requestedLoan', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('requestedLoanPaise')}
          </label>
        </div>

        <p className="inline-note">
          Project cost, own contribution and requested loan are separate figures. A scheme’s percentage of project-cost
          financing is applied to your <b>project cost</b>, not directly to your requested loan.
        </p>

        <div className="form-actions">
          <Button onClick={save} loading={update.isPending}>
            Save Profile
          </Button>
        </div>
      </article>
    </>
  );
}
