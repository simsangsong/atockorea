# 接送点选择器设置指南

## 📋 功能说明

在预订流程中，客人可以：
1. **选择预设接送点** - 从商家提供的预设地点中选择
2. **在地图上标注自定义接送点** - 使用 Google Maps 在地图上点击选择或搜索地点

---

## ✅ 已完成的功能

### 1. 创建了 `PickupPointSelector` 组件
- **位置**: `components/maps/PickupPointSelector.tsx`
- **功能**:
  - 交互式 Google Maps 地图
  - 点击地图选择位置
  - 拖拽标记调整位置
  - 地点搜索（自动完成）
  - 自动反向地理编码（坐标转地址）
  - 显示选中位置的地址和坐标

### 2. 更新了 `BookingSidebar` 组件
- **位置**: `components/tour/BookingSidebar.tsx`
- **新增功能**:
  - 两个选项按钮：`选择预设地点` 和 `在地图上标注`
  - 根据选择显示不同的界面
  - 保存自定义接送点信息

---

## 🚀 使用方法

### 在预订侧边栏中

当客人点击"在地图上标注"按钮时，会显示：

1. **搜索框** - 可以搜索地点（限制为韩国）
2. **交互式地图** - 可以：
   - 点击地图选择位置
   - 拖拽标记调整位置
   - 搜索地点后自动定位
3. **选中位置信息** - 显示：
   - 完整地址
   - 坐标（纬度、经度）

### 数据格式

自定义接送点数据格式：
```typescript
{
  lat: number;        // 纬度
  lng: number;        // 经度
  address: string;    // 完整地址
}
```

---

## 🔧 配置要求

### 必需的环境变量

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的API_KEY
```

### 需要启用的 Google Maps API

1. **Maps JavaScript API** - 显示地图
2. **Places API** - 地点搜索和自动完成
3. **Geocoding API** - 地址和坐标转换

**详细设置步骤**: 查看 `docs/GOOGLE_MAPS_API_SETUP.md`

---

## 💻 代码示例

### 在预订组件中使用

```typescript
import PickupPointSelector from '@/components/maps/PickupPointSelector';

// 在组件中
const [customPickup, setCustomPickup] = useState<{
  lat: number;
  lng: number;
  address: string;
} | null>(null);

<PickupPointSelector
  onLocationSelect={(location) => {
    setCustomPickup(location);
    // location 包含: { lat, lng, address }
  }}
  height="300px"
/>
```

### 提交预订时使用

```typescript
const handleBooking = () => {
  const pickupInfo = pickupType === 'preset' 
    ? tour.pickupPoints.find((p) => p.id === selectedPickup)
    : customPickup;
  
  // 提交到后端
  fetch('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      tour_id: tour.id,
      date: selectedDate,
      guests: guestCount,
      pickup_location: pickupInfo, // 包含 lat, lng, address
    }),
  });
};
```

---

## 🎨 UI 特性

### 预设地点模式
- 下拉选择框
- 显示选中地点的名称和地址

### 自定义地点模式
- 搜索框（支持自动完成）
- 交互式地图
- 可拖拽标记
- 实时地址显示
- 坐标信息

---

## 📱 响应式设计

- **桌面端**: 完整地图显示（高度 300-400px）
- **移动端**: 自适应高度，触摸友好

---

## 🔍 功能细节

### 地点搜索
- 限制为韩国地点（`country: 'kr'`）
- 支持场所和地理编码类型
- 自动完成功能

### 地图交互
- 点击地图 → 选择位置
- 拖拽标记 → 调整位置
- 自动反向地理编码 → 获取地址

### 数据验证
- 确保选择了日期
- 确保选择了接送点（预设或自定义）
- 按钮禁用状态管理

---

## 🐛 故障排除

### 问题 1：地图不显示

**原因**: API Key 未配置

**解决**:
1. 检查 `.env.local` 中的 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
2. 确认 Vercel 环境变量已设置
3. 重新部署

### 问题 2：搜索不工作

**原因**: Places API 未启用

**解决**:
1. 在 Google Cloud Console 启用 Places API
2. 确认 API Key 限制中包含 Places API

### 问题 3：无法获取地址

**原因**: Geocoding API 未启用

**解决**:
1. 在 Google Cloud Console 启用 Geocoding API
2. 确认 API Key 限制中包含 Geocoding API

---

## 📚 相关文档

- `docs/GOOGLE_MAPS_API_SETUP.md` - Google Maps API 完整设置
- `docs/GOOGLE_MAPS_QUICK_START.md` - 快速开始指南

---

## ✅ 完成检查清单

- [ ] Google Maps API Key 已配置
- [ ] Maps JavaScript API 已启用
- [ ] Places API 已启用
- [ ] Geocoding API 已启用
- [ ] `PickupPointSelector` 组件已创建
- [ ] `BookingSidebar` 组件已更新
- [ ] 测试地图显示正常
- [ ] 测试地点搜索功能
- [ ] 测试点击选择位置
- [ ] 测试拖拽标记功能

---

**完成！** 现在客人可以在预订时在地图上标注自己的接送点了。🎉

