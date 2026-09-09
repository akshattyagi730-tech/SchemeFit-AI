import { useEffect, useState } from 'react';
import { PageTitle, Button, Loading, ErrorState } from '../components/ui';
import { useProfile, useUpdateProfile } from '../api/hooks';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { useLang, useLabels } from '../i18n';
import type { DictKey } from '../i18n/dict';
import { paiseToRupees, rupeesToPaise, placeErrorKey } from '../lib/format';

const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const AREAS = ['rural', 'urban', 'semi_urban'];
const PURPOSES = [
  'business_new', 'business_expansion', 'equipment_purchase', 'working_capital',
  'education', 'skilling', 'agriculture', 'housing', 'vehicle', 'personal',
];
const MAX_RUPEES = 100_000_000;

type FormState = {
  fullName: string; age: string; annualIncome: string; category: string; obcCreamyLayer: string; state: string; district: string;
  areaType: string; purpose: string; hasBusinessPlan: string; businessActivity: string; educationCourse: string;
  projectCost: string; ownContribution: string; requestedLoan: string;
};
type FErr = { key: DictKey; vars?: Record<string, string | number> };

const rupeeStr = (paise: number | null | undefined) => (paise == null ? '' : String(paiseToRupees(paise)));
const FIELD_TO_PATH: Partial<Record<keyof FormState, string>> = {
  annualIncome: 'annualIncomePaise', projectCost: 'projectCostPaise', ownContribution: 'ownContributionPaise', requestedLoan: 'requestedLoanPaise',
};

