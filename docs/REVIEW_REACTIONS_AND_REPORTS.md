# 评价互动和举报功能实现文档
## Review Reactions and Reports Feature Implementation

### ✅ 已实现功能

#### 1. 数据库表结构

##### `review_reactions` 表（评价互动表）
- 存储用户对评价的点赞和不推荐
- 字段：
  - `id`: UUID 主键
  - `review_id`: 评价ID（外键）
  - `user_id`: 用户ID（外键）
  - `reaction_type`: 反应类型（'like' 或 'dislike'）
  - `created_at`, `updated_at`: 时间戳

##### `review_reports` 表（评价举报表）
- 存储用户对评价的举报
- 字段：
  - `id`: UUID 主键
  - `review_id`: 评价ID（外键）
  - `reporter_id`: 举报人ID（外键）
  - `reason`: 举报原因（'spam', 'inappropriate', 'fake', 'harassment', 'other'）
  - `description`: 举报详情
  - `status`: 举报状态（'pending', 'reviewing', 'resolved', 'dismissed'）
  - `handled_by`: 处理人ID（管理员）
  - `handled_at`: 处理时间
  - `handling_notes`: 处理备注

##### `reviews` 表更新
- 新增字段：
  - `is_anonymous`: 是否匿名（BOOLEAN）
  - `like_count`: 点赞数（INTEGER）
  - `dislike_count`: 不推荐数（INTEGER）

##### 自动更新触发器
- `update_review_reaction_counts()`: 自动更新评价的点赞/不推荐数量

##### 视图
- `review_reports_summary`: 举报统计视图（用于总台dashboard）

#### 2. API 端点

##### POST `/api/reviews/reactions`
- 创建或更新评价反应（点赞/不推荐）
- 支持切换反应类型
- 支持取消反应

##### GET `/api/reviews/reactions?reviewId=xxx&userId=xxx`
- 获取评价反应统计
- 可选：获取特定用户的反应

##### POST `/api/reviews/reports`
- 创建评价举报
- 验证是否已举报过

##### GET `/api/reviews/reports`
- 获取举报列表（仅管理员）
- 支持状态筛选
- 支持分页

##### PATCH `/api/reviews/reports/[id]`
- 更新举报状态（仅管理员）
- 支持添加处理备注

#### 3. 前端组件更新

##### `ReviewForm` 组件
- 新增匿名选项复选框
- 提交时包含 `isAnonymous` 字段

##### `ReviewList` 组件
- 新增反应按钮（点赞、不推荐、举报）
- 新增排序选项："最受欢迎"（按点赞量）
- 显示匿名用户标识
- 实时更新反应数量

##### `AdminReportsPage` 组件（新）
- 总台举报管理页面
- 显示举报统计
- 支持状态筛选
- 支持处理举报
- 显示处理历史

#### 4. 排序逻辑更新

评价排序选项：
- **最新**：按创建时间降序
- **评分最高**：按评分降序
- **评分最低**：按评分升序
- **最受欢迎**：按点赞量降序（新增）
- **有照片优先**：有照片的评价优先显示

### 📋 使用说明

#### 1. 执行数据库迁移

在 Supabase SQL Editor 中执行：

```sql
-- 执行 supabase/review-reactions-schema.sql
```

这将创建：
- `review_reactions` 表
- `review_reports` 表
- 更新 `reviews` 表（添加新字段）
- 创建触发器和视图
- 设置 RLS 策略

#### 2. 功能使用

##### 用户端
1. **写评价**
   - 可以选择"匿名填写"
   - 匿名评价不显示用户姓名和头像

2. **互动评价**
   - 点击"点赞"按钮
   - 点击"不推荐"按钮
   - 可以切换反应类型
   - 再次点击可以取消反应

3. **举报评价**
   - 点击"举报"按钮
   - 选择举报原因
   - 填写举报说明（可选）

##### 管理员端
1. **查看举报**
   - 访问 `/admin/reports`
   - 查看所有举报列表
   - 查看举报统计

2. **处理举报**
   - 点击"开始审核"
   - 添加处理备注
   - 更新举报状态
   - 完成处理或驳回

### 🔒 权限控制

#### RLS 策略

##### `review_reactions`
- ✅ 用户可以查看所有反应
- ✅ 用户只能创建/更新/删除自己的反应

##### `review_reports`
- ✅ 用户可以创建举报
- ✅ 用户可以查看自己的举报
- ✅ 管理员可以查看所有举报
- ✅ 管理员可以更新举报状态

### 📊 数据统计

#### 举报统计视图

`review_reports_summary` 视图提供：
- `pending_count`: 待处理数量
- `reviewing_count`: 审核中数量
- `resolved_count`: 已处理数量
- `dismissed_count`: 已驳回数量
- `total_count`: 总数量
- `last_24h_count`: 最近24小时数量
- `last_7d_count`: 最近7天数量

### 🎨 UI/UX 特性

1. **反应按钮**
   - 点赞按钮：蓝色高亮（已点赞时）
   - 不推荐按钮：红色高亮（已不推荐时）
   - 显示反应数量

2. **举报按钮**
   - 灰色按钮，点击后弹出选择对话框
   - 支持选择举报原因
   - 支持填写举报说明

3. **匿名标识**
   - 匿名评价显示"匿名用户"
   - 不显示头像

4. **排序选项**
   - "最受欢迎"选项按点赞量排序
   - 实时更新排序结果

### 🔄 数据流程

#### 点赞/不推荐流程
1. 用户点击反应按钮
2. 前端调用 `/api/reviews/reactions`
3. 后端检查是否已有反应
4. 如果有相同反应，则删除（取消）
5. 如果有不同反应，则更新
6. 如果没有反应，则创建
7. 触发器自动更新 `like_count` 和 `dislike_count`
8. 前端刷新反应数据

#### 举报流程
1. 用户点击举报按钮
2. 选择举报原因
3. 填写举报说明（可选）
4. 前端调用 `/api/reviews/reports`
5. 后端创建举报记录（状态：pending）
6. 管理员在总台查看举报
7. 管理员处理举报（更新状态）
8. 可选：自动隐藏被举报的评价

### ✅ 完成状态

- ✅ 数据库表结构创建
- ✅ API 端点实现
- ✅ 前端组件更新
- ✅ 总台管理页面
- ✅ 排序逻辑更新
- ✅ RLS 策略设置
- ✅ 触发器自动更新统计

### 📝 注意事项

1. **数据库迁移**
   - 必须先执行 `review-reactions-schema.sql`
   - 确保 RLS 策略正确设置

2. **权限验证**
   - 举报管理页面需要管理员权限
   - 确保 `requireAdmin` 函数正常工作

3. **用户体验**
   - 反应按钮应该有加载状态
   - 举报应该有确认提示
   - 匿名评价应该明确标识

---

**最后更新**: 2024年

