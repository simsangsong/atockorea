# 客户评价照片数据库结构说明
## Review Photos Database Structure

### ✅ 当前数据库设计

#### `reviews` 表结构

在 `supabase/complete-database-init.sql` 中，`reviews` 表已经包含了照片字段：

```sql
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tour_id UUID REFERENCES tours(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- 评价内容
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  photos JSONB DEFAULT '[]'::jsonb, -- 图片URL数组 ✅ 已存在
  
  -- 状态
  is_verified BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_user_tour_booking_review UNIQUE (user_id, tour_id, booking_id)
);
```

### 📊 数据存储方式

#### 1. 照片 URL 存储在 `reviews.photos` 字段

**格式**: JSONB 数组
```json
[
  "https://xxxxx.supabase.co/storage/v1/object/public/review-photos/user-id/timestamp-xxx.jpg",
  "https://xxxxx.supabase.co/storage/v1/object/public/review-photos/user-id/timestamp-yyy.jpg"
]
```

**优点**:
- ✅ 简单高效，不需要额外的表关联
- ✅ JSONB 支持数组操作和查询
- ✅ 照片与评价数据一起存储，查询方便
- ✅ 适合照片数量较少（通常每个评价1-5张）的场景

#### 2. 照片文件存储在 Supabase Storage

**存储位置**: `review-photos` bucket
**路径格式**: `{user_id}/{timestamp}-{random}.{ext}`

**优点**:
- ✅ 文件存储与数据库分离
- ✅ 支持 CDN 加速
- ✅ 可以设置访问权限
- ✅ 节省数据库空间

### 🔍 为什么不需要单独的照片表？

#### 当前设计的优势

1. **简单性**
   - 照片是评价的一部分，不需要复杂的关联
   - 减少 JOIN 查询，提高性能

2. **灵活性**
   - JSONB 数组可以轻松添加/删除照片
   - 支持照片顺序调整

3. **性能**
   - 一次查询即可获取评价和所有照片
   - 减少数据库查询次数

#### 如果需要单独照片表的场景

只有在以下情况下才需要考虑单独的照片表：

1. **需要照片元数据**
   - 照片标题、描述
   - 照片拍摄时间、地点
   - 照片尺寸、大小

2. **需要照片审核**
   - 照片审核状态
   - 审核人员、审核时间
   - 审核备注

3. **需要照片统计**
   - 照片被查看次数
   - 照片被点赞次数
   - 照片被举报次数

4. **需要照片共享**
   - 照片可以被多个评价使用
   - 照片可以被其他功能使用

### 📝 当前实现示例

#### 插入评价（带照片）

```sql
INSERT INTO reviews (
  user_id,
  tour_id,
  booking_id,
  rating,
  title,
  comment,
  photos,
  is_verified
) VALUES (
  'user-uuid',
  'tour-uuid',
  'booking-uuid',
  5,
  'Great tour!',
  'Had an amazing experience...',
  '["https://xxx.supabase.co/storage/v1/object/public/review-photos/user-id/photo1.jpg", "https://xxx.supabase.co/storage/v1/object/public/review-photos/user-id/photo2.jpg"]'::jsonb,
  true
);
```

#### 查询评价（包含照片）

```sql
SELECT 
  id,
  rating,
  title,
  comment,
  photos,  -- JSONB 数组
  is_verified,
  created_at
FROM reviews
WHERE tour_id = 'tour-uuid'
  AND is_visible = true
ORDER BY created_at DESC;
```

#### 查询有照片的评价

```sql
SELECT *
FROM reviews
WHERE jsonb_array_length(photos) > 0
  AND is_visible = true;
```

### 🔄 如果需要更复杂的照片管理

如果未来需要更复杂的照片管理功能，可以考虑创建 `review_photos` 表：

```sql
CREATE TABLE review_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_order INTEGER DEFAULT 0,  -- 照片顺序
  caption TEXT,  -- 照片说明
  width INTEGER,  -- 照片宽度
  height INTEGER,  -- 照片高度
  file_size INTEGER,  -- 文件大小（字节）
  is_approved BOOLEAN DEFAULT true,  -- 是否审核通过
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT unique_review_photo_order UNIQUE (review_id, photo_order)
);

CREATE INDEX idx_review_photos_review_id ON review_photos(review_id);
```

**但是**，对于当前的需求（简单的照片上传和显示），使用 JSONB 数组已经足够，不需要额外的表。

### ✅ 总结

1. **当前设计是合理的**
   - `reviews.photos` JSONB 字段已存在
   - 照片 URL 存储在数组中
   - 照片文件存储在 Supabase Storage

2. **不需要单独的照片表**
   - 当前需求不需要复杂的照片管理
   - JSONB 数组已经满足需求
   - 性能更好，查询更简单

3. **如果未来需要扩展**
   - 可以创建 `review_photos` 表
   - 可以迁移现有数据
   - 但当前不需要

### 📋 检查清单

- ✅ `reviews` 表存在
- ✅ `reviews.photos` 字段存在（JSONB）
- ✅ API 端点支持照片上传
- ✅ 前端组件支持照片显示
- ⚠️ Supabase Storage `review-photos` bucket 需要手动创建
- ⚠️ Storage 权限策略需要手动设置

---

**结论**: 数据库结构已经完整，不需要创建额外的照片表。照片 URL 存储在 `reviews.photos` JSONB 字段中即可。

