/**
 * Financial Calculation Utilities
 * 财务计算工具函数
 */

import { PLATFORM_COMMISSION_RATE, calculatePlatformFee, calculateMerchantPayout } from './constants';

/**
 * Calculate financial summary for a set of bookings
 * 计算一组订单的财务汇总
 */
export interface FinancialSummary {
  totalRevenue: number;           // 客人支付总金额
  platformFee: number;            // 平台手续费（10%）
  merchantPayout: number;         // 商家应收金额（90%）
  pendingSettlement: number;       // 待结算金额（扣除手续费后）
  settledRevenue: number;          // 已结算金额（扣除手续费后）
  remainingBalance: number;       // 付后结余
  totalBookings: number;          // 总订单数
}

export function calculateFinancialSummary(
  bookings: Array<{ final_price: number; payment_status?: string; settlement_status?: string }>
): FinancialSummary {
  const totalRevenue = bookings.reduce((sum, b) => sum + (b.final_price || 0), 0);
  const platformFee = calculatePlatformFee(totalRevenue);
  const merchantPayout = calculateMerchantPayout(totalRevenue);
  
  // 待结算金额：已支付但未结算的订单（扣除手续费后）
  const pendingSettlement = bookings
    .filter((b) => b.payment_status === 'paid' && b.settlement_status !== 'settled')
    .reduce((sum, b) => sum + calculateMerchantPayout(b.final_price || 0), 0);
  
  // 已结算金额：已结算的订单（扣除手续费后）
  const settledRevenue = bookings
    .filter((b) => b.settlement_status === 'settled')
    .reduce((sum, b) => sum + calculateMerchantPayout(b.final_price || 0), 0);
  
  // 付后结余 = 实际应收金额 - 已结算金额
  const remainingBalance = merchantPayout - settledRevenue;
  
  return {
    totalRevenue,
    platformFee,
    merchantPayout,
    pendingSettlement,
    settledRevenue,
    remainingBalance,
    totalBookings: bookings.length,
  };
}

/**
 * Calculate daily financial metrics
 * 计算每日财务指标
 */
export interface DailyFinancialMetrics {
  date: string;
  revenue: number;
  platformFee: number;
  merchantPayout: number;
  orders: number;
  pendingSettlement: number;
  settledRevenue: number;
}

export function calculateDailyFinancialMetrics(
  bookings: Array<{
    booking_date?: string;
    created_at?: string;
    final_price: number;
    payment_status?: string;
    settlement_status?: string;
  }>
): DailyFinancialMetrics[] {
  const dailyData: { [key: string]: DailyFinancialMetrics } = {};
  
  bookings.forEach((booking) => {
    const date = booking.booking_date || booking.created_at?.split('T')[0];
    if (!date) return;
    
    if (!dailyData[date]) {
      dailyData[date] = {
        date,
        revenue: 0,
        platformFee: 0,
        merchantPayout: 0,
        orders: 0,
        pendingSettlement: 0,
        settledRevenue: 0,
      };
    }
    
    const amount = booking.final_price || 0;
    dailyData[date].revenue += amount;
    dailyData[date].platformFee += calculatePlatformFee(amount);
    dailyData[date].merchantPayout += calculateMerchantPayout(amount);
    dailyData[date].orders += 1;
    
    if (booking.payment_status === 'paid') {
      const payout = calculateMerchantPayout(amount);
      if (booking.settlement_status === 'settled') {
        dailyData[date].settledRevenue += payout;
      } else {
        dailyData[date].pendingSettlement += payout;
      }
    }
  });
  
  return Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate product performance metrics
 * 计算产品表现指标
 */
export interface ProductPerformance {
  productId: string;
  productName: string;
  orders: number;
  revenue: number;
  platformFee: number;
  merchantPayout: number;
  averageOrderValue: number;
}

export function calculateProductPerformance(
  bookings: Array<{
    tour_id?: string;
    final_price: number;
    tours?: { id: string; title: string };
  }>
): ProductPerformance[] {
  const productStats: { [key: string]: ProductPerformance } = {};
  
  bookings.forEach((booking) => {
    if (!booking.tour_id || !booking.tours) return;
    
    const tourId = booking.tour_id;
    if (!productStats[tourId]) {
      productStats[tourId] = {
        productId: tourId,
        productName: booking.tours.title || 'Unknown Tour',
        orders: 0,
        revenue: 0,
        platformFee: 0,
        merchantPayout: 0,
        averageOrderValue: 0,
      };
    }
    
    const amount = booking.final_price || 0;
    productStats[tourId].orders += 1;
    productStats[tourId].revenue += amount;
    productStats[tourId].platformFee += calculatePlatformFee(amount);
    productStats[tourId].merchantPayout += calculateMerchantPayout(amount);
  });
  
  // Calculate average order value for each product
  Object.values(productStats).forEach((product) => {
    product.averageOrderValue = product.orders > 0
      ? product.revenue / product.orders
      : 0;
  });
  
  return Object.values(productStats).sort((a, b) => b.orders - a.orders);
}

