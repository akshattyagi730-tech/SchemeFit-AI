import { useMemo, useState } from 'react';
import { Sparkles, X, CheckCircle2, CircleHelp, AlertTriangle, ExternalLink } from 'lucide-react';
import { PageTitle, Button, Loading } from '../components/ui';
import { useEligibilityCheck } from '../api/hooks';
import { useLang, useLabels } from '../i18n';
import { rupeesToPaise } from '../lib/format';
import type { EligibilityAnswers, EligibilityMatch } from '../api/types';

const GENDERS = ['female', 'male', 'transgender'];
const CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'];
const AREAS = ['rural', 'urban', 'semi_urban'];
const EDU = ['none', 'below_primary', 'primary', 'class_8', 'class_10', 'class_12', 'iti_diploma', 'graduate', 'postgraduate'];
const OCC = [
  'student', 'farmer', 'agri_labourer', 'daily_wager', 'artisan', 'street_vendor', 'domestic_worker',
  'shg_member', 'self_employed', 'private_salaried', 'govt_salaried', 'unemployed', 'homemaker', 'other',
];
const RATION = ['none', 'APL', 'BPL', 'AAY', 'PHH'];

type Form = Record<string, string>;
const EMPTY: Form = {
  age: '', gender: '', category: '', obcCreamyLayer: '', annualIncome: '', state: '', areaType: '',
  educationLevel: '', occupation: '', isStudent: '', landHoldingHectares: '', rationCardType: '', disabilityPct: '',
};

function ApplyLink({ m, t }: { m: EligibilityMatch; t: ReturnType<typeof useLang>['t'] }) {
  if (m.scheme.officialUrl) {
    return (
      <a className="official-link" href={m.scheme.officialUrl} target="_blank" rel="noopener noreferrer">
        {t('el.apply')} <ExternalLink size={12} />
      </a>
    );
  }
  return <span className="official-link disabled">{t('el.applySoon')}</span>;
}

function MatchCard({ m, t, L, tone }: { m: EligibilityMatch; t: ReturnType<typeof useLang>['t']; L: ReturnType<typeof useLabels>; tone: 'eligible' | 'needs' | 'no' }) {
  return (
    <article className="el-match">
      <div className="el-match-head">
        <span className={`el-kind ${tone}`}>{L.kind(m.scheme.kind)}</span>
        <b>{m.scheme.name}</b>
        <small>{m.scheme.provider}</small>
      </div>
      <p className="el-match-desc">{m.scheme.description}</p>
      {tone === 'needs' && m.unknown.length > 0 && (
        <div className="el-reasons">
          <span className="el-reasons-h"><CircleHelp size={13} /> {t('el.whatWeNeed')}</span>
          {m.unknown.map((u) => (
            <div key={u.key}>{u.detail}</div>
          ))}
        </div>
      )}
      {tone === 'no' && m.failed.length > 0 && (
        <div className="el-reasons">
          <span className="el-reasons-h"><AlertTriangle size={13} /> {t('el.whyNot')}</span>
          {m.failed.map((fl) => (
            <div key={fl.key}>{fl.detail}</div>
          ))}
        </div>
      )}
      <ApplyLink m={m} t={t} />
    </article>
  );
}

