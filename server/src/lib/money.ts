/**
 * Money handling.
 *
 * The API contract: every monetary value crossing the wire is an INTEGER number
 * of paise (1 rupee = 100 paise). The frontend converts to/from rupees for
 * display and input. Never store or transmit floating rupees.
 *
 * Rounding boundary: all derived amounts (interest, EMI, instalments) are rounded
 * to the nearest paise using half-up rounding at the point of computation. The
 * final instalment absorbs any accumulated rounding drift so the schedule always
 * closes at exactly zero.
 */

export type Paise = number;

export const RUPEE = 100;

/** Half-up rounding to an integer paise value. */
export function roundPaise(value: number): Paise {
  if (!Number.isFinite(value)) throw new Error('roundPaise: non-finite value');
  return Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
}

export function rupeesToPaise(rupees: number): Paise {
  return roundPaise(rupees * RUPEE);
}

export function paiseToRupees(paise: Paise): number {
  return paise / RUPEE;
}

export function assertNonNegativeInt(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer (paise)`);
  }
}

export function assertPositiveInt(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer (paise)`);
  }
}
