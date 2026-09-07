import { Scheme, type SchemeDoc } from '../../models/Scheme';
import { notFound } from '../../lib/errors';
import mongoose from 'mongoose';

export async function findSchemeByIdOrCode(idOrCode: string): Promise<SchemeDoc> {
  const query = mongoose.isValidObjectId(idOrCode)
    ? { _id: idOrCode }
    : { code: idOrCode.toUpperCase() };
  const scheme = await Scheme.findOne(query);
  if (!scheme) throw notFound('Scheme not found');
  return scheme;
}

export async function listSchemes(opts: {
  page: number;
  pageSize: number;
  sort: string;
  order: 'asc' | 'desc';
  purpose?: string;
  status: 'active' | 'archived' | 'all';
}) {
  const filter: Record<string, unknown> = {};
  if (opts.status !== 'all') filter.status = opts.status;
  if (opts.purpose) filter.supportedPurposes = opts.purpose;

  const [items, total] = await Promise.all([
    Scheme.find(filter)
      .sort({ [opts.sort]: opts.order === 'asc' ? 1 : -1 })
      .skip((opts.page - 1) * opts.pageSize)
      .limit(opts.pageSize),
    Scheme.countDocuments(filter),
  ]);
  return { items, total };
}