export function Profile() {
  const { data, isLoading, isError, error, refetch } = useProfile();
  const update = useUpdateProfile();
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const L = useLabels();
  const [form, setForm] = useState<FormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, FErr>>({});

  useEffect(() => {
    if (!data) return;
    const p = data.profile;
    setForm({
      fullName: p.fullName ?? '',
      age: p.age != null ? String(p.age) : '',
      annualIncome: rupeeStr(p.annualIncomePaise),
      category: p.category ?? '',
      obcCreamyLayer: p.obcCreamyLayer == null ? '' : p.obcCreamyLayer ? 'cl' : 'ncl',
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
  if (isLoading || !form || !data) return <Loading label={t('common.loading')} />;

  const set = (k: keyof FormState, v: string) => {
    setForm((f) => (f ? { ...f, [k]: v } : f));
    const path = FIELD_TO_PATH[k] ?? k;
    setFieldErrors((e) => {
      if (!e[path] && !e[k]) return e;
      const { [path]: _a, [k]: _b, ...rest } = e;
      void _a;
      void _b;
      return rest;
    });
  };
  const num = (s: string) => (s.trim() === '' ? null : Number(s));

  function validate(f: FormState): Record<string, FErr> {
    const e: Record<string, FErr> = {};
    if (f.fullName.trim() && f.fullName.trim().length < 2) e.fullName = { key: 'v.enterFullName' };
    if (f.age.trim() !== '') {
      if (!/^\d+$/.test(f.age.trim())) e.age = { key: 'v.ageWhole' };
      else if (Number(f.age) < 16 || Number(f.age) > 100) e.age = { key: 'v.ageRange' };
    }
    for (const k of ['state', 'district'] as const) {
      const key = placeErrorKey(f[k]);
      if (key) e[k] = { key };
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
      if (!/^\d+$/.test(raw)) e[path] = { key: 'v.validAmt2' };
      else if (Number(raw) > MAX_RUPEES) e[path] = { key: 'v.maxRupees', vars: { max: `₹${MAX_RUPEES.toLocaleString('en-IN')}` } };
    }
    return e;
  }

  async function save() {
    if (!form) return;
    const clientErrs = validate(form);
    if (Object.keys(clientErrs).length) {
      setFieldErrors(clientErrs);
      errorToast(t('v.correctFields'));
      return;
    }
    setFieldErrors({});
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
      businessDetails: { activity: form.businessActivity.trim() },
      educationDetails: { course: form.educationCourse.trim() },
      projectCostPaise: form.projectCost.trim() === '' ? null : rupeesToPaise(Number(form.projectCost)),
      ownContributionPaise: form.ownContribution.trim() === '' ? null : rupeesToPaise(Number(form.ownContribution)),
      requestedLoanPaise: form.requestedLoan.trim() === '' ? null : rupeesToPaise(Number(form.requestedLoan)),
    };
    try {
      await update.mutateAsync(patch);
      toast(t('pf.savedToast'));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.length) {
        setFieldErrors(Object.fromEntries(err.fieldErrors.map((f) => [f.path, { key: 'v.correctFields' as DictKey }])));
        errorToast(err.fieldErrors[0]?.message ?? t('v.correctFields'));
      } else {
        errorToast(err instanceof ApiError ? err.message : t('pf.saveFailToast'));
      }
    }
  }

  const pct = data.completeness.percent;
  const err = (k: string) => {
    const e = fieldErrors[k];
    return e ? <span className="field-error">{t(e.key, e.vars)}</span> : null;
  };

  return (
    <>
      <PageTitle title={t('pf.title')}>{t('pf.intro')}</PageTitle>
      <article className="card form-card">
        <div className="profile-progress">
          <div>
            <b>{t('pf.completion', { n: pct })}</b>
            <span>{t('pf.detailsNeeded', { n: data.completeness.missing.length })}</span>
          </div>
          <div className="progress">
            <i style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div className="form-grid">
          <label>
            {t('pf.fullName')}
            <input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
            {err('fullName')}
          </label>
          <label>
            {t('pf.age')}
            <input type="number" inputMode="numeric" min={16} max={100} value={form.age} onChange={(e) => set('age', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('age')}
          </label>
          <label>
            {t('pf.income')}
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.annualIncome} onChange={(e) => set('annualIncome', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('annualIncomePaise')}
          </label>
          <label>
            {t('pf.category')}
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{L.category(c)}</option>
              ))}
            </select>
          </label>
          {form.category === 'OBC' && (
            <label>
              {t('pf.obcStatus')}
              <select value={form.obcCreamyLayer} onChange={(e) => set('obcCreamyLayer', e.target.value)}>
                <option value="">{t('common.select')}</option>
                <option value="ncl">{t('obc.ncl')}</option>
                <option value="cl">{t('obc.cl')}</option>
              </select>
              <span className="inline-note" style={{ marginTop: 2 }}>{t('wiz.obcStatusHint')}</span>
            </label>
          )}
          <label>
            {t('pf.state')}
            <input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={60} />
            {err('state')}
          </label>
          <label>
            {t('pf.district')}
            <input value={form.district} onChange={(e) => set('district', e.target.value)} maxLength={60} />
            {err('district')}
          </label>
          <label>
            {t('pf.areaType')}
            <select value={form.areaType} onChange={(e) => set('areaType', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {AREAS.map((a) => (
                <option key={a} value={a}>{L.area(a)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('pf.purpose')}
            <select value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>{L.purpose(p)}</option>
              ))}
            </select>
          </label>
          <label>
            {t('pf.businessActivity')}
            <input value={form.businessActivity} onChange={(e) => set('businessActivity', e.target.value)} maxLength={120} />
          </label>
          <label>
            {t('pf.course')}
            <input value={form.educationCourse} onChange={(e) => set('educationCourse', e.target.value)} maxLength={120} />
          </label>
          <label>
            {t('pf.hasPlan')}
            <select value={form.hasBusinessPlan} onChange={(e) => set('hasBusinessPlan', e.target.value)}>
              <option value="">{t('common.notSure')}</option>
              <option value="yes">{t('common.yes')}</option>
              <option value="no">{t('common.no')}</option>
            </select>
          </label>
          <label>
            {t('pf.projectCost')}
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.projectCost} onChange={(e) => set('projectCost', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('projectCostPaise')}
          </label>
          <label>
            {t('pf.ownContribution')}
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.ownContribution} onChange={(e) => set('ownContribution', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('ownContributionPaise')}
          </label>
          <label>
            {t('pf.requestedLoan')}
            <input type="number" inputMode="numeric" min={0} max={MAX_RUPEES} value={form.requestedLoan} onChange={(e) => set('requestedLoan', e.target.value.replace(/[^0-9]/g, ''))} />
            {err('requestedLoanPaise')}
          </label>
        </div>

        <p className="inline-note">{t('pf.moneyNote')}</p>

        <div className="form-actions">
          <Button onClick={save} loading={update.isPending}>
            {t('pf.save')}
          </Button>
        </div>
      </article>
    </>
  );
}
