# 旅游产品详细内容字段说明
## Tour Detail Fields Documentation

### 📋 概述

本文档详细说明旅游产品详细内容页所需的所有字段，包括横幅图片、旅游图片、FAQ、旅游详情等。

---

## 🖼️ 图片相关字段

### 1. image_url (主图片/封面图)
- **类型**: `TEXT`
- **说明**: 产品列表页和卡片显示的主图片
- **示例**: `"https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80"`

### 2. banner_image (横幅图片)
- **类型**: `TEXT`
- **说明**: 详细页顶部的大横幅图片（可选）
- **用途**: 如果为空，则使用 `image_url` 作为横幅图
- **示例**: `"https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80"`

### 3. images (简单图片数组)
- **类型**: `JSONB`
- **说明**: 简单的图片URL数组
- **格式**: `["url1", "url2", "url3"]`
- **示例**:
```json
[
  "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80",
  "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200&q=80"
]
```

### 4. gallery_images (画廊图片数组)
- **类型**: `JSONB`
- **说明**: 带标题和描述的完整图片对象数组
- **格式**: `[{"url": "...", "title": "...", "description": "..."}, ...]`
- **示例**:
```json
[
  {
    "url": "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80",
    "title": "Hamdeok Beach",
    "description": "One of Jeju's top three beaches, famous for its dazzling ocean colors."
  },
  {
    "url": "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1200&q=80",
    "title": "Seongsan Ilchulbong",
    "description": "A UNESCO World Natural Heritage Site, this iconic volcanic tuff cone offers spectacular views."
  }
]
```

---

## 📝 产品详情字段

### 5. description (描述)
- **类型**: `TEXT`
- **说明**: 产品详细描述
- **示例**: `"Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island."`

### 6. subtitle (副标题)
- **类型**: `TEXT`
- **说明**: 产品副标题/标语
- **示例**: `"Top rated · 4 pickup locations"`

### 7. highlight (主要亮点)
- **类型**: `TEXT`
- **说明**: 单行主要亮点
- **示例**: `"UNESCO World Heritage Sites"`

### 8. highlights (亮点数组)
- **类型**: `JSONB`
- **说明**: 多个亮点列表
- **格式**: `["亮点1", "亮点2", "亮点3"]`
- **示例**:
```json
[
  "UNESCO World Heritage Sites",
  "Professional English-speaking guide",
  "Free cancellation up to 24 hours"
]
```

### 9. badges (徽章数组)
- **类型**: `JSONB`
- **说明**: 产品徽章/标签
- **格式**: `["徽章1", "徽章2"]`
- **示例**:
```json
["Top rated", "Best seller", "New"]
```

---

## 📅 行程相关字段

### 10. schedule (详细行程安排)
- **类型**: `JSONB`
- **说明**: 带时间的详细行程安排
- **格式**: `[{"time": "...", "title": "...", "description": "...", "icon": "..."}, ...]`
- **示例**:
```json
[
  {
    "time": "08:30",
    "title": "Pickup - Ocean Suites Jeju Hotel",
    "description": "Pickup from Ocean Suites Jeju Hotel",
    "icon": "🚗"
  },
  {
    "time": "10:25",
    "title": "Hamdeok Beach",
    "description": "Break time, Photo stop, Guided tour, Free time, Sightseeing, Walk, Scenic views (1 hour)",
    "icon": "🏖️"
  }
]
```

### 11. itinerary (行程地点数组)
- **类型**: `JSONB`
- **说明**: 简化的行程地点列表（仅地点名称）
- **格式**: `["地点1", "地点2", "地点3"]`
- **示例**:
```json
[
  "Hamdeok Beach",
  "Haenyeo Museum",
  "Seongsan Ilchulbong",
  "Ilchul Land",
  "Seongeup Folk Village"
]
```

---

## ✅ 包含/不包含内容

### 12. includes (包含内容)
- **类型**: `JSONB`
- **说明**: 包含的内容列表
- **格式**: `["内容1", "内容2"]`
- **示例**:
```json
[
  "Admission to all admission fees",
  "English-speaking professional guide",
  "A vehicle (Van or Bus) & Driver",
  "Toll fees",
  "Parking fees"
]
```

