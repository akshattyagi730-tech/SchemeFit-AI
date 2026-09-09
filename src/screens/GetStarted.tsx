import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, Briefcase, GraduationCap, Sprout, Home, Bike, Wallet, IndianRupee, AlertTriangle,
} from 'lucide-react';
import { PageTitle, Button, Loading, ErrorState } from '../components/ui';
import { DocumentChecklist } from '../components/DocumentChecklist';
import { useProfile, useUpdateProfile } from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { useLang, useLabels } from '../i18n';
import type { DictKey } from '../i18n/dict';
import { paiseToRupees, rupeesToPaise, placeErrorKey } from '../lib/format';

const GROUP_ICON: Record<string, typeof Briefcase> = {
  business: Briefcase, education: GraduationCap, agri: Sprout, home: Home, vehicle: Bike, personal: Wallet,
};

// Purpose groups keyed to dict entries (labels come from useLabels()).
const PURPOSE_GROUPS: { id: string; nameKey: DictKey; hintKey: DictKey; purposes: string[] }[] = [
  { id: 'business', nameKey: 'pg.business', hintKey: 'pg.businessHint', purposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'] },
  { id: 'education', nameKey: 'pg.education', hintKey: 'pg.educationHint', purposes: ['education', 'skilling'] },
  { id: 'agri', nameKey: 'pg.agri', hintKey: 'pg.agriHint', purposes: ['agriculture'] },
  { id: 'home', nameKey: 'pg.home', hintKey: 'pg.homeHint', purposes: ['housing'] },
  { id: 'vehicle', nameKey: 'pg.vehicle', hintKey: 'pg.vehicleHint', purposes: ['vehicle'] },
  { id: 'personal', nameKey: 'pg.personal', hintKey: 'pg.personalHint', purposes: ['personal'] },
];

const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const AREAS = ['rural', 'urban', 'semi_urban'];
const MAX_RUPEES = 100_000_000;

type Form = {
  purpose: string; fullName: string; age: string; category: string; obcCreamyLayer: string; state: string; district: string; areaType: string;
  annualIncome: string; businessActivity: string; businessStage: string; hasBusinessPlan: string; educationCourse: string;
  projectCost: string; ownContribution: string; requestedLoan: string;
};
const EMPTY: Form = {
  purpose: '', fullName: '', age: '', category: '', obcCreamyLayer: '', state: '', district: '', areaType: '',
  annualIncome: '', businessActivity: '', businessStage: '', hasBusinessPlan: '', educationCourse: '',
  projectCost: '', ownContribution: '', requestedLoan: '',
};

type FErr = { key: DictKey; vars?: Record<string, string | number> };

const rupeeStr = (paise: number | null | undefined) => (paise == null ? '' : String(paiseToRupees(paise)));
const isBusiness = (p: string) => p.startsWith('business') || p === 'equipment_purchase' || p === 'working_capital';
const isStudy = (p: string) => p === 'education' || p === 'skilling';
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const FIELD_STEP: Record<string, number> = {
  fullName: 1, age: 1, category: 1, obcCreamyLayer: 1, state: 1, district: 1, areaType: 1,
  annualIncome: 2, annualIncomePaise: 2, businessActivity: 2, educationCourse: 2,
  projectCost: 3, projectCostPaise: 3, ownContribution: 3, ownContributionPaise: 3, requestedLoan: 3, requestedLoanPaise: 3,
};
const SERVER_TO_FORM: Record<string, string> = {
  annualIncomePaise: 'annualIncome', projectCostPaise: 'projectCost', ownContributionPaise: 'ownContribution', requestedLoanPaise: 'requestedLoan',
};
const isPosNumber = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) > 0;
const isNonNegNumber = (raw: string) => raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0;

