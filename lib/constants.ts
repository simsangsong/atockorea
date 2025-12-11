/**
 * Platform Configuration Constants
 */

// Platform commission rate (10%)
export const PLATFORM_COMMISSION_RATE = 0.1; // 10%

// Platform fee calculation helper
export function calculatePlatformFee(amount: number): number {
  return amount * PLATFORM_COMMISSION_RATE;
}

// Merchant payout calculation helper
export function calculateMerchantPayout(amount: number): number {
  return amount - calculatePlatformFee(amount);
}


