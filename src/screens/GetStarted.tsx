import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Briefcase, GraduationCap, Sprout, Home, Bike, Wallet, IndianRupee, AlertTriangle,
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
const MAX_RUPEES = 100_000_000; // ₹10 crore — matches the server cap (₹10 cr in paise)

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
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/** Which wizard step owns each field (form key AND server path). */
const FIELD_STEP: Record<string, number> = {
  fullName: 1, age: 1, category: 1, state: 1, district: 1, areaType: 1,
  annualIncome: 2, annualIncomePaise: 2, businessActivity: 2, educationCourse: 2,
  projectCost: 3, projectCostPaise: 3, ownContribution: 3, ownContributionPaise: 3,
  requestedLoan: 3, requestedLoanPaise: 3,
};
const SERVER_TO_FORM: Record<string, string> = {
  annualIncomePaise: 'annualIncome', projectCostPaise: 'projectCost',
  ownContributionPaise: 'ownContribution', requestedLoanPaise: 'requestedLoan',
};

const isPosNumber = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0;
const isNonNegNumber = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0;

export function GetStarted({ navigate }: { navigate: (to: string) => void }) {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const { toast, errorToast } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Record<string, string>>({});
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

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrs((e) => (e[k] ? { ...e, [k]: '' } : e)); // clear this field's error as the user types
  };

  const steps = ['Purpose', 'About you', 'Your situation', 'The money', 'Review'];

  const gap = useMemo(() => {
    if (!isPosNumber(form.projectCost)) return null;
    const pc = Number(form.projectCost);
    const oc = Number(form.ownContribution || 0);
    const rl = Number(form.requestedLoan || 0);
    return pc - oc - rl;
  }, [form.projectCost, form.ownContribution, form.requestedLoan]);

  /** Validate one step. Returns a field→message map (empty = valid). */
  function validateStep(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0 && !form.purpose) e.purpose = 'Choose what you need the loan for';
    if (s === 1) {
      if (form.fullName.trim().length < 2) e.fullName = 'Enter your full name';
      const age = Number(form.age);
      if (form.age.trim() === '') e.age = 'Enter your age';
      else if (!/^\d+$/.test(form.age.trim()) || !Number.isInteger(age)) e.age = 'Age must be a whole number';
      else if (age < 16 || age > 100) e.age = 'Age must be between 16 and 100';
      if (!form.category) e.category = 'Select your social category';
      if (!form.state.trim()) e.state = 'Enter your state';
      if (!form.district.trim()) e.district = 'Enter your district';
      if (!form.areaType) e.areaType = 'Select an area type';
    }
    if (s === 2) {
      if (form.annualIncome.trim() === '') e.annualIncome = 'Enter your annual household income';
      else if (!isNonNegNumber(form.annualIncome)) e.annualIncome = 'Enter a valid amount in rupees (digits only)';
      else if (Number(form.annualIncome) > MAX_RUPEES) e.annualIncome = `Enter rupees, not paise — maximum ${inr(MAX_RUPEES)}`;
      if (isBusiness(form.purpose) && !form.businessActivity.trim()) e.businessActivity = 'Briefly describe the business or activity';
      if (form.purpose === 'agriculture' && !form.businessActivity.trim()) e.businessActivity = 'Which activity? (e.g. dairy, crop cultivation)';
      if (isStudy(form.purpose) && !form.educationCourse.trim()) e.educationCourse = 'Enter the course or programme';
    }
    if (s === 3) {
      if (!isPosNumber(form.projectCost)) e.projectCost = 'Enter the total project cost in rupees';
      else if (Number(form.projectCost) > MAX_RUPEES) e.projectCost = `Maximum ${inr(MAX_RUPEES)}`;
      if (form.ownContribution.trim() !== '' && !isNonNegNumber(form.ownContribution)) e.ownContribution = 'Enter a valid amount (digits only)';
      else if (isNonNegNumber(form.ownContribution) && Number(form.ownContribution) > MAX_RUPEES) e.ownContribution = `Maximum ${inr(MAX_RUPEES)}`;
      if (!isPosNumber(form.requestedLoan)) e.requestedLoan = 'Enter the loan amount you need in rupees';
      else if (Number(form.requestedLoan) > MAX_RUPEES) e.requestedLoan = `Maximum ${inr(MAX_RUPEES)}`;
      if (!e.projectCost && !e.requestedLoan) {
        const pc = Number(form.projectCost);
        const oc = Number(form.ownContribution || 0);
        const rl = Number(form.requestedLoan);
        if (oc > pc) e.ownContribution = `Own contribution cannot exceed the project cost (${inr(pc)})`;
        else if (oc + rl > pc) e.requestedLoan = `Own contribution + loan (${inr(oc + rl)}) is more than the project cost (${inr(pc)})`;
      }
    }
    return e;
  }

  function next() {
    const e = validateStep(step);
    if (Object.keys(e).length) {
      setErrs(e);
      return;
    }
    setErrs({});
    setStep((s) => Math.min(4, s + 1));
  }

  function goToFirstError(e: Record<string, string>) {
    const firstStep = Math.min(...Object.keys(e).map((k) => FIELD_STEP[k] ?? 4));
    setErrs(e);
    setStep(firstStep);
  }

  async function submit() {
    // Re-validate every earlier step so the Review page can never submit garbage.
    const all = { ...validateStep(1), ...validateStep(2), ...validateStep(3) };
    if (Object.keys(all).length) {
      goToFirstError(all);
      errorToast('Some answers need fixing — we’ve taken you back to the first one.');
      return;
    }
    setErrs({});
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
        // Map server field paths back to wizard fields + jump to the right step.
        const mapped: Record<string, string> = {};
        for (const f of err.fieldErrors) mapped[SERVER_TO_FORM[f.path] ?? f.path] = f.message;
        goToFirstError(mapped);
        errorToast('The server rejected an answer — we’ve taken you to it.');
      } else {
        errorToast(err instanceof ApiError ? err.message : 'Could not save right now. Your session is fine — please try again.');
      }
    }
  }

  if (isLoading) return <Loading label="Loading…" />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const Err = ({ k }: { k: string }) => (errs[k] ? <span className="field-error">{errs[k]}</span> : null);

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
            <Err k="purpose" />
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
                <Err k="fullName" />
              </label>
              <label>
                Age
                <input
                  type="number" inputMode="numeric" min={16} max={100}
                  value={form.age}
                  onChange={(e) => set('age', e.target.value.replace(/[^\d]/g, ''))}
                />
                <Err k="age" />
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
                <Err k="category" />
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
                <Err k="areaType" />
              </label>
              <label>
                State
                <input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. Bihar" maxLength={60} />
                <Err k="state" />
              </label>
              <label>
                District
                <input value={form.district} onChange={(e) => set('district', e.target.value)} placeholder="e.g. Sitamarhi" maxLength={60} />
                <Err k="district" />
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
                <input
                  type="number" inputMode="numeric" min={0} max={MAX_RUPEES}
                  value={form.annualIncome}
                  onChange={(e) => set('annualIncome', e.target.value.replace(/[^\d]/g, ''))}
                />
                <Err k="annualIncome" />
              </label>
              {(isBusiness(form.purpose) || form.purpose === 'agriculture') && (
                <label>
                  {form.purpose === 'agriculture' ? 'Which activity?' : 'What is the business / activity?'}
                  <input
                    value={form.businessActivity}
                    onChange={(e) => set('businessActivity', e.target.value)}
                    placeholder={form.purpose === 'agriculture' ? 'e.g. Dairy unit, crop cultivation' : 'e.g. Furniture repair'}
                    maxLength={120}
                  />
                  <Err k="businessActivity" />
                </label>
              )}
              {isBusiness(form.purpose) && (
                <>
                  <label>
                    Stage <span className="opt-tag">optional</span>
                    <select value={form.businessStage} onChange={(e) => set('businessStage', e.target.value)}>
                      <option value="">Select…</option>
                      <option value="idea">Idea / not started</option>
                      <option value="existing">Running</option>
                      <option value="expansion">Expanding</option>
                    </select>
                  </label>
                  <label>
                    Business plan / project report? <span className="opt-tag">optional</span>
                    <select value={form.hasBusinessPlan} onChange={(e) => set('hasBusinessPlan', e.target.value)}>
                      <option value="">Not sure</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                </>
              )}
              {isStudy(form.purpose) && (
                <label>
                  Course / programme
                  <input
                    value={form.educationCourse}
                    onChange={(e) => set('educationCourse', e.target.value)}
                    placeholder="e.g. ITI — Electrician"
                    maxLength={120}
                  />
                  <Err k="educationCourse" />
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
              to your requested loan. Enter whole rupees.
            </p>
            <div className="form-grid">
              <label>
                Total project cost (₹)
                <input
                  type="number" inputMode="numeric" min={1} max={MAX_RUPEES}
                  value={form.projectCost}
                  onChange={(e) => set('projectCost', e.target.value.replace(/[^\d]/g, ''))}
                />
                <Err k="projectCost" />
              </label>
              <label>
                Your own contribution (₹) <span className="opt-tag">optional</span>
                <input
                  type="number" inputMode="numeric" min={0} max={MAX_RUPEES}
                  value={form.ownContribution}
                  onChange={(e) => set('ownContribution', e.target.value.replace(/[^\d]/g, ''))}
                />
                <Err k="ownContribution" />
              </label>
              <label>
                Loan you are requesting (₹)
                <input
                  type="number" inputMode="numeric" min={1} max={MAX_RUPEES}
                  value={form.requestedLoan}
                  onChange={(e) => set('requestedLoan', e.target.value.replace(/[^\d]/g, ''))}
                />
                <Err k="requestedLoan" />
              </label>
            </div>
            {gap != null && gap > 0 && !errs.requestedLoan && (
              <p className="inline-note warn">
                Own contribution + loan is {inr(gap)} short of the project cost. Decide how that gap will be met.
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
                  <div><small>Annual income</small><b>{form.annualIncome ? inr(Number(form.annualIncome)) : '—'}</b></div>
                  <div><small>Project cost</small><b>{form.projectCost ? inr(Number(form.projectCost)) : '—'}</b></div>
                  <div><small>Own contribution</small><b>{form.ownContribution ? inr(Number(form.ownContribution)) : '—'}</b></div>
                  <div><small>Requested loan</small><b>{form.requestedLoan ? inr(Number(form.requestedLoan)) : '—'}</b></div>
                </div>
                {Object.keys(errs).length > 0 && (
                  <p className="inline-note warn" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertTriangle size={14} /> Fix the highlighted answer, then come back here. Use “Back” to step through.
                  </p>
                )}
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
            <button className="button soft" onClick={() => { setErrs({}); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0}>
              <ArrowLeft size={15} style={{ marginRight: 4 }} /> Back
            </button>
            {step < 4 && <Button onClick={next}>Continue</Button>}
          </div>
        )}
      </article>
    </>
  );
}