export function EligibilityCheck() {
  const { t } = useLang();
  const L = useLabels();
  const check = useEligibilityCheck();
  const [form, setForm] = useState<Form>(EMPTY);
  const [open, setOpen] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const answers: EligibilityAnswers = useMemo(
    () => ({
      age: num(form.age) ?? null,
      gender: (form.gender || null) as EligibilityAnswers['gender'],
      category: (form.category || null) as EligibilityAnswers['category'],
      obcCreamyLayer: form.category === 'OBC' && form.obcCreamyLayer ? form.obcCreamyLayer === 'cl' : null,
      annualIncomePaise: form.annualIncome.trim() === '' ? null : rupeesToPaise(Number(form.annualIncome)),
      state: form.state.trim() || null,
      areaType: (form.areaType || null) as EligibilityAnswers['areaType'],
      educationLevel: (form.educationLevel || null) as EligibilityAnswers['educationLevel'],
      occupation: (form.occupation || null) as EligibilityAnswers['occupation'],
      isStudent: form.isStudent === '' ? null : form.isStudent === 'yes',
      landHoldingHectares: num(form.landHoldingHectares) ?? null,
      rationCardType: (form.rationCardType || null) as EligibilityAnswers['rationCardType'],
      disabilityPct: num(form.disabilityPct) ?? null,
    }),
    [form],
  );

  async function submit() {
    try {
      await check.mutateAsync(answers);
      setOpen(true);
    } catch {
      /* mutation error surfaced via check.isError below */
    }
  }

  const r = check.data;

  return (
    <>
      <PageTitle title={t('el.title')}>{t('el.intro')}</PageTitle>

      <article className="card form-card">
        <div className="form-grid">
          <label>
            {t('el.q.age')}
            <input type="number" inputMode="numeric" min={0} max={120} value={form.age} onChange={(e) => set('age', e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
          <label>
            {t('el.q.gender')}
            <select value={form.gender} onChange={(e) => set('gender', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {GENDERS.map((g) => <option key={g} value={g}>{L.gender(g)}</option>)}
            </select>
          </label>
          <label>
            {t('el.q.category')}
            <select value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{L.category(c)}</option>)}
            </select>
          </label>
          {form.category === 'OBC' && (
            <label>
              {t('wiz.obcStatus')}
              <select value={form.obcCreamyLayer} onChange={(e) => set('obcCreamyLayer', e.target.value)}>
                <option value="">{t('el.notSpecified')}</option>
                <option value="ncl">{t('obc.ncl')}</option>
                <option value="cl">{t('obc.cl')}</option>
              </select>
            </label>
          )}
          <label>
            {t('el.q.income')}
            <input type="number" inputMode="numeric" min={0} value={form.annualIncome} onChange={(e) => set('annualIncome', e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
          <label>
            {t('el.q.state')}
            <input value={form.state} maxLength={60} onChange={(e) => set('state', e.target.value)} />
          </label>
          <label>
            {t('el.q.area')}
            <select value={form.areaType} onChange={(e) => set('areaType', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {AREAS.map((a) => <option key={a} value={a}>{L.area(a)}</option>)}
            </select>
          </label>
          <label>
            {t('el.q.education')}
            <select value={form.educationLevel} onChange={(e) => set('educationLevel', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {EDU.map((x) => <option key={x} value={x}>{L.education(x)}</option>)}
            </select>
          </label>
          <label>
            {t('el.q.occupation')}
            <select value={form.occupation} onChange={(e) => set('occupation', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {OCC.map((x) => <option key={x} value={x}>{L.occupation(x)}</option>)}
            </select>
          </label>
          <label>
            {t('el.q.student')}
            <select value={form.isStudent} onChange={(e) => set('isStudent', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              <option value="yes">{t('common.yes')}</option>
              <option value="no">{t('common.no')}</option>
            </select>
          </label>
          <label>
            {t('el.q.land')}
            <input type="number" inputMode="decimal" min={0} step="0.1" value={form.landHoldingHectares} onChange={(e) => set('landHoldingHectares', e.target.value.replace(/[^0-9.]/g, ''))} />
          </label>
          <label>
            {t('el.q.ration')}
            <select value={form.rationCardType} onChange={(e) => set('rationCardType', e.target.value)}>
              <option value="">{t('el.notSpecified')}</option>
              {RATION.map((x) => <option key={x} value={x}>{L.ration(x)}</option>)}
            </select>
          </label>
          <label>
            {t('el.q.disability')}
            <input type="number" inputMode="numeric" min={0} max={100} value={form.disabilityPct} onChange={(e) => set('disabilityPct', e.target.value.replace(/[^0-9]/g, ''))} />
          </label>
        </div>

        {check.isError && <p className="inline-note warn" style={{ marginTop: 12 }}>{t('common.somethingWrong')}</p>}

        <div className="form-actions">
          <Button onClick={submit} loading={check.isPending}>
            <Sparkles size={16} style={{ marginRight: 6 }} /> {check.isPending ? t('el.checking') : t('el.submit')}
          </Button>
        </div>
        <p className="inline-note">{t('el.disclaimer')}</p>
      </article>

      {open && r && (
        <div className="modal-wrap" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}><X /></button>
            <h2>{t('el.resultTitle')}</h2>
            <p>{r.notes[0]}</p>
            <div className="el-results">
              {r.eligible.length === 0 && r.needsInformation.length === 0 && (
                <p className="inline-note">{t('el.noneEligible')}</p>
              )}
              {r.eligible.length > 0 && (
                <>
                  <h3 className="section-h ok"><CheckCircle2 size={15} /> {t('el.eligibleFor', { n: r.eligible.length })}</h3>
                  {r.eligible.map((m) => <MatchCard key={m.scheme.code} m={m} t={t} L={L} tone="eligible" />)}
                </>
              )}
              {r.needsInformation.length > 0 && (
                <>
                  <h3 className="section-h">{t('el.needMoreInfo', { n: r.needsInformation.length })}</h3>
                  {r.needsInformation.slice(0, 15).map((m) => <MatchCard key={m.scheme.code} m={m} t={t} L={L} tone="needs" />)}
                </>
              )}
              {r.ineligible.length > 0 && (
                <>
                  <h3 className="section-h">{t('el.notEligible', { n: r.ineligible.length })}</h3>
                  {r.ineligible.map((m) => <MatchCard key={m.scheme.code} m={m} t={t} L={L} tone="no" />)}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {check.isPending && !r && <Loading label={t('el.checking')} />}
    </>
  );
}
