import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Info, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageTitle, Button, Loading, ErrorState, EmptyState } from '../components/ui';
import { useApplication, useSchemes, usePatchFinancing, useFinanceCalculation } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { useLang, useLabels } from '../i18n';
import { calculateFinancePlan, type FinancePlan } from '../lib/finance';
import { formatPaise, paiseToRupees, bpsToPct } from '../lib/format';

export function LoanPlanner({ navigate }: { navigate: (to: string) => void }) {
  const { activeId, isLoading: appsLoading } = useActiveApplication();
  const { data: application, isLoading, isError, error, refetch } = useApplication(activeId ?? undefined);
  const { data: schemes } = useSchemes();
  const { toast, errorToast } = useToast();
  const { t } = useLang();
  const L = useLabels();

  const scheme = useMemo(
    () => schemes?.find((s) => s.code === application?.schemeCode),
    [schemes, application],
  );

  const [amount, setAmount] = useState(0);
  const [tenure, setTenure] = useState(0);
  const [rateBps, setRateBps] = useState(0);
  const [moratorium, setMoratorium] = useState(0);
  const patch = usePatchFinancing(application?.id ?? '');
  const serverCalc = useFinanceCalculation();
  const [serverPlan, setServerPlan] = useState<FinancePlan | null>(null);

  useEffect(() => {
    if (!application || !scheme) return;
    const f = application.financing;
    setAmount(f.requestedLoanPaise ?? scheme.financing.minAmountPaise);
    setTenure(f.tenureMonths ?? scheme.terms.minTenureMonths);
    setRateBps(f.interestRateBps ?? scheme.terms.minInterestRateBps);
    setMoratorium(f.moratoriumMonths ?? 0);
  }, [application?.id, scheme?.code]);

  if (appsLoading || isLoading) return <Loading label={t('lp.computing')} />;
  if (!activeId)
    return (
      <>
        <PageTitle title={t('lp.title')}>{t('lp.intro')}</PageTitle>
        <EmptyState title={t('lp.noApplication')} hint={t('lp.noApplicationHint')} />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>{t('pr.goToSchemeMatches')}</Button>
        </div>
      </>
    );
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!application || !scheme) return <Loading />;

  const editable = application.status === 'DRAFT';
  const projectCost = application.financing.projectCostPaise ?? amount;
  const ownContribution = application.financing.ownContributionPaise ?? 0;

  let plan: FinancePlan | null = null;
  let planError: string | null = null;
  try {
    plan = calculateFinancePlan({
      projectCostPaise: projectCost,
      ownContributionPaise: ownContribution,
      requestedLoanPaise: amount,
      annualRateBps: rateBps,
      tenureMonths: tenure,
      moratoriumMonths: moratorium,
      moratoriumInterestHandling: scheme.terms.moratorium.interestHandling,
      tenureIncludesMoratorium: scheme.terms.moratorium.tenureIncludesMoratorium,
      scheme: {
        maxAmountPaise: scheme.financing.maxAmountPaise,
        maxProjectCostSharePct: scheme.financing.maxProjectCostSharePct,
        minOwnContributionPct: scheme.financing.minOwnContributionPct,
        minInterestRateBps: scheme.terms.minInterestRateBps,
        maxInterestRateBps: scheme.terms.maxInterestRateBps,
        minTenureMonths: scheme.terms.minTenureMonths,
        maxTenureMonths: scheme.terms.maxTenureMonths,
        moratoriumAllowed: scheme.terms.moratorium.allowed,
        moratoriumMaxMonths: scheme.terms.moratorium.maxMonths,
      },
    });
  } catch (e) {
    planError = e instanceof Error ? e.message : t('lp.cannotCompute');
  }

  const rateOptions = rateStops(scheme.terms.minInterestRateBps, scheme.terms.maxInterestRateBps);
  const tenureOptions = tenureStops(scheme.terms.minTenureMonths, scheme.terms.maxTenureMonths);
  const moratoriumOptions = scheme.terms.moratorium.allowed
    ? Array.from({ length: Math.floor(scheme.terms.moratorium.maxMonths / 3) + 1 }, (_, i) => i * 3)
    : [0];

  async function save() {
    try {
      await patch.mutateAsync({
        requestedLoanPaise: amount,
        interestRateBps: rateBps,
        tenureMonths: tenure,
        moratoriumMonths: moratorium,
      });
      toast(t('lp.savedToast'));
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : t('lp.couldNotSave'));
    }
  }

  async function verify() {
    try {
      const p = await serverCalc.mutateAsync({
        schemeCode: scheme!.code,
        projectCostPaise: projectCost,
        ownContributionPaise: ownContribution,
        requestedLoanPaise: amount,
        interestRateBps: rateBps,
        tenureMonths: tenure,
        moratoriumMonths: moratorium,
      });
      setServerPlan(p);
      const matches = p.monthlyInstalmentPaise === plan?.monthlyInstalmentPaise;
      toast(matches ? t('lp.serverMatchesToast') : t('lp.serverDiffersToast'));
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : t('lp.serverCalcFailed'));
    }
  }

  const chart = plan
    ? [
        { name: 'Principal', value: paiseToRupees(plan.principalPaise), color: '#087b5d' },
        { name: 'Interest', value: paiseToRupees(plan.totalInterestPaise), color: '#b7e9dc' },
      ]
    : [];

  return (
    <>
      <PageTitle title={t('lp.title')}>{t('lp.introRef', { ref: application.reference, scheme: scheme.name })}</PageTitle>

      {!editable && (
        <div className="inline-callout" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>{t('lp.readonlyNote', { status: L.status(application.status) })}</span>
        </div>
      )}

      <div className="planner-grid">
        <article className="card planner-inputs">
          <h2>{t('lp.inputs')}</h2>
          <label>
            {t('lp.loanAmount')} <b>{formatPaise(amount)}</b>
            <input
              type="range"
              min={scheme.financing.minAmountPaise}
              max={scheme.financing.maxAmountPaise}
              step={1000 * 100}
              value={amount}
              disabled={!editable}
              onChange={(e) => setAmount(+e.target.value)}
            />
            <span>
              {formatPaise(scheme.financing.minAmountPaise)} <i /> {formatPaise(scheme.financing.maxAmountPaise)}
            </span>
          </label>
          <label>
            {t('lp.repaymentTenure')}
            <select value={tenure} disabled={!editable} onChange={(e) => setTenure(+e.target.value)}>
              {tenureOptions.map((m) => (
                <option key={m} value={m}>
                  {m} {t('common.months')}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('lp.interestRate')}
            <select value={rateBps} disabled={!editable} onChange={(e) => setRateBps(+e.target.value)}>
              {rateOptions.map((b) => (
                <option key={b} value={b}>
                  {bpsToPct(b)} {t('lp.annually')}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('lp.moratoriumPeriod')}
            <select value={moratorium} disabled={!editable || !scheme.terms.moratorium.allowed} onChange={(e) => setMoratorium(+e.target.value)}>
              {moratoriumOptions.map((m) => (
                <option key={m} value={m}>
                  {m ? `${m} ${t('common.months')}` : t('lp.noMoratorium')}
                </option>
              ))}
            </select>
          </label>

          <div className="smart-insight">
            <Sparkles />
            <span>
              <b>{t('lp.schemeCap')}</b>
              {t('lp.schemeCapInsight', {
                pct: scheme.financing.maxProjectCostSharePct,
                cost: formatPaise(projectCost),
                cap: formatPaise(plan?.schemeFinancingCapPaise ?? 0),
                req: formatPaise(amount),
              })}
            </span>
          </div>

          {editable && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={save} loading={patch.isPending}>
                {t('lp.saveFinancialPlan')}
              </Button>
              <button className="button outline" onClick={verify} disabled={serverCalc.isPending}>
                {t('lp.verifyServer')} <Info size={16} />
              </button>
            </div>
          )}
        </article>

        <article className="card loan-results">
          <h2>{t('lp.yourEstimate')}</h2>
          {planError ? (
            <div className="inline-note warn">{planError}</div>
          ) : plan ? (
            <>
              <div className="result-main">
                <span>{t('lp.illustrativeEmi')}</span>
                <b>{formatPaise(plan.monthlyInstalmentPaise)}</b>
                <small>
                  {t('lp.emiSub', {
                    rate: bpsToPct(rateBps),
                    n: plan.repaymentMonths,
                    mor: moratorium ? t('lp.morSuffix', { n: moratorium }) : '',
                    final: formatPaise(plan.finalInstalmentPaise),
                  })}
                </small>
              </div>
              <div className="results-row">
                <div>
                  <span>{t('lp.totalInterest')}</span>
                  <b>{formatPaise(plan.totalInterestPaise)}</b>
                </div>
                <div>
                  <span>{t('lp.totalRepayment')}</span>
                  <b>{formatPaise(plan.totalRepaymentPaise)}</b>
                </div>
                <div>
                  <span>{t('lp.moratoriumInterest')}</span>
                  <b>{formatPaise(plan.moratoriumInterestPaise)}</b>
                </div>
              </div>
              <div className="loan-chart">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={chart} dataKey="value" innerRadius={46} outerRadius={70} paddingAngle={3}>
                      {chart.map((x) => (
                        <Cell key={x.name} fill={x.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div>
                  <span>
                    <i className="dot green" /> {t('lp.principal')}
                  </span>
                  <span>
                    <i className="dot mint" /> {t('lp.interestCol')}
                  </span>
                </div>
              </div>

              {plan.validationMessages.length > 0 && (
                <div className="inline-note warn">
                  {plan.validationMessages.map((m, i) => (
                    <span key={i}>
                      • {m}
                      <br />
                    </span>
                  ))}
                </div>
              )}
              {plan.assumptions.length > 0 && (
                <div className="inline-note">
                  <b>{t('lp.assumptionsLabel')}</b>
                  <br />
                  {plan.assumptions.map((a, i) => (
                    <span key={i}>
                      • {a}
                      <br />
                    </span>
                  ))}
                </div>
              )}

              {serverPlan && (
                <div className="inline-note" style={{ borderTop: '1px solid #e6eef2', paddingTop: 8 }}>
                  <b>{t('lp.serverAuthoritative')}</b> EMI {formatPaise(serverPlan.monthlyInstalmentPaise)} ·{' '}
                  {t('lp.totalInterest')} {formatPaise(serverPlan.totalInterestPaise)}{' '}
                  {serverPlan.monthlyInstalmentPaise === plan.monthlyInstalmentPaise ? '✓' : '✗'}
                </div>
              )}
            </>
          ) : null}
        </article>
      </div>

      {plan && plan.amortizationSchedule.length > 0 && (
        <article className="card schedule">
          <div className="card-head">
            <h2>{t('lp.scheduleTitle')}</h2>
            <span>{t('lp.scheduleSub', { n: plan.amortizationSchedule.length })}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>EMI</th>
                <th>{t('lp.principal')}</th>
                <th>{t('lp.interestCol')}</th>
                <th>{t('lp.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {plan.amortizationSchedule.slice(0, 12).map((r) => (
                <tr key={r.period}>
                  <td>{r.period}</td>
                  <td>{formatPaise(r.paymentPaise)}</td>
                  <td>{formatPaise(r.principalPaise)}</td>
                  <td>{formatPaise(r.interestPaise)}</td>
                  <td>{formatPaise(r.closingBalancePaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      )}
    </>
  );
}

function rateStops(minBps: number, maxBps: number): number[] {
  if (minBps === maxBps) return [minBps];
  const out: number[] = [];
  for (let b = minBps; b <= maxBps; b += 100) out.push(b);
  if (out[out.length - 1] !== maxBps) out.push(maxBps);
  return out;
}

function tenureStops(min: number, max: number): number[] {
  const out: number[] = [];
  for (let m = min; m <= max; m += 6) out.push(m);
  if (out[out.length - 1] !== max) out.push(max);
  return out;
}
