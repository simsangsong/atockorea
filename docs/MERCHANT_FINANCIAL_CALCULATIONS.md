# 商家端财务计算逻辑完整文档
## Merchant Dashboard Financial Calculations Documentation

### ✅ 已实现的财务计算逻辑

#### 1. 核心财务计算函数 (`lib/constants.ts`)

```typescript
// 平台手续费率（10%）
export const PLATFORM_COMMISSION_RATE = 0.1;

// 计算平台手续费
export function calculatePlatformFee(amount: number): number {
  return amount * PLATFORM_COMMISSION_RATE;
}

// 计算商家应收金额（扣除平台手续费后）
export function calculateMerchantPayout(amount: number): number {
  return amount - calculatePlatformFee(amount);
}
```

**状态**: ✅ 已完整实现

---

#### 2. 财务计算工具函数 (`lib/financial-calculations.ts`)

**新增工具函数**:

1. **`calculateFinancialSummary()`** - 计算财务汇总
   - 输入：订单数组
   - 输出：完整的财务汇总（总收入、平台费、商家应收、待结算、已结算、付后结余）

2. **`calculateDailyFinancialMetrics()`** - 计算每日财务指标
   - 按日期分组计算财务数据
   - 用于图表展示

3. **`calculateProductPerformance()`** - 计算产品表现
   - 按产品分组计算财务数据
   - 包含订单数、收入、平台费、商家应收、平均订单金额

**状态**: ✅ 已完整实现

---

#### 3. Dashboard Stats API (`/api/merchant/dashboard/stats`)

**已实现的统计**:

| 统计项 | 计算逻辑 | 状态 |
|--------|---------|------|
| **今天订单数** | `COUNT(*) WHERE merchant_id = ? AND DATE(booking_date) = TODAY` | ✅ |
| **待处理订单数** | `COUNT(*) WHERE merchant_id = ? AND status = 'pending'` | ✅ |
| **总产品数** | `COUNT(*) WHERE merchant_id = ?` | ✅ |
| **活跃产品数** | `COUNT(*) WHERE merchant_id = ? AND is_active = true` | ✅ |
| **今天收入** | `SUM(final_price) WHERE merchant_id = ? AND DATE(booking_date) = TODAY` | ✅ |
| **今天平台手续费** | `calculatePlatformFee(todayRevenue)` | ✅ |
| **今天商家应收** | `calculateMerchantPayout(todayRevenue)` | ✅ |
| **今天待结算** | `SUM(calculateMerchantPayout(amount)) WHERE payment_status='paid' AND settlement_status!='settled'` | ✅ |
| **今天已结算** | `SUM(calculateMerchantPayout(amount)) WHERE settlement_status='settled'` | ✅ |
| **总收入** | `SUM(final_price) WHERE merchant_id = ?` | ✅ |
| **总平台手续费** | `calculatePlatformFee(totalRevenue)` | ✅ |
| **总商家应收** | `calculateMerchantPayout(totalRevenue)` | ✅ |
| **待结算金额** | `SUM(calculateMerchantPayout(amount)) WHERE payment_status='paid' AND settlement_status='pending'` | ✅ |
| **已结算金额** | `SUM(calculateMerchantPayout(amount)) WHERE settlement_status='settled'` | ✅ |
| **付后结余** | `总商家应收 - 已结算金额` | ✅ |

**状态**: ✅ 已完整实现并补全

---

#### 4. Dashboard Trend API (`/api/merchant/dashboard/trend`)

**已实现的趋势数据**:

- ✅ 订单趋势（按日期分组）
- ✅ 收入趋势（按日期分组）
- ✅ 订单状态分布（pending, confirmed, completed）
- ✅ 结算金额趋势（使用 `calculateMerchantPayout`）

**状态**: ✅ 已完整实现并修复（使用统一的计算函数）

---

#### 5. Revenue API (`/api/merchant/revenue`)

**已实现的财务计算**:

- ✅ 总支付金额 = `SUM(final_price)`
- ✅ 平台手续费 = `calculatePlatformFee(totalRevenue)` (10%)
- ✅ 实际应收金额 = `calculateMerchantPayout(totalRevenue)` (90%)
- ✅ 待结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE payment_status='paid' AND settlement_status='pending'`
- ✅ 已结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE settlement_status='settled'`
- ✅ 付后结余 = `实际应收金额 - 已结算金额`
- ✅ 每笔订单的财务明细（平台费、商家应收）

**状态**: ✅ 已完整实现

---

#### 6. Analytics API (`/api/merchant/analytics`)

**已实现的分析数据**:

- ✅ 总营收
- ✅ 总平台手续费（新增）
- ✅ 总商家应收金额（新增）
- ✅ 总订单数
- ✅ 平均订单金额
- ✅ 热门产品（按订单数和收入）
- ✅ 销售趋势（按日期分组）

**状态**: ✅ 已完整实现并补全财务指标

---

### 📊 财务计算流程图

```
客人支付金额 (final_price)
    ↓
    ├─→ 平台手续费 (10%) = calculatePlatformFee(amount)
    │
    └─→ 商家应收金额 (90%) = calculateMerchantPayout(amount)
            ↓
            ├─→ 已结算 (settled) → settledRevenue
            │
            └─→ 待结算 (pending) → pendingSettlement
                    ↓
                    付后结余 = 总商家应收 - 已结算金额
```

---

### ✅ 完整覆盖确认

#### 所有财务计算逻辑都已实现：

1. ✅ **平台手续费计算** - 统一使用 `calculatePlatformFee()`
2. ✅ **商家应收金额计算** - 统一使用 `calculateMerchantPayout()`
3. ✅ **待结算金额计算** - 已支付但未结算的订单（扣除手续费后）
4. ✅ **已结算金额计算** - 已结算的订单（扣除手续费后）
5. ✅ **付后结余计算** - 实际应收 - 已结算
6. ✅ **每日财务指标** - 按日期分组的财务数据
7. ✅ **产品表现分析** - 按产品分组的财务数据
8. ✅ **趋势分析** - 时间序列的财务数据

---

### 🔧 修复的问题

1. ✅ **Dashboard Trend API** - 修复了直接使用 `* 0.9` 的问题，改为使用 `calculateMerchantPayout()`
2. ✅ **Dashboard Stats API** - 补全了今天和总计的财务指标（平台费、商家应收）
3. ✅ **Analytics API** - 补全了总平台手续费和总商家应收金额
4. ✅ **创建了财务计算工具函数** - 统一管理所有财务计算逻辑

---

### 📝 使用示例

#### 在 API 中使用财务计算：

```typescript
import { calculatePlatformFee, calculateMerchantPayout } from '@/lib/constants';
import { calculateFinancialSummary } from '@/lib/financial-calculations';

// 单个订单的财务计算
const bookingAmount = 100000;
const platformFee = calculatePlatformFee(bookingAmount); // 10,000
const merchantPayout = calculateMerchantPayout(bookingAmount); // 90,000

// 批量订单的财务汇总
const summary = calculateFinancialSummary(bookings);
// 返回: { totalRevenue, platformFee, merchantPayout, pendingSettlement, settledRevenue, remainingBalance }
```

---

**最后更新**: 2024年

