import mongoose, { type Model, type Schema } from 'mongoose';

/**
 * Idempotent model registration. Returns the existing compiled model if one is
 * already registered (avoids OverwriteModelError under test isolation / HMR).
 */
export function defineModel<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}
