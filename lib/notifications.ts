/**
 * Notification Helper Functions
 */

import { createServerClient } from './supabase';

export type NotificationType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'payment_completed'
  | 'payment_failed'
  | 'review_received'
  | 'tour_reminder'
  | 'system_announcement'
  | 'merchant_new_order'
  | 'merchant_cancellation'
  | 'admin_alert';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type,
      resource_type: params.resourceType || null,
      resource_id: params.resourceId || null,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }

  return { success: true, notification: data };
}

/**
 * Create booking-related notifications
 */
export async function notifyBookingCreated(bookingId: string, userId: string, tourTitle: string) {
  return createNotification({
    userId,
    title: 'Booking Created',
    message: `Your booking for "${tourTitle}" has been created. Waiting for payment confirmation.`,
    type: 'booking_created',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { tourTitle },
  });
}

export async function notifyBookingConfirmed(bookingId: string, userId: string, tourTitle: string) {
  return createNotification({
    userId,
    title: 'Booking Confirmed',
    message: `Your booking for "${tourTitle}" has been confirmed. Enjoy your tour!`,
    type: 'booking_confirmed',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { tourTitle },
  });
}

export async function notifyBookingCancelled(bookingId: string, userId: string, tourTitle: string, refundAmount?: number) {
  return createNotification({
    userId,
    title: 'Booking Cancelled',
    message: refundAmount
      ? `Your booking for "${tourTitle}" has been cancelled. Refund of ₩${refundAmount.toLocaleString()} will be processed.`
      : `Your booking for "${tourTitle}" has been cancelled.`,
    type: 'booking_cancelled',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { tourTitle, refundAmount },
  });
}

/**
 * Create payment-related notifications
 */
export async function notifyPaymentCompleted(bookingId: string, userId: string, amount: number) {
  return createNotification({
    userId,
    title: 'Payment Completed',
    message: `Payment of ₩${amount.toLocaleString()} has been completed successfully.`,
    type: 'payment_completed',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { amount },
  });
}

export async function notifyPaymentFailed(bookingId: string, userId: string, reason?: string) {
  return createNotification({
    userId,
    title: 'Payment Failed',
    message: reason
      ? `Payment failed: ${reason}. Please try again.`
      : 'Payment failed. Please try again or contact support.',
    type: 'payment_failed',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { reason },
  });
}

/**
 * Create merchant notifications
 */
export async function notifyMerchantNewOrder(merchantId: string, bookingId: string, tourTitle: string) {
  // Get merchant user_id
  const supabase = createServerClient();
  const { data: merchant } = await supabase
    .from('merchants')
    .select('user_id')
    .eq('id', merchantId)
    .single();

  if (!merchant?.user_id) {
    console.error('Merchant not found:', merchantId);
    return { success: false, error: 'Merchant not found' };
  }

  return createNotification({
    userId: merchant.user_id,
    title: 'New Order',
    message: `New booking for "${tourTitle}" has been received.`,
    type: 'merchant_new_order',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { tourTitle },
  });
}

/**
 * Create tour reminder notification
 */
export async function notifyTourReminder(bookingId: string, userId: string, tourTitle: string, bookingDate: string) {
  const date = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return createNotification({
    userId,
    title: 'Tour Reminder',
    message: `Your tour "${tourTitle}" is scheduled for ${date}. Please arrive 10 minutes early.`,
    type: 'tour_reminder',
    resourceType: 'booking',
    resourceId: bookingId,
    metadata: { tourTitle, bookingDate },
  });
}