### 13. excludes (不包含内容)
- **类型**: `JSONB`
- **说明**: 不包含的内容列表
- **格式**: `["内容1", "内容2"]`
- **示例**:
```json
[
  "Lunch (food) Fees",
  "Personal expenses",
  "Tips or additional fees",
  "Personal travel insurance"
]
```

---

## ❓ FAQ (常见问题)

### 14. faqs (常见问题)
- **类型**: `JSONB`
- **说明**: 常见问题列表
- **格式**: `[{"question": "...", "answer": "..."}, ...]`
- **示例**:
```json
[
  {
    "question": "What is the pickup time and location?",
    "answer": "Pickup usually starts around 08:30–09:00 from Jeju City meeting points or your hotel (if included). Exact time and location will be confirmed in the confirmation email after booking."
  },
  {
    "question": "Is lunch included?",
    "answer": "Lunch is not included. The guide will recommend local restaurants where you can choose and pay on the spot."
  },
  {
    "question": "Can I join with a suitcase or luggage?",
    "answer": "Yes, small and medium-size luggage can be stored in the vehicle. For very large luggage, please inform us in advance so we can prepare enough space."
  }
]
```

---

## 📋 旅游详情 (Tour Details)

### 15. tour_details (完整旅游详情对象)
- **类型**: `JSONB`
- **说明**: 存储完整的旅游详情信息
- **格式**: `{...}`
- **示例**:
```json
{
  "tagline": "Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island.",
  "quickFacts": [
    "Free cancellation up to 24 hours in advance for a full refund",
    "Reserve now & pay later - Keep your travel plans flexible",
    "All admission fees included in one booking",
    "Professional English-speaking guide included",
    "4 convenient pickup locations across Jeju City"
  ],
  "meetingPoints": [
    {
      "name": "Ocean Suites Jeju Hotel",
      "address": "Ocean Suites Jeju Hotel, Jeju",
      "time": "08:30"
    }
  ],
  "cancellationPolicy": "Free cancellation up to 24 hours in advance for a full refund",
  "importantNotes": "For safety reasons, outdoor activities may be cancelled or replaced with alternative spots depending on weather conditions."
}
```

---

## 📊 完整示例

### 完整的 tours 表记录示例：

```json
{
  "id": "uuid",
  "title": "Jeju: Eastern Jeju UNESCO Spots Day Tour",
  "slug": "jeju-eastern-unesco-spots-day-tour",
  "subtitle": "Top rated · 4 pickup locations",
  "description": "Explore UNESCO sites and experience history, culture, and the nature of the Eastern and Northern parts of Jeju Island.",
  "image_url": "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
  "banner_image": "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80",
  "gallery_images": [
    {
      "url": "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1200&q=80",
      "title": "Hamdeok Beach",
      "description": "One of Jeju's top three beaches"
    }
  ],
  "schedule": [
    {
      "time": "08:30",
      "title": "Pickup",
      "description": "Pickup from hotel",
      "icon": "🚗"
    }
  ],
  "itinerary": ["Hamdeok Beach", "Haenyeo Museum"],
  "highlights": ["UNESCO Sites", "Professional Guide"],
  "includes": ["Admission fees", "Guide"],
  "excludes": ["Lunch", "Personal expenses"],
  "faqs": [
    {
      "question": "What is the pickup time?",
      "answer": "Pickup starts at 08:30"
    }
  ],
  "tour_details": {
    "tagline": "Explore UNESCO sites...",
    "quickFacts": ["Free cancellation", "Reserve now & pay later"]
  }
}
```

---

## 🔍 字段使用场景

### 列表页使用：
- `image_url` - 卡片图片
- `title` - 标题
- `subtitle` - 副标题
- `price` - 价格

### 详细页使用：
- `banner_image` 或 `image_url` - 顶部横幅
- `gallery_images` - 图片画廊
- `description` - 产品描述
- `schedule` - 详细行程
- `itinerary` - 行程地点
- `highlights` - 亮点
- `includes` / `excludes` - 包含/不包含
- `faqs` - 常见问题
- `tour_details` - 其他详情

---

**最后更新**: 2024年

