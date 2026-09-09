import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SchemeMatches } from './SchemeMatches';
import { ToastProvider } from '../app/toast';
import { LangProvider } from '../i18n';

const recommendations = {
  generatedAt: '2026-09-07T00:00:00Z',
  profileComplete: true,
  counts: { eligible: 1, needsInformation: 0, ineligible: 1 },
  eligible: [
    {
      scheme: {
        id: '1', code: 'NSFDC-TL', name: 'NSFDC Term Loan', provider: 'NSFDC', program: 'demo', displayCategory: 'Term Loan',
        description: 'demo', supportedPurposes: ['business_expansion'], eligibility: {},
        financing: { minAmountPaise: 100000, maxAmountPaise: 3000000, maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
        terms: { minInterestRateBps: 600, maxInterestRateBps: 800, minTenureMonths: 24, maxTenureMonths: 120, moratorium: { allowed: true, maxMonths: 6, interestHandling: 'serviced', tenureIncludesMoratorium: false } },
        requiredDocuments: [{ type: 'identity_proof', label: 'ID' }],
        source: { url: '', version: 'demo', demoData: true, verificationDate: null },
        dataClassification: 'demonstration-data', status: 'active',
      },
      eligibility: { status: 'eligible', conditions: [], passed: ['social_category'], failed: [], unknown: [], advisories: [] },
      suitability: { score: 82, factors: [{ key: 'cost_of_credit', label: 'Cost of credit', weight: 0.25, rawScore: 90, weightedScore: 22.5, explanation: 'Interest starts at 6%.' }], disclaimer: 'This is a transparent ranking score, not a loan-approval probability.' },
    },
  ],
  needsInformation: [],
  ineligible: [
    {
      scheme: {
        id: '2', code: 'MICRO-CREDIT', name: 'Micro Enterprise Credit', provider: 'NBFC', program: 'demo', displayCategory: 'Micro Finance',
        description: 'demo', supportedPurposes: ['business_new'], eligibility: {},
        financing: { minAmountPaise: 10000, maxAmountPaise: 150000, maxProjectCostSharePct: 80, minOwnContributionPct: 15 },
        terms: { minInterestRateBps: 1400, maxInterestRateBps: 1800, minTenureMonths: 6, maxTenureMonths: 36, moratorium: { allowed: false, maxMonths: 0, interestHandling: 'serviced', tenureIncludesMoratorium: true } },
        requiredDocuments: [{ type: 'identity_proof', label: 'ID' }],
        source: { url: '', version: 'demo', demoData: true, verificationDate: null },
        dataClassification: 'demonstration-data', status: 'active',
      },
      eligibility: {
        status: 'ineligible', conditions: [], passed: [], unknown: [], advisories: [],
        failed: [{ key: 'financing_rules', label: 'Financing limits', detail: 'Requested loan exceeds the scheme maximum.' }],
      },
    },
  ],
  notes: ['Eligibility is decided by a deterministic rule engine.'],
};

function mockFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body =
        url.includes('/recommendations') ? { data: recommendations } :
        url.includes('/applications') ? { data: [] } :
        url.includes('/auth/csrf') ? { data: { csrfToken: 't' } } :
        { data: {} };
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
    }),
  );
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LangProvider>
        <ToastProvider>{ui}</ToastProvider>
      </LangProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('SchemeMatches screen', () => {
  it('shows a loading state, then splits eligible (ranked) from ineligible (with reasons)', async () => {
    mockFetch();
    wrap(<SchemeMatches navigate={() => {}} />);

    expect(screen.getByText(/Loading/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('NSFDC Term Loan')).toBeInTheDocument());
    expect(screen.getByText(/Eligible & ranked \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/82\/100 suitability/)).toBeInTheDocument();

    // Ineligible scheme is shown with its failure reason, and NOT ranked.
    expect(screen.getByText(/Not eligible — shown with reasons/)).toBeInTheDocument();
    expect(screen.getByText(/Requested loan exceeds the scheme maximum/)).toBeInTheDocument();
  });

  it('surfaces the "no AI decides eligibility" note', async () => {
    mockFetch();
    wrap(<SchemeMatches navigate={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(/Eligibility is decided by a deterministic rule engine\./i)).toBeInTheDocument(),
    );
  });
});
