# 客户评价照片功能实现文档
## Review Photos Feature Implementation

### ✅ 已实现功能

#### 1. 数据库支持
- ✅ `reviews` 表已有 `photos JSONB DEFAULT '[]'::jsonb` 字段
- ✅ 支持存储多个照片 URL

#### 2. API 端点

##### GET `/api/reviews?tourId=xxx`
- 获取指定旅游产品的所有评价
- 返回包含照片数组的评价数据
- 包含用户信息（姓名、头像）

##### POST `/api/reviews`
- 创建新评价
- 支持上传照片（通过照片 URL 数组）
- 自动验证购买（如果有 bookingId）
- 自动更新旅游产品的评分和评价数量

##### POST `/api/reviews/upload`
- 上传评价照片到 Supabase Storage
- 支持多文件上传（最多5张）
- 文件类型验证（仅图片）
- 文件大小限制（最大5MB）
- 返回上传后的照片 URL 数组

#### 3. 前端组件

##### `components/reviews/ReviewForm.tsx`
- 评价表单组件
- 支持评分选择（1-5星）
- 支持标题和内容输入
- 支持照片上传（最多5张）
- 照片预览功能
- 照片删除功能

##### `components/reviews/ReviewList.tsx`
- 评价列表组件
- 显示所有评价
- 支持排序（最新、评分最高、评分最低、有照片优先）
- 显示评价照片（网格布局）
- 照片点击放大查看
- 显示已验证购买标识
- 显示有照片标识

#### 4. 详细页面集成

##### `app/tour/[id]/page.tsx`
- 集成评价列表和评价表单
- 从数据库获取旅游产品数据
- 从数据库获取评价数据
- 支持写评价功能
- 自动检查用户是否有已完成订单

##### `app/tour/[id]/reviews/page.tsx`
- 独立的评价页面
- 完整的评价功能

### 📋 使用说明

#### 1. Supabase Storage 设置

需要在 Supabase Dashboard 中创建存储桶：

1. 进入 Supabase Dashboard
2. 点击左侧菜单 **Storage**
3. 点击 **Create bucket**
4. 设置：
   - **Name**: `review-photos`
   - **Public bucket**: ✅ 勾选（允许公开访问）
   - **File size limit**: 5MB
   - **Allowed MIME types**: `image/*`

#### 2. Storage 权限设置

在 Supabase Dashboard 中设置 Storage 策略：

```sql
-- 允许认证用户上传照片
CREATE POLICY "Users can upload review photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'review-photos');

-- 允许所有人查看照片
CREATE POLICY "Anyone can view review photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'review-photos');
```

#### 3. 环境变量

确保 `.env.local` 中包含：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_Supabase_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_anon_key
SUPABASE_SERVICE_ROLE_KEY=你的_service_role_key
```

### 🔧 技术实现细节

#### 照片上传流程

1. 用户选择照片文件
2. 前端调用 `/api/reviews/upload` 上传到 Supabase Storage
3. 返回照片 URL 数组
4. 用户填写评价表单
5. 提交评价时，将照片 URL 数组一起发送到 `/api/reviews`
6. 后端保存评价和照片 URL 到数据库

#### 照片显示流程

1. 从数据库获取评价数据（包含 photos 数组）
2. 在 `ReviewList` 组件中显示照片网格
3. 点击照片可以放大查看
4. 支持显示多张照片（最多显示4张，超过显示 "+N"）

### 📝 数据库字段说明

#### `reviews` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | UUID | 主键 |
| `user_id` | UUID | 用户ID |
| `tour_id` | UUID | 旅游产品ID |
| `booking_id` | UUID | 订单ID（可选） |
| `rating` | INTEGER | 评分（1-5） |
| `title` | TEXT | 评价标题（可选） |
| `comment` | TEXT | 评价内容 |
| `photos` | JSONB | 照片URL数组 `["url1", "url2", ...]` |
| `is_verified` | BOOLEAN | 是否已验证购买 |
| `is_visible` | BOOLEAN | 是否可见 |
| `created_at` | TIMESTAMP | 创建时间 |
| `updated_at` | TIMESTAMP | 更新时间 |

### 🎨 UI/UX 特性

1. **照片上传**
   - 拖拽或点击选择照片
   - 实时预览
   - 可以删除已选照片
   - 最多5张限制

2. **照片显示**
   - 网格布局（响应式）
   - 点击放大查看
   - 显示照片数量标识
   - 有照片的评价优先显示

3. **评价排序**
   - 最新评价优先
   - 评分最高优先
   - 评分最低优先
   - 有照片优先

### 🔒 安全特性

1. **文件验证**
   - 仅允许图片文件
   - 文件大小限制（5MB）
   - 文件数量限制（5张）

2. **权限控制**
   - 仅认证用户可上传照片
   - 仅认证用户可写评价
   - 已验证购买的评价显示标识

3. **数据验证**
   - 评分范围验证（1-5）
   - 必填字段验证
   - 重复评价检查

### 📊 性能优化

1. **图片优化**
   - 使用 Next.js Image 组件
   - 懒加载
   - 响应式图片

2. **数据加载**
   - 分页加载（未来可扩展）
   - 按需加载照片
   - 缓存评价数据

### 🚀 未来扩展

1. **照片编辑**
   - 裁剪功能
   - 滤镜功能
   - 压缩优化

2. **照片管理**
   - 删除照片
   - 替换照片
   - 照片排序

3. **社交功能**
   - 点赞评价
   - 回复评价
   - 分享评价

### ✅ 完成状态

- ✅ 数据库字段支持
- ✅ API 端点实现
- ✅ 照片上传功能
- ✅ 照片显示功能
- ✅ 评价表单集成
- ✅ 详细页面集成
- ⚠️ Supabase Storage 设置（需要手动配置）
- ⚠️ Storage 权限设置（需要手动配置）

### 📝 注意事项

1. **Supabase Storage 设置**
   - 必须手动创建 `review-photos` 存储桶
   - 必须设置公开访问权限
   - 必须设置上传权限策略

2. **环境变量**
   - 确保所有必要的环境变量已配置
   - 确保 Supabase 客户端正确初始化

3. **错误处理**
   - 上传失败时显示错误提示
   - 网络错误时提供重试机制
   - 文件过大时提示用户

---

**最后更新**: 2024年