export function GetStarted({ navigate }: { navigate: (to: string) => void }) {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const L = useLabels();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errs, setErrs] = useState<Record<string, FErr>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      purpose: p.purpose ?? '', fullName: p.fullName ?? '', age: p.age != null ? String(p.age) : '',
      category: p.category ?? '',
      obcCreamyLayer: p.obcCreamyLayer == null ? '' : p.obcCreamyLayer ? 'cl' : 'ncl',
      state: p.state ?? '', district: p.district ?? '', areaType: p.areaType ?? '',
      annualIncome: rupeeStr(p.annualIncomePaise),
      businessActivity: p.businessDetails?.activity ?? '', businessStage: p.businessDetails?.stage ?? '',
      hasBusinessPlan: p.hasBusinessPlan == null ? '' : p.hasBusinessPlan ? 'yes' : 'no',
      educationCourse: p.educationDetails?.course ?? '',
      projectCost: rupeeStr(p.projectCostPaise), ownContribution: rupeeStr(p.ownContributionPaise), requestedLoan: rupeeStr(p.requestedLoanPaise),
    });
  }, [data]);

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrs((e) => {
      if (!e[k]) return e;
      const { [k]: _drop, ...rest } = e;
      void _drop;
      return rest;
    });
  };

  const steps: DictKey[] = ['wiz.step.purpose', 'wiz.step.about', 'wiz.step.situation', 'wiz.step.money', 'wiz.step.review'];

  const gap = useMemo(() => {
    if (!isPosNumber(form.projectCost)) return null;
    return Number(form.projectCost) - Number(form.ownContribution || 0) - Number(form.requestedLoan || 0);
  }, [form.projectCost, form.ownContribution, form.requestedLoan]);

  function validateStep(s: number): Record<string, FErr> {
    const e: Record<string, FErr> = {};
    if (s === 0 && !form.purpose) e.purpose = { key: 'v.choosePurpose' };
    if (s === 1) {
      if (form.fullName.trim().length < 2) e.fullName = { key: 'v.enterFullName' };
      const age = Number(form.age);
      if (form.age.trim() === '') e.age = { key: 'v.enterAge' };
      else if (!/^\d+$/.test(form.age.trim()) || !Number.isInteger(age)) e.age = { key: 'v.ageWhole' };
      else if (age < 16 || age > 100) e.age = { key: 'v.ageRange' };
      if (!form.category) e.category = { key: 'v.selectCategory' };
      if (form.category === 'OBC' && !form.obcCreamyLayer) e.obcCreamyLayer = { key: 'v.selectObcStatus' };
      if (!form.state.trim()) e.state = { key: 'v.enterState' };
      else { const k = placeErrorKey(form.state); if (k) e.state = { key: k }; }
      if (!form.district.trim()) e.district = { key: 'v.enterDistrict' };
      else { const k = placeErrorKey(form.district); if (k) e.district = { key: k }; }
      if (!form.areaType) e.areaType = { key: 'v.selectArea' };
    }
    if (s === 2) {
      if (form.annualIncome.trim() === '') e.annualIncome = { key: 'v.enterIncome' };
      else if (!isNonNegNumber(form.annualIncome)) e.annualIncome = { key: 'v.validAmount' };
      else if (Number(form.annualIncome) > MAX_RUPEES) e.annualIncome = { key: 'v.maxRupees', vars: { max: inr(MAX_RUPEES) } };
      if (isBusiness(form.purpose) && !form.businessActivity.trim()) e.businessActivity = { key: 'v.describeActivity' };
      if (form.purpose === 'agriculture' && !form.businessActivity.trim()) e.businessActivity = { key: 'v.whichActivity' };
      if (isStudy(form.purpose) && !form.educationCourse.trim()) e.educationCourse = { key: 'v.enterCourse' };
    }
    if (s === 3) {
      if (!isPosNumber(form.projectCost)) e.projectCost = { key: 'v.enterProjectCost' };
      else if (Number(form.projectCost) > MAX_RUPEES) e.projectCost = { key: 'v.maxAmt', vars: { max: inr(MAX_RUPEES) } };
      if (form.ownContribution.trim() !== '' && !isNonNegNumber(form.ownContribution)) e.ownContribution = { key: 'v.validAmt2' };
      else if (isNonNegNumber(form.ownContribution) && Number(form.ownContribution) > MAX_RUPEES) e.ownContribution = { key: 'v.maxAmt', vars: { max: inr(MAX_RUPEES) } };
      if (!isPosNumber(form.requestedLoan)) e.requestedLoan = { key: 'v.enterLoan' };
      else if (Number(form.requestedLoan) > MAX_RUPEES) e.requestedLoan = { key: 'v.maxAmt', vars: { max: inr(MAX_RUPEES) } };
      if (!e.projectCost && !e.requestedLoan) {
        const pc = Number(form.projectCost);
        const oc = Number(form.ownContribution || 0);
        const rl = Number(form.requestedLoan);
        if (oc > pc) e.ownContribution = { key: 'v.ownExceedsCost', vars: { cost: inr(pc) } };
        else if (oc + rl > pc) e.requestedLoan = { key: 'v.sumExceedsCost', vars: { sum: inr(oc + rl), cost: inr(pc) } };
      }
    }
    return e;
  }

  function next() {
    const e = validateStep(step);
    if (Object.keys(e).length) return setErrs(e);
    setErrs({});
    setStep((s) => Math.min(4, s + 1));
  }

  function goToFirstError(e: Record<string, FErr>) {
    const firstStep = Math.min(...Object.keys(e).map((k) => FIELD_STEP[k] ?? 4));
    setErrs(e);
    setStep(firstStep);
  }

  async function submit() {
    const all = { ...validateStep(1), ...validateStep(2), ...validateStep(3) };
    if (Object.keys(all).length) {
      goToFirstError(all);
      errorToast(t('wiz.errFixToast'));
      return;
    }
    setErrs({});
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    const patch: Record<string, unknown> = {
      fullName: form.fullName.trim(),
      age: num(form.age),
      annualIncomePaise: form.annualIncome.trim() === '' ? null : rupeesToPaise(Number(form.annualIncome)),
      category: form.category || null,
      obcCreamyLayer: form.category === 'OBC' ? (form.obcCreamyLayer === '' ? null : form.obcCreamyLayer === 'cl') : null,
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
      toast(t('wiz.savedToast'));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        const mapped: Record<string, FErr> = {};
        for (const f of err.fieldErrors) mapped[SERVER_TO_FORM[f.path] ?? f.path] = { key: 'v.correctFields', vars: {} };
        // keep server text visible via toast; jump to the step
        goToFirstError(mapped);
        errorToast(err.fieldErrors[0]?.message ?? t('wiz.errServerToast'));
      } else {
        errorToast(err instanceof ApiError ? err.message : t('wiz.errGenericToast'));
      }
    }
  }

  if (isLoading) return <Loading label={t('common.loading')} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  const Err = ({ k }: { k: string }) => {
    const e = errs[k];
    return e ? <span className="field-error">{t(e.key, e.vars)}</span> : null;
  };

  return (
    <>
      <PageTitle title={t('wiz.title')}>{t('wiz.intro')}</PageTitle>

      <div className="wizard-steps">
        {steps.map((label, i) => (
          <div key={label} className={`wizard-step ${i === step ? 'current' : i < step ? 'done' : ''}`}>
            <i>{i < step ? <Check size={13} /> : i + 1}</i>
            <span>{t(label)}</span>
          </div>
        ))}
      </div>

      <article className="card wizard-card">
        {step === 0 && (
          <div className="wizard-body">
            <h2>{t('wiz.purposeQ')}</h2>
            <p className="wizard-hint">{t('wiz.purposeHint')}</p>
            <Err k="purpose" />
            <div className="purpose-groups">
              {PURPOSE_GROUPS.map((g) => {
                const Icon = GROUP_ICON[g.id] ?? Briefcase;
                return (
                  <div className="purpose-group" key={g.id}>
                    <div className="purpose-group-head">
                      <Icon size={17} />
                      <div>
                        <b>{t(g.nameKey)}</b>
                        <small>{t(g.hintKey)}</small>
                      </div>
                    </div>
                    <div className="purpose-options">
                      {g.purposes.map((p) => (
                        <button key={p} className={`purpose-pick ${form.purpose === p ? 'selected' : ''}`} onClick={() => set('purpose', p)}>
                          {form.purpose === p && <Check size={13} />}
                          {L.purpose(p)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="wizard-body">
            <h2>{t('wiz.aboutH')}</h2>
            <p className="wizard-hint">{t('wiz.aboutHint')}</p>
            <div className="form-grid">
              <label>
                {t('auth.fullName')}
                <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
                <Err k="fullName" />
              </label>
              <label>
                {t('wiz.rv.age')}
                <input type="number" inputMode="numeric" min={16} max={100} value={form.age} onChange={(e) => set('age', e.target.value.replace(/[^\d]/g, ''))} />
                <Err k="age" />
              </label>
              <label>
                {t('wiz.socialCategory')}
                <select value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{L.category(c)}</option>
                  ))}
                </select>
                <Err k="category" />
              </label>
              {form.category === 'OBC' && (
                <label>
                  {t('wiz.obcStatus')}
                  <select value={form.obcCreamyLayer} onChange={(e) => set('obcCreamyLayer', e.target.value)}>
                    <option value="">{t('common.select')}</option>
                    <option value="ncl">{t('obc.ncl')}</option>
                    <option value="cl">{t('obc.cl')}</option>
                  </select>
                  <span className="inline-note" style={{ marginTop: 2 }}>{t('wiz.obcStatusHint')}</span>
                  <Err k="obcCreamyLayer" />
                </label>
              )}
              <label>
                {t('wiz.areaType')}
                <select value={form.areaType} onChange={(e) => set('areaType', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {AREAS.map((a) => (
                    <option key={a} value={a}>{L.area(a)}</option>
                  ))}
                </select>
                <Err k="areaType" />
              </label>
              <label>
                {t('wiz.state')}
                <input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={60} />
                <Err k="state" />
              </label>
              <label>
                {t('wiz.district')}
                <input value={form.district} onChange={(e) => set('district', e.target.value)} maxLength={60} />
                <Err k="district" />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-body">
            <h2>{t('wiz.situationH')}</h2>
            <p className="wizard-hint">{t('wiz.situationHint')}</p>
            <div className="form-grid">
              <label>
                {t('wiz.annualIncome')}
                <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.annualIncome} onChange={(e) => set('annualIncome', e.target.value.replace(/[^\d]/g, ''))} />
                <Err k="annualIncome" />
              </label>
              {(isBusiness(form.purpose) || form.purpose === 'agriculture') && (
                <label>
                  {form.purpose === 'agriculture' ? t('wiz.whichActivity') : t('wiz.businessActivity')}
                  <input value={form.businessActivity} onChange={(e) => set('businessActivity', e.target.value)} maxLength={120} />
                  <Err k="businessActivity" />
                </label>
              )}
              {isBusiness(form.purpose) && (
                <>
                  <label>
                    {t('wiz.stage')} <span className="opt-tag">{t('common.optional')}</span>
                    <select value={form.businessStage} onChange={(e) => set('businessStage', e.target.value)}>
                      <option value="">{t('common.select')}</option>
                      <option value="idea">{t('wiz.stageIdea')}</option>
                      <option value="existing">{t('wiz.stageRunning')}</option>
                      <option value="expansion">{t('wiz.stageExpanding')}</option>
                    </select>
                  </label>
                  <label>
                    {t('wiz.hasPlan')} <span className="opt-tag">{t('common.optional')}</span>
                    <select value={form.hasBusinessPlan} onChange={(e) => set('hasBusinessPlan', e.target.value)}>
                      <option value="">{t('common.notSure')}</option>
                      <option value="yes">{t('common.yes')}</option>
                      <option value="no">{t('common.no')}</option>
                    </select>
                  </label>
                </>
              )}
              {isStudy(form.purpose) && (
                <label>
                  {t('wiz.course')}
                  <input value={form.educationCourse} onChange={(e) => set('educationCourse', e.target.value)} maxLength={120} />
                  <Err k="educationCourse" />
                </label>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wizard-body">
            <h2>{t('wiz.moneyH')}</h2>
            <p className="wizard-hint">{t('wiz.moneyHint')}</p>
            <div className="form-grid">
              <label>
                {t('wiz.projectCost')}
                <input type="number" inputMode="numeric" min={1} max={MAX_RUPEES} value={form.projectCost} onChange={(e) => set('projectCost', e.target.value.replace(/[^\d]/g, ''))} />
                <Err k="projectCost" />
              </label>
              <label>
                {t('wiz.ownContribution')} <span className="opt-tag">{t('common.optional')}</span>
                <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.ownContribution} onChange={(e) => set('ownContribution', e.target.value.replace(/[^\d]/g, ''))} />
                <Err k="ownContribution" />
              </label>
              <label>
                {t('wiz.requestedLoan')}
                <input type="number" inputMode="numeric" min={1} max={MAX_RUPEES} value={form.requestedLoan} onChange={(e) => set('requestedLoan', e.target.value.replace(/[^\d]/g, ''))} />
                <Err k="requestedLoan" />
              </label>
            </div>
            {gap != null && gap > 0 && !errs.requestedLoan && (
              <p className="inline-note warn">{t('wiz.gapWarn', { amount: inr(gap) })}</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="wizard-body">
            {!saved ? (
              <>
                <h2>{t('wiz.reviewH')}</h2>
                <div className="review-grid">
                  <div><small>{t('wiz.rv.purpose')}</small><b>{L.purpose(form.purpose)}</b></div>
                  <div><small>{t('wiz.rv.name')}</small><b>{form.fullName || '—'}</b></div>
                  <div><small>{t('wiz.rv.age')}</small><b>{form.age || '—'}</b></div>
                  <div><small>{t('wiz.rv.category')}</small><b>{L.category(form.category)}</b></div>
                  {form.category === 'OBC' && (
                    <div><small>{t('wiz.rv.obcStatus')}</small><b>{form.obcCreamyLayer === 'cl' ? t('obc.cl') : form.obcCreamyLayer === 'ncl' ? t('obc.ncl') : '—'}</b></div>
                  )}
                  <div><small>{t('wiz.rv.location')}</small><b>{[form.district, form.state].filter(Boolean).join(', ') || '—'} · {L.area(form.areaType)}</b></div>
                  <div><small>{t('wiz.rv.income')}</small><b>{form.annualIncome ? inr(Number(form.annualIncome)) : '—'}</b></div>
                  <div><small>{t('wiz.rv.projectCost')}</small><b>{form.projectCost ? inr(Number(form.projectCost)) : '—'}</b></div>
                  <div><small>{t('wiz.rv.ownContribution')}</small><b>{form.ownContribution ? inr(Number(form.ownContribution)) : '—'}</b></div>
                  <div><small>{t('wiz.rv.requestedLoan')}</small><b>{form.requestedLoan ? inr(Number(form.requestedLoan)) : '—'}</b></div>
                </div>
                {Object.keys(errs).length > 0 && (
                  <p className="inline-note warn" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <AlertTriangle size={14} /> {t('wiz.reviewFixNote')}
                  </p>
                )}
                <div className="wizard-cta">
                  <Button onClick={submit} loading={update.isPending}>
                    <Sparkles size={16} style={{ marginRight: 6 }} /> {t('wiz.seeMatches')}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="wizard-saved">
                  <span className="wizard-saved-icon"><Check /></span>
                  <div>
                    <h2>{t('wiz.savedH')}</h2>
                    <p className="wizard-hint">{t('wiz.savedSub')}</p>
                  </div>
                </div>
                <DocumentChecklist compact />
                <div className="wizard-cta">
                  <Button onClick={() => navigate('/schemes')}>
                    {t('wiz.viewMatchingSchemes')} <IndianRupee size={15} style={{ marginLeft: 4 }} />
                  </Button>
                  <button className="button outline" onClick={() => navigate('/documents')}>
                    {t('wiz.goToDocuments')} <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {!(step === 4 && saved) && (
          <div className="wizard-nav">
            <button className="button soft" onClick={() => { setErrs({}); setStep((s) => Math.max(0, s - 1)); }} disabled={step === 0}>
              <ArrowLeft size={15} style={{ marginRight: 4 }} /> {t('common.back')}
            </button>
            {step < 4 && <Button onClick={next}>{t('common.continue')}</Button>}
          </div>
        )}
      </article>
    </>
  );
}
