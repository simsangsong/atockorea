/**
 * Shared validation helpers for API routes.
 */

/**
 * Returns keys that are missing or empty in body (null, undefined, or '').
 * Use with ErrorResponses.validationError() to keep consistent response shape.
 */
export function getMissingRequiredFields(
  body: Record<string, unknown>,
  keys: string[]
): string[] {
  return keys.filter((k) => {
    const v = body[k];
    return v == null || v === '';
  });
}

/** Min/max length for booking customer name */
const BOOKING_NAME_MIN_LEN = 2;
const BOOKING_NAME_MAX_LEN = 100;

/** Email regex (same as common frontend validation) */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LEN = 254;

/** Phone: after stripping non-digits except leading +, must have at least this many digits */
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

export interface BookingCustomerInfo {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates booking customer info (name, email, phone) to reduce spam and invalid orders.
 * Use for both guest and logged-in user contact info when provided.
 */
export function validateBookingCustomerInfo(info: unknown): ValidationResult {
  const errors: string[] = [];

  if (!info || typeof info !== 'object') {
    return { valid: false, errors: ['Customer info is required'] };
  }

  const name = typeof (info as BookingCustomerInfo).name === 'string'
    ? (info as BookingCustomerInfo).name!.trim()
    : '';
  const email = typeof (info as BookingCustomerInfo).email === 'string'
    ? (info as BookingCustomerInfo).email!.trim()
    : '';
  const phone = typeof (info as BookingCustomerInfo).phone === 'string'
    ? (info as BookingCustomerInfo).phone!.trim()
    : '';

  if (!name) {
    errors.push('Name is required');
  } else {
    if (name.length < BOOKING_NAME_MIN_LEN) {
      errors.push(`Name must be at least ${BOOKING_NAME_MIN_LEN} characters`);
    }
    if (name.length > BOOKING_NAME_MAX_LEN) {
      errors.push(`Name must be at most ${BOOKING_NAME_MAX_LEN} characters`);
    }
  }

  if (!email) {
    errors.push('Email is required');
  } else {
    if (!EMAIL_REGEX.test(email)) {
      errors.push('Invalid email format');
    }
    if (email.length > EMAIL_MAX_LEN) {
      errors.push('Email is too long');
    }
  }

  if (!phone) {
    errors.push('Phone number is required');
  } else {
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length < PHONE_MIN_DIGITS) {
      errors.push(`Phone must have at least ${PHONE_MIN_DIGITS} digits`);
    }
    if (digitsOnly.length > PHONE_MAX_DIGITS) {
      errors.push(`Phone must have at most ${PHONE_MAX_DIGITS} digits`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates number of guests for a booking (min 1, max 50).
 */
export function validateNumberOfGuests(value: unknown): ValidationResult {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 1) {
    return { valid: false, errors: ['Number of guests must be at least 1'] };
  }
  if (n > 50) {
    return { valid: false, errors: ['Number of guests cannot exceed 50'] };
  }
  return { valid: true, errors: [] };
}

/**
 * Validates booking date is today or in the future (no past dates).
 */
export function validateBookingDate(value: unknown): ValidationResult {
  if (value == null || value === '') {
    return { valid: false, errors: ['Booking date is required'] };
  }
  const str = String(value);
  const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
  const d = new Date(datePart);
  if (Number.isNaN(d.getTime())) {
    return { valid: false, errors: ['Invalid booking date'] };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const bookingDay = new Date(d);
  bookingDay.setHours(0, 0, 0, 0);
  if (bookingDay < today) {
    return { valid: false, errors: ['Booking date cannot be in the past'] };
  }
  return { valid: true, errors: [] };
}
