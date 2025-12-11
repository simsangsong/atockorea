# 商家端计算逻辑代码状态检查
## Merchant Calculation Logic Status Check

### ✅ 已实现的财务计算逻辑

#### 1. 平台手续费计算（10%）

**位置**: `lib/constants.ts`

```typescript
export const PLATFORM_COMMISSION_RATE = 0.1; // 10%

export function calculatePlatformFee(amount: number): number {
  return amount * PLATFORM_COMMISSION_RATE;
}

export function calculateMerchantPayout(amount: number): number {
  return amount - calculatePlatformFee(amount);
}
```

**状态**: ✅ 已实现

---

#### 2. Revenue (收入明细) 计算逻辑

**位置**: `app/api/merchant/revenue/route.ts`

**已实现的计算**:
- ✅ 总支付金额 = `SUM(final_price)`
- ✅ 平台手续费 = `calculatePlatformFee(totalRevenue)` (10%)
- ✅ 实际应收金额 = `calculateMerchantPayout(totalRevenue)` (90%)
- ✅ 待结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE payment_status='paid' AND settlement_status='pending'`
- ✅ 已结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE settlement_status='settled'`
- ✅ 付后结余 = `实际应收金额 - 已结算金额`

**状态**: ✅ 已完整实现

---

#### 3. Dashboard 统计计算逻辑

**位置**: `app/api/merchant/dashboard/stats/route.ts`

**已实现的统计**:
- ✅ 今天订单数 = `COUNT(*) WHERE merchant_id = ? AND DATE(booking_date) = TODAY`
- ✅ 待处理订单数 = `COUNT(*) WHERE merchant_id = ? AND status = 'pending'`
- ✅ 总产品数 = `COUNT(*) WHERE merchant_id = ?`
- ✅ 活跃产品数 = `COUNT(*) WHERE merchant_id = ? AND is_active = true`
- ✅ 今天收入 = `SUM(final_price) WHERE merchant_id = ? AND DATE(booking_date) = TODAY`
- ✅ 总收入 = `SUM(final_price) WHERE merchant_id = ?`
- ✅ 待结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE payment_status='paid' AND settlement_status='pending'`
- ✅ 已结算金额 = `SUM(calculateMerchantPayout(amount)) WHERE settlement_status='settled'`
- ✅ 最近订单 = `SELECT * ORDER BY created_at DESC LIMIT 5`

**状态**: ✅ 已完整实现

**前端连接状态**: ⚠️ 需要更新（目前使用 placeholder 数据）

---

#### 4. Analytics (数据分析) 计算逻辑

**位置**: `app/api/merchant/analytics/route.ts`

**已实现的分析**:
- ✅ 总营收 = `SUM(final_price) WHERE merchant_id = ?`
- ✅ 总订单数 = `COUNT(*) WHERE merchant_id = ?`
- ✅ 平均订单金额 = `总营收 / 总订单数`
- ✅ 热门产品 = `GROUP BY tour_id ORDER BY COUNT(*) DESC LIMIT 10`
  - 包含：产品名称、订单数、收入
- ✅ 销售趋势 = `GROUP BY DATE(booking_date) ORDER BY date`
  - 包含：日期、订单数、收入
  - 时间范围：最近30天

**状态**: ✅ 已完整实现

**前端连接状态**: ⚠️ 需要更新（目前使用 placeholder 数据）

---

### 📊 计算逻辑总结

| 计算类型 | API端点 | 状态 | 前端连接 |
|---------|---------|------|---------|
| **平台手续费** | `lib/constants.ts` | ✅ | ✅ |
| **商家应收金额** | `lib/constants.ts` | ✅ | ✅ |
| **Revenue 汇总** | `/api/merchant/revenue` | ✅ | ✅ |
| **Dashboard 统计** | `/api/merchant/dashboard/stats` | ✅ | ⚠️ 需要更新 |
| **Analytics 分析** | `/api/merchant/analytics` | ✅ | ⚠️ 需要更新 |

---

### ⚠️ 需要更新的前端页面

#### 1. Dashboard 页面 (`app/merchant/page.tsx`)

**当前状态**: 使用 placeholder 数据

**需要更新**:
```typescript
// 当前代码（第18-38行）
useEffect(() => {
  const fetchStats = async () => {
    try {
      // TODO: Create API endpoint for merchant dashboard stats
      // For now, use placeholder data
      setStats({
        todayOrders: 5,
        pendingOrders: 3,
        // ... placeholder data
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  fetchStats();
}, []);
```

**应该改为**:
```typescript
useEffect(() => {
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/merchant/dashboard/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data.stats);
      // 处理 recentOrders 如果需要
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };
  fetchStats();
}, []);
```

---

#### 2. Analytics 页面 (`app/merchant/analytics/page.tsx`)

**当前状态**: 使用 placeholder 数据

**需要更新**:
```typescript
// 当前代码（第13-24行）
useEffect(() => {
  // TODO: Fetch analytics from API
  setAnalytics({
    totalRevenue: 12500000,
    totalOrders: 156,
    // ... placeholder data
  });
}, []);
```

**应该改为**:
```typescript
useEffect(() => {
  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/merchant/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };
  fetchAnalytics();
}, []);
```

---

### ✅ 已完整实现的计算逻辑

#### 财务计算
1. ✅ 平台手续费计算（10%）
2. ✅ 商家应收金额计算（90%）
3. ✅ 待结算金额计算
4. ✅ 已结算金额计算
5. ✅ 付后结余计算

#### 统计分析
1. ✅ 订单统计（今天、待处理、总计）
2. ✅ 产品统计（总数、活跃数）
3. ✅ 收入统计（今天、总计）
4. ✅ 结算统计（待结算、已结算）
5. ✅ 平均订单金额计算
6. ✅ 热门产品分析（按订单数和收入）
7. ✅ 销售趋势分析（按日期分组）

---

### 📝 总结

**后端计算逻辑**: ✅ **100% 完成**
- 所有财务计算逻辑已实现
- 所有统计分析逻辑已实现
- 所有API端点已创建并测试

**前端连接**: ⚠️ **部分完成**
- Revenue 页面：✅ 已连接
- Dashboard 页面：⚠️ 需要更新（使用 placeholder）
- Analytics 页面：⚠️ 需要更新（使用 placeholder）

**建议**:
1. 更新 Dashboard 页面连接到 `/api/merchant/dashboard/stats`
2. 更新 Analytics 页面连接到 `/api/merchant/analytics`
3. 添加加载状态和错误处理

---

**最后更新**: 2024年

