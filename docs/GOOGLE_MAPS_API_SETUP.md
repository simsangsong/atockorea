# Google Maps API 设置指南

## 📋 概述

本指南将帮助你在 AtoCKorea 项目中集成 Google Maps API，用于显示交互式地图、地点搜索和路线规划。

---

## 🔑 步骤 1：获取 Google Maps API Key

### 1.1 访问 Google Cloud Console

1. **访问 Google Cloud Console**
   - 网址：https://console.cloud.google.com/
   - 使用你的 Google 账户登录

2. **创建或选择项目**
   - 点击顶部项目选择器
   - 点击 "New Project" 创建新项目
   - 或选择现有项目
   - 项目名称：`AtoCKorea` 或你喜欢的名称

### 1.2 启用 Google Maps API

1. **进入 API Library**
   - 左侧菜单 → **APIs & Services** → **Library**

2. **启用必要的 API**
   需要启用以下 API：
   - ✅ **Maps JavaScript API** - 用于显示交互式地图
   - ✅ **Places API** - 用于地点搜索和自动完成
   - ✅ **Geocoding API** - 用于地址和坐标转换
   - ✅ **Directions API** - 用于路线规划（可选）

3. **搜索并启用**
   - 在搜索框中输入 "Maps JavaScript API"
   - 点击进入详情页
   - 点击 **"Enable"** 按钮
   - 重复此步骤启用其他 API

### 1.3 创建 API Key

1. **进入 Credentials**
   - 左侧菜单 → **APIs & Services** → **Credentials**

2. **创建 API Key**
   - 点击顶部 **"+ CREATE CREDENTIALS"**
   - 选择 **"API key"**
   - 系统会生成一个 API Key

3. **限制 API Key（重要！）**
   - 点击刚创建的 API Key 进行编辑
   - **Application restrictions**：
     - 选择 **"HTTP referrers (web sites)"**
     - 添加以下网站：
       - `http://localhost:3000/*`（开发环境）
       - `https://atockorea.com/*`（生产环境）
       - `https://*.vercel.app/*`（Vercel 预览）
   - **API restrictions**：
     - 选择 **"Restrict key"**
     - 勾选以下 API：
       - Maps JavaScript API
       - Places API
       - Geocoding API
       - Directions API（如果使用）
   - 点击 **"Save"**

4. **复制 API Key**
   - 复制生成的 API Key（格式：`AIza...`）
   - **重要：** 保存好这个 Key，稍后会用到

---

## 📦 步骤 2：安装依赖包

在项目根目录运行：

```bash
npm install @react-google-maps/api
```

或者使用 TypeScript 类型定义：

```bash
npm install @react-google-maps/api @types/google.maps
```

---

## 🔧 步骤 3：配置环境变量

### 3.1 本地开发环境

在 `.env.local` 文件中添加：

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=你的API_KEY
```

### 3.2 Vercel 生产环境

1. **进入 Vercel Dashboard**
   - 访问：https://vercel.com/dashboard
   - 选择你的项目

2. **添加环境变量**
   - 进入 **Settings** → **Environment Variables**
   - 点击 **"Add New"**
   - **Name**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - **Value**: 你的 Google Maps API Key
   - **Environment**: 选择 **Production, Preview, Development**
   - 点击 **"Save"**

3. **重新部署**
   - 环境变量添加后，需要重新部署才能生效
   - 可以手动触发部署或等待下次 Git push

---

## 💻 步骤 4：创建地图组件

### 4.1 创建 Google Maps 加载器

创建 `lib/google-maps.ts`：

```typescript
import { Loader } from '@react-google-maps/api';

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ['places'];

export const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

export const center = {
  lat: 37.5665, // Seoul default
  lng: 126.9780,
};

export const options = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
};

export { libraries };
```

### 4.2 创建交互式地图组件

创建 `components/maps/InteractiveMap.tsx`：

```typescript
'use client';

import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { useState, useCallback } from 'react';

interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

interface InteractiveMapProps {
  locations: Location[];
  center?: Location;
  zoom?: number;
  height?: string;
  onLocationClick?: (location: Location) => void;
}

export default function InteractiveMap({
  locations,
  center = { lat: 37.5665, lng: 126.9780 },
  zoom = 13,
  height = '400px',
  onLocationClick,
}: InteractiveMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="w-full bg-gray-200 rounded-lg flex items-center justify-center" style={{ height }}>
        <p className="text-gray-500">Google Maps API key not configured</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-lg overflow-hidden" style={{ height }}>
      <LoadScript
        googleMapsApiKey={apiKey}
        libraries={['places']}
      >
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={zoom}
          onLoad={onLoad}
          onUnmount={onUnmount}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {locations.map((location, index) => (
            <Marker
              key={index}
              position={location}
              title={location.name}
              onClick={() => onLocationClick?.(location)}
            />
          ))}
        </GoogleMap>
      </LoadScript>
    </div>
  );
}
```

### 4.3 创建地点搜索组件

创建 `components/maps/PlaceSearch.tsx`：

```typescript
'use client';

