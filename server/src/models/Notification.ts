import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

export const NOTIFICATION_EVENTS = [
  'account_welcome',
  'recommendations_ready',
  'application_created',
  'application_submitted',
  'application_assigned',
  'application_under_review',
  'application_changes_requested',
  'application_approved',
  'application_rejected',
  'application_reassigned',
  'document_uploaded',
  'document_verified',
  'document_changes_requested',
  'document_resubmitted',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export interface NotificationAttrs {
  recipientUserId: Types.ObjectId;
  event: NotificationEvent;
  title: string;
  message: string;
  link: string;
  applicationId: Types.ObjectId | null;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<NotificationAttrs>(
  {
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', default: null },
    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientUserId: 1, createdAt: -1 });

export type NotificationDoc = HydratedDocument<NotificationAttrs>;
export const Notification: Model<NotificationAttrs> = defineModel<NotificationAttrs>('Notification', notificationSchema);
