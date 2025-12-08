# Google Maps API 快速开始指南

## 🚀 5 分钟快速设置

### 步骤 1：获取 API Key（2 分钟）

1. 访问：https://console.cloud.google.com/
2. 创建或选择项目
3. 启用 **Maps JavaScript API** 和 **Places API**
4. 创建 API Key
5. 复制 API Key

### 步骤 2：配置环境变量（1 分钟）

**本地开发** (`.env.local`):
```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的API_KEY
```

**Vercel 生产环境**:
1. Vercel Dashboard → Settings → Environment Variables
2. 添加 `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
3. 重新部署

### 步骤 3：使用组件（2 分钟）

#### 显示交互式地图

```typescript
import InteractiveMap from '@/components/maps/InteractiveMap';

<InteractiveMap
  locations={[{
    lat: 37.5665,
    lng: 126.9780,
    name: 'Seoul City Hall',
    address: 'Seoul, South Korea',
  }]}
  center={{ lat: 37.5665, lng: 126.9780 }}
  zoom={15}
  height="400px"
/>
```

#### 地点搜索

```typescript
import PlaceSearch from '@/components/maps/PlaceSearch';

<PlaceSearch
  onPlaceSelect={(place) => {
    console.log('Selected:', place);
  }}
  placeholder="搜索地点..."
  className="w-full px-4 py-2 border rounded-lg"
/>
```

---

## ✅ 完成！

现在你的地图已经可以使用了。如果没有配置 API Key，系统会自动回退到静态 iframe 地图。

详细文档请查看：`docs/GOOGLE_MAPS_API_SETUP.md`