import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import { useRef, useState } from 'react';

interface PlaceSearchProps {
  onPlaceSelect: (place: google.maps.places.PlaceResult) => void;
  placeholder?: string;
  className?: string;
}

export default function PlaceSearch({
  onPlaceSelect,
  placeholder = 'Search for a location...',
  className = '',
}: PlaceSearchProps) {
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: ['places'],
  });

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAutocomplete(autocomplete);
  };

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place) {
        onPlaceSelect(place);
      }
    }
  };

  if (!isLoaded) {
    return (
      <input
        type="text"
        placeholder="Loading..."
        className={className}
        disabled
      />
    );
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'kr' }, // 限制为韩国
      }}
    >
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        className={className}
      />
    </Autocomplete>
  );
}
```

---

## 🔄 步骤 5：更新现有组件

### 5.1 更新 MeetingPoint 组件

更新 `components/tour/MeetingPoint.tsx` 以使用交互式地图：

```typescript
// 在文件顶部添加
import InteractiveMap from '@/components/maps/InteractiveMap';

// 替换 iframe 部分
<InteractiveMap
  locations={points.map(p => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name,
    address: p.address,
  }))}
  center={{ lat: primaryPoint.lat, lng: primaryPoint.lng }}
  zoom={15}
  height="400px"
/>
```

---

## 📝 步骤 6：使用示例

### 示例 1：显示单个地点

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
  height="500px"
/>
```

### 示例 2：显示多个接送点

```typescript
<InteractiveMap
  locations={pickupPoints.map(point => ({
    lat: point.lat,
    lng: point.lng,
    name: point.name,
    address: point.address,
  }))}
  center={{ lat: 37.5665, lng: 126.9780 }}
  zoom={12}
  height="400px"
  onLocationClick={(location) => {
    console.log('Clicked:', location);
  }}
/>
```

### 示例 3：地点搜索

```typescript
import PlaceSearch from '@/components/maps/PlaceSearch';

<PlaceSearch
  onPlaceSelect={(place) => {
    console.log('Selected place:', place);
    // 处理选中的地点
  }}
  placeholder="Search for pickup location..."
  className="w-full px-4 py-2 border rounded-lg"
/>
```

---

## 💰 费用说明

### Google Maps API 定价

- **免费额度**：每月 $200 免费额度
- **Maps JavaScript API**：每 1000 次加载 $7
- **Places API**：每 1000 次请求 $17-32（根据类型）
- **Geocoding API**：每 1000 次请求 $5

### 免费额度覆盖范围

- 约 **28,000 次** Maps JavaScript API 加载
- 约 **11,000 次** Places API 请求
- 约 **40,000 次** Geocoding API 请求

**对于中小型网站，免费额度通常足够使用。**

---

## 🔒 安全建议

1. **限制 API Key**
   - ✅ 只允许特定域名使用
   - ✅ 只启用必要的 API
   - ✅ 定期轮换 API Key

2. **监控使用量**
   - 在 Google Cloud Console 中设置使用量警报
   - 设置预算限制防止意外费用

3. **不要提交 API Key 到 Git**
   - ✅ 使用环境变量
   - ✅ 添加到 `.gitignore`

---

## 🐛 故障排除

### 问题 1：地图不显示

**可能原因：**
- API Key 未配置
- API 未启用
- 域名限制阻止了请求

**解决方法：**
1. 检查环境变量是否正确设置
2. 确认 Google Cloud Console 中 API 已启用
3. 检查 API Key 的域名限制设置

### 问题 2：地点搜索不工作

**可能原因：**
- Places API 未启用
- API Key 未包含 Places API

**解决方法：**
1. 在 Google Cloud Console 启用 Places API
2. 确认 API Key 限制中包含 Places API

### 问题 3：控制台错误 "RefererNotAllowedMapError"

**原因：** 当前域名不在 API Key 的允许列表中

**解决方法：**
1. 进入 Google Cloud Console → Credentials
2. 编辑 API Key
3. 在 "HTTP referrers" 中添加当前域名

---

## 📚 相关文档

- [Google Maps JavaScript API 文档](https://developers.google.com/maps/documentation/javascript)
- [React Google Maps API 文档](https://react-google-maps-api-docs.netlify.app/)
- [Google Cloud Console](https://console.cloud.google.com/)

---

## ✅ 完成检查清单

- [ ] Google Cloud Console 项目已创建
- [ ] Maps JavaScript API 已启用
- [ ] Places API 已启用（如需要）
- [ ] Geocoding API 已启用（如需要）
- [ ] API Key 已创建并限制
- [ ] 依赖包已安装
- [ ] 环境变量已配置（本地和 Vercel）
- [ ] 地图组件已创建
- [ ] 现有组件已更新
- [ ] 测试地图显示正常

---

**完成！** 现在你可以在项目中使用 Google Maps API 了。🎉

