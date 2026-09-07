import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { findSchemeByIdOrCode } from '../schemes/schemes.service';
import { runCalculation } from './finance.service';
import type { CalcInput } from './finance.schemas';

export async function calculate(req: Request, res: Response): Promise<void> {
  const body = req.body as CalcInput;
  const scheme = await findSchemeByIdOrCode(body.schemeCode);
  const plan = runCalculation(scheme, body);
  ok(res, {
    scheme: { code: scheme.code, name: scheme.name },
    input: body,
    plan,
    contract: {
      currency: 'INR-paise',
      note: 'This is the authoritative calculation. The frontend live preview uses the identical algorithm and must match this output for the same inputs.',
      illustrativeOnly: true,
    },
  });
}
