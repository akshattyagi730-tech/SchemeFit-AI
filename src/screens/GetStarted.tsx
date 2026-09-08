import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Briefcase, GraduationCap, Sprout, Home, Bike, Wallet, IndianRupee,
} from 'lucide-react';
import { PageTitle, Button, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useProfile, useUpdateProfile } from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { paiseToRupees, rupeesToPaise, PURPOSE_GROUPS, PURPOSE_LABELS, CATEGORY_LABELS, AREA_LABELS } from '../lib/format';

const GROUP_ICON: Record<string, typeof Briefcase> = {
  'Business & self-employment': Briefcase,
  'Education & skilling': GraduationCap,
  'Agriculture & allied': Sprout,
  Home: Home,
  'Vehicle for livelihood': Bike,
  Personal: Wallet,
};

const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const AREAS = ['rural', 'urban', 'semi_urban'];

type Form = {
  purpose: string;
  fullName: string;
  age: string;
  category: string;
  state: string;
  district: string;
  areaType: string;
  annualIncome: string;
  businessActivity: string;
  businessStage: string;
  hasBusinessPlan: string;
  educationCourse: string;
  projectCost: string;
  ownContribution: string;
  requestedLoan: string;
};

const EMPTY: Form = {
  purpose: '', fullName: '', age: '', category: '', state: '', district: '', areaType: '',
  annualIncome: '', businessActivity: '', businessStage: '', hasBusinessPlan: '', educationCourse: '',
  projectCost: '', ownContribution: '', requestedLoan: '',
};

const rupeeStr = (paise: number | null | undefined) => (paise == null ? '' : String(paiseToRupees(paise)));
const isBusiness = (p: string) => p.startsWith('business') || p === 'equipment_purchase' || p === 'working_capital';
const isStudy = (p: string) => p === 'education' || p === 'skilling';

