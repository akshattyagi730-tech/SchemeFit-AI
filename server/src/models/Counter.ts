import { Schema } from 'mongoose';
import { defineModel } from './registry';

/** Atomic sequence generator (used for application references). */
interface CounterAttrs {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<CounterAttrs>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter = defineModel<CounterAttrs>('Counter', counterSchema);

export async function nextSequence(name: string): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc!.seq;
}
