import { useMemo, useState, useEffect } from 'react';
import { Sparkles, Info, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { PageTitle, Button, Loading, ErrorState, EmptyState } from '../components/ui';
import { useApplication, useSchemes, usePatchFinancing, useFinanceCalculation } from '../api/hooks';
import { useActiveApplication } from '../app/active-application';
import { useToast } from '../app/toast';
import { ApiError } from '../api/client';
import { calculateFinancePlan, type FinancePlan } from '../lib/finance';
import { formatPaise, paiseToRupees, rupeesToPaise, bpsToPct } from '../lib/format';

export function LoanPlanner({ navigate }: { navigate: (to: string) => void }) {
  const { active, activeId, isLoading: appsLoading } = useActiveApplication();
  const { data: application, isLoading, isError, error, refetch } = useApplication(activeId ?? undefined);
  const { data: schemes } = useSchemes();
  const { toast, errorToast } = useToast();

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

  if (appsLoading || isLoading) return <Loading label="Loading your loan plan…" />;
  if (!activeId)
    return (
      <>
        <PageTitle title="Smart Loan Planner">Model your repayment for a scheme you’ve started an application for.</PageTitle>
        <EmptyState
          title="No application selected"
          hint="Start an application from Scheme Matches, then return here to model the repayment."
        />
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => navigate('/schemes')}>Go to Scheme Matches</Button>
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
    planError = e instanceof Error ? e.message : 'Cannot compute a plan for these inputs.';
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
      toast('Financial plan saved to your application.');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Could not save the plan.');
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
      toast(matches ? 'Server calculation matches the preview exactly.' : 'Server returned a different figure — see below.');
    } catch (err) {
      errorToast(err instanceof ApiError ? err.message : 'Server calculation failed.');
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
      <PageTitle title="Smart Loan Planner">
        {application.reference} · {scheme.name}. Every figure below is computed from your inputs — nothing is pre-set.
      </PageTitle>

      {!editable && (
        <div className="prototype-banner" style={{ marginBottom: 14 }}>
          <AlertTriangle size={15} />
          <span>
            This application is <b>{application.status}</b>. The plan is read-only; the figures shown are the snapshot saved
            at submission.
          </span>
        </div>
      )}

      <div className="planner-grid">
        <article className="card planner-inputs">
          <h2>Plan your loan</h2>
          <label>
            Loan amount <b>{formatPaise(amount)}</b>
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
            Repayment tenure
            <select value={tenure} disabled={!editable} onChange={(e) => setTenure(+e.target.value)}>
              {tenureOptions.map((m) => (
                <option key={m} value={m}>
                  {m} months
                </option>
              ))}
            </select>
          </label>
          <label>
            Interest rate
            <select value={rateBps} disabled={!editable} onChange={(e) => setRateBps(+e.target.value)}>
              {rateOptions.map((b) => (
                <option key={b} value={b}>
                  {bpsToPct(b)} annually
                </option>
              ))}
            </select>
          </label>
          <label>
            Moratorium period
            <select value={moratorium} disabled={!editable || !scheme.terms.moratorium.allowed} onChange={(e) => setMoratorium(+e.target.value)}>
              {moratoriumOptions.map((m) => (
                <option key={m} value={m}>
                  {m ? `${m} months` : 'No moratorium'}
                </option>
              ))}
            </select>
          </label>

          <div className="smart-insight">
            <Sparkles />
            <span>
              <b>Scheme financing cap</b>
              This scheme funds up to {scheme.financing.maxProjectCostSharePct}% of your {formatPaise(projectCost)} project
              cost — {formatPaise(plan?.schemeFinancingCapPaise ?? 0)}. You’ve requested {formatPaise(amount)}.
              {scheme.terms.moratorium.allowed && (
                <>
                  {' '}
                  Moratorium interest is <b>{scheme.terms.moratorium.interestHandling}</b> and the tenure{' '}
                  {scheme.terms.moratorium.tenureIncludesMoratorium ? 'includes' : 'excludes'} it.
                </>
              )}
            </span>
          </div>

          {editable && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button onClick={save} loading={patch.isPending}>
                Save Financial Plan
              </Button>
              <button className="button outline" onClick={verify} disabled={serverCalc.isPending}>
                Verify against server <Info size={16} />
              </button>
            </div>
          )}
        </article>

        <article className="card loan-results">
          <h2>Your estimate</h2>
          {planError ? (
            <div className="inline-note warn">{planError}</div>
          ) : plan ? (
            <>
              <div className="result-main">
                <span>Illustrative monthly EMI</span>
                <b>{formatPaise(plan.monthlyInstalmentPaise)}</b>
                <small>
                  {bpsToPct(rateBps)} · {plan.repaymentMonths} EMIs
                  {moratorium ? ` · ${moratorium}-month moratorium` : ''} · final instalment{' '}
                  {formatPaise(plan.finalInstalmentPaise)}
                </small>
              </div>
              <div className="results-row">
                <div>
                  <span>Total interest</span>
                  <b>{formatPaise(plan.totalInterestPaise)}</b>
                </div>
                <div>
                  <span>Total repayment</span>
                  <b>{formatPaise(plan.totalRepaymentPaise)}</b>
                </div>
                <div>
                  <span>Moratorium interest</span>
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
                    <i className="dot green" /> Principal
                  </span>
                  <span>
                    <i className="dot mint" /> Interest
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
                  <b>Assumptions:</b>
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
                  <b>Server (authoritative):</b> EMI {formatPaise(serverPlan.monthlyInstalmentPaise)} · total interest{' '}
                  {formatPaise(serverPlan.totalInterestPaise)}{' '}
                  {serverPlan.monthlyInstalmentPaise === plan.monthlyInstalmentPaise ? '— matches ✓' : '— differs ✗'}
                </div>
              )}
            </>
          ) : null}
        </article>
      </div>

      {plan && plan.amortizationSchedule.length > 0 && (
        <article className="card schedule">
          <div className="card-head">
            <h2>Amortization schedule</h2>
            <span>First 12 of {plan.amortizationSchedule.length} instalments</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>EMI</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Balance</th>
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