export function GetStarted({ navigate }: { navigate: (to: string) => void }) {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const { toast, errorToast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      purpose: p.purpose ?? '',
      fullName: p.fullName ?? '',
      age: p.age != null ? String(p.age) : '',
      category: p.category ?? '',
      state: p.state ?? '',
      district: p.district ?? '',
      areaType: p.areaType ?? '',
      annualIncome: rupeeStr(p.annualIncomePaise),
      businessActivity: p.businessDetails?.activity ?? '',
      businessStage: p.businessDetails?.stage ?? '',
      hasBusinessPlan: p.hasBusinessPlan == null ? '' : p.hasBusinessPlan ? 'yes' : 'no',
      educationCourse: p.educationDetails?.course ?? '',
      projectCost: rupeeStr(p.projectCostPaise),
      ownContribution: rupeeStr(p.ownContributionPaise),
      requestedLoan: rupeeStr(p.requestedLoanPaise),
    });
  }, [data]);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const steps = useMemo(() => {
    const base = ['Purpose', 'About you', 'Your situation', 'The money', 'Review'];
    return base;
  }, []);

  const gap = useMemo(() => {
    const pc = Number(form.projectCost || 0);
    const oc = Number(form.ownContribution || 0);
    const rl = Number(form.requestedLoan || 0);
    if (!pc) return null;
    return pc - oc - rl;
  }, [form.projectCost, form.ownContribution, form.requestedLoan]);

  if (isLoading) return <Loading label="Loading…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const canNext = (() => {
    if (step === 0) return !!form.purpose;
    if (step === 1) return form.fullName.trim().length > 1 && !!form.age && !!form.category && !!form.state.trim() && !!form.district.trim() && !!form.areaType;
    if (step === 2) return !!form.annualIncome;
    if (step === 3) return !!form.projectCost && !!form.requestedLoan;
    return true;
  })();

  async function submit() {
    setFieldErrors({});
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
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
      businessDetails: { activity: form.businessActivity.trim(), stage: (form.businessStage || '') as 'idea' | 'existing' | 'expansion' | '' },
      educationDetails: { course: form.educationCourse.trim() },
      projectCostPaise: form.projectCost.trim() === '' ? null : rupeesToPaise(Number(form.projectCost)),
      ownContributionPaise: form.ownContribution.trim() === '' ? null : rupeesToPaise(Number(form.ownContribution)),
      requestedLoanPaise: form.requestedLoan.trim() === '' ? null : rupeesToPaise(Number(form.requestedLoan)),
    };
    try {
      await update.mutateAsync(patch);
      setSaved(true);
      toast('Saved. Your matches and document checklist are ready.');
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, f.message])));
        errorToast('Please correct the highlighted fields.');
      } else {
        errorToast(err instanceof ApiError ? err.message : 'Could not save.');
      }
    }
  }

  const errFor = (k: string) => fieldErrors[k] && <span className="field-error">{fieldErrors[k]}</span>;

  return (
    <>
      <PageTitle title="Tell us what you need">
        A few questions, then a deterministic rule engine checks every scheme’s stored rules against your answers. No AI
        decides eligibility.
      </PageTitle>

      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}`}>
            <i>{i < step ? <Check size={13} /> : i + 1}</i>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <article className="card wizard-card">
        {/* STEP 0 — purpose */}
        {step === 0 && (
          <div className="wizard-body">
            <h2>What do you need the loan for?</h2>
            <p className="wizard-hint">Pick the closest one. You can change it later in My Profile.</p>
            <div className="purpose-groups">
              {PURPOSE_GROUPS.map((g) => {
                const Icon = GROUP_ICON[g.group] ?? Briefcase;
                return (
                  <div className="purpose-group" key={g.group}>
                    <div className="purpose-group-head">
                      <Icon size={17} />
                      <div>
                        <b>{g.group}</b>
                        <small>{g.hint}</small>
                      </div>
                    </div>
                    <div className="purpose-options">
                      {g.purposes.map((p) => (
                        <button
                          key={p}
                          className={`purpose-pick ${form.purpose === p ? 'selected' : ''}`}
                          onClick={() => set('purpose', p)}
                        >
                          {form.purpose === p && <Check size={13} />}
                          {PURPOSE_LABELS[p] ?? p}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 1 — about you */}
        {step === 1 && (
          <div className="wizard-body">
            <h2>About you</h2>
            <p className="wizard-hint">Category and location decide which targeted schemes you qualify for.</p>
            <div className="form-grid">
              <label>
                Full name
                <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
                {errFor('fullName')}
              </label>
              <label>
                Age
                <input inputMode="numeric" value={form.age} onChange={(e) => set('age', e.target.value)} />
                {errFor('age')}
              </label>
              <label>
                Social category
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABELS[c] ?? c}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Area type
                <select value={form.areaType} onChange={(e) => set('areaType', e.target.value)}>
                  <option value="">Select…</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>
                      {AREA_LABELS[a] ?? a}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                State
                <input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. Bihar" />
              </label>
              <label>
                District
                <input value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="e.g. Sitamarhi" />
              </label>
            </div>
          </div>
        )}

        {/* STEP 2 — situation */}
        {step === 2 && (
          <div className="wizard-body">
            <h2>Your situation</h2>
            <p className="wizard-hint">Household income is checked against income-linked schemes.</p>
            <div className="form-grid">
              <label>
                Annual household income (₹)
                <input inputMode="numeric" value={form.annualIncome} onChange={(e) => set('annualIncome', e.target.value)} />
                {errFor('annualIncomePaise')}
              </label>
              {isBusiness(form.purpose) && (
                <>
                  <label>
                    What is the business / activity?
                    <input value={form.businessActivity} onChange={(e) => set('businessActivity', e.target.value)} placeholder="e.g. Furniture repair" />
                  </label>
                  <label>
                    Stage
                    <select value={form.businessStage} onChange={(e) => set('businessStage', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="idea">Idea / not started</option>
                      <option value="existing">Running</option>
                      <option value="expansion">Expanding</option>
                    </select>
                  </label>
                  <label>
                    Do you have a business plan / project report?
                    <select value={form.hasBusinessPlan} onChange={(e) => set('hasBusinessPlan', e.target.value)}>
                      <option value="">Not sure</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                </>
              )}
              {form.purpose === 'agriculture' && (
                <label>
                  Which activity?
                  <input value={form.businessActivity} onChange={(e) => set('businessActivity', e.target.value)} placeholder="e.g. Dairy unit, crop cultivation, fisheries" />
                </label>
              )}
              {isStudy(form.purpose) && (
                <label>
                  Course / programme
                  <input value={form.educationCourse} onChange={(e) => set('educationCourse', e.target.value)} placeholder="e.g. ITI — Electrician" />
                </label>
              )}
            </div>
          </div>
        )}

        {/* STEP 3 — money */}
        {step === 3 && (
          <div className="wizard-body">
            <h2>The money</h2>
            <p className="wizard-hint">
              These are three different figures. A scheme’s “% of project cost” cap applies to the <b>project cost</b>, not
              to your requested loan.
            </p>
            <div className="form-grid">
              <label>
                Total project cost (₹)
                <input inputMode="numeric" value={form.projectCost} onChange={(e) => set('projectCost', e.target.value)} />
                {errFor('projectCostPaise')}
              </label>
              <label>
                Your own contribution (₹)
                <input inputMode="numeric" value={form.ownContribution} onChange={(e) => set('ownContribution', e.target.value)} />
                {errFor('ownContributionPaise')}
              </label>
              <label>
                Loan you are requesting (₹)
                <input inputMode="numeric" value={form.requestedLoan} onChange={(e) => set('requestedLoan', e.target.value)} />
                {errFor('requestedLoanPaise')}
              </label>
            </div>
            {gap != null && gap !== 0 && (
              <p className={`inline-note ${gap > 0 ? 'warn' : ''}`}>
                {gap > 0
                  ? `Own contribution + loan is ₹${gap.toLocaleString('en-IN')} short of the project cost. Decide how that gap will be met.`
                  : `Own contribution + loan is ₹${Math.abs(gap).toLocaleString('en-IN')} more than the project cost.`}
              </p>
            )}
          </div>
        )}

        {/* STEP 4 — review */}
        {step === 4 && (
          <div className="wizard-body">
            {!saved ? (
              <>
                <h2>Check your answers</h2>
                <div className="review-grid">
                  <div><small>Purpose</small><b>{PURPOSE_LABELS[form.purpose] ?? '—'}</b></div>
                  <div><small>Name</small><b>{form.fullName || '—'}</b></div>
                  <div><small>Age</small><b>{form.age || '—'}</b></div>
                  <div><small>Category</small><b>{CATEGORY_LABELS[form.category] ?? '—'}</b></div>
                  <div><small>Location</small><b>{[form.district, form.state].filter(Boolean).join(', ') || '—'} · {AREA_LABELS[form.areaType] ?? '—'}</b></div>
                  <div><small>Annual income</small><b>{form.annualIncome ? `₹${Number(form.annualIncome).toLocaleString('en-IN')}` : '—'}</b></div>
                  <div><small>Project cost</small><b>{form.projectCost ? `₹${Number(form.projectCost).toLocaleString('en-IN')}` : '—'}</b></div>
                  <div><small>Own contribution</small><b>{form.ownContribution ? `₹${Number(form.ownContribution).toLocaleString('en-IN')}` : '—'}</b></div>
                  <div><small>Requested loan</small><b>{form.requestedLoan ? `₹${Number(form.requestedLoan).toLocaleString('en-IN')}` : '—'}</b></div>
                </div>
                <div className="wizard-cta">
                  <Button onClick={submit} loading={update.isPending}>
                    <Sparkles size={16} style={{ marginRight: 6 }} /> See my matching schemes
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="wizard-saved">
                  <span className="wizard-saved-icon"><Check /></span>
                  <div>
                    <h2>Done — your profile is saved</h2>
                    <p className="wizard-hint">Here are the documents you’ll need across your matched schemes.</p>
                  </div>
                </div>
                <DocumentChecklist compact />
                <div className="wizard-cta">
                  <Button onClick={() => navigate('/schemes')}>
                    View matching schemes <IndianRupee size={15} style={{ marginLeft: 4 }} />
                  </Button>
                  <button className="button outline" onClick={() => navigate('/documents')}>
                    Go to documents <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* nav */}
        {!(step === 4 && saved) && (
          <div className="wizard-nav">
            <button className="button soft" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft size={15} style={{ marginRight: 4 }} /> Back
            </button>
            {step < 4 && (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Continue
              </Button>
            )}
          </div>
        )}
      </article>
    </>
  );
}
