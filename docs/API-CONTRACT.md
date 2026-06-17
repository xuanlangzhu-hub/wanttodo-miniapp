# API 接口约定 v0.4

> **状态：已确认** | 微信小程序前端（Codex）↔ ASP.NET 后端（DeepSeek）

---

## 1. 通用约定

| 项目 | 约定 |
|------|------|
| 本地开发 | `http://localhost:5000/api/v1` |
| 真机调试 | 局域网 IP 或内网穿透，`config.js` 中切换 |
| 正式部署 | `https://<你的域名>/api/v1`（待部署时确认） |
| 请求格式 | `application/json; charset=utf-8` |
| 鉴权方式 | Header `Authorization: Bearer <token>` |
| 时间格式 | ISO 8601（`2026-06-16T15:30:00+08:00`） |

### 1.1 响应格式

成功和失败共用同一结构：

```json
{
  "code": 200,
  "message": "可选提示信息",
  "data": {}
}
```

| 字段 | 说明 |
|------|------|
| code | 业务状态码，与 HTTP 状态码保持一致 |
| message | 提示信息，成功时可省略，失败时必填 |
| data | 业务数据，成功时有值，失败时为 `null` |

### 1.2 HTTP 状态码 = JSON code

| HTTP | code | 含义 |
|------|------|------|
| 200 | 200 | 成功 |
| 400 | 400 | 参数错误 |
| 401 | 401 | 未登录 / token 过期 |
| 404 | 404 | 资源不存在 |
| 500 | 500 | 服务端错误 |

前端优先看 HTTP 状态码做分支处理。

---

## 2. 鉴权模块

### 2.1 微信登录

```
POST /auth/wechat-login
```

请求：

```json
{
  "code": "wx.login() 返回的 code"
}
```

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "token": "eyJhbGciOi...",
    "expiresIn": 7200,
    "userInfo": {
      "userId": "u_abc123",
      "nickname": "用户昵称",
      "avatarUrl": "https://..."
    }
  }
}
```

失败响应：`HTTP 400`

```json
{
  "code": 400,
  "message": "code 无效或已过期",
  "data": null
}
```

---

## 3. KnowledgeCard 数据模型

### 3.1 字段定义

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 服务端生成，前端只读 |
| userId | string | 是 | 服务端保存，用于关联当前登录用户；前端不传 |
| title | string | 是 | 卡片标题，最长 200 字符 |
| sourceText | string | 否 | 原文或摘录，默认 `""` |
| summary | string | 否 | 摘要，默认 `""` |
| sourceUrl | string | 否 | 来源链接，默认 `""` |
| tags | string[] | 否 | 标签列表，默认 `[]` |
| status | string | 是 | `todo` / `done` / `archived` |
| createdAt | string | 是 | ISO 8601 时间 |
| updatedAt | string | 是 | ISO 8601 时间 |
| deletedAt | string? | 否 | ISO 8601 时间；未删除时为 `null` |

### 3.2 字段返回规则

- `sourceText` 为空时返回 `""`，不返回 `null`
- `summary` 为空时返回 `""`，不返回 `null`
- `sourceUrl` 为空时返回 `""`，不返回 `null`
- `tags` 为空时返回 `[]`，不返回 `null`
- `deletedAt` 未删除时返回 `null`
- 普通列表默认不返回已软删除卡片

### 3.3 状态含义

| status | 页面文案 | 说明 |
|--------|----------|------|
| todo | 待整理 | 已收集但还没整理 |
| done | 已整理 | 已整理为可复习卡片 |
| archived | 已归档 | 暂时不在日常整理视图中展示 |

删除不作为 `status` 的一种值，使用 `deletedAt` 表示软删除。

### 3.4 完整示例

```json
{
  "id": "card_a1b2c3",
  "userId": "u_abc123",
  "title": "大模型工具调用笔记",
  "sourceText": "原文或摘录内容",
  "summary": "整理后的简短摘要",
  "sourceUrl": "https://example.com/article",
  "tags": ["AI", "工具"],
  "status": "todo",
  "createdAt": "2026-06-16T15:30:00+08:00",
  "updatedAt": "2026-06-16T15:30:00+08:00",
  "deletedAt": null
}
```

---

## 4. Cards 接口

### 4.1 获取卡片列表

```
GET /cards?page=1&pageSize=20&status=all&keyword=&tag=&sort=updatedAt&order=desc
```

参数：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| page | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 20 | 每页数量，最大 100 |
| status | string | 否 | all | `all` / `todo` / `done` / `archived` |
| keyword | string | 否 | 空 | 搜索标题、摘要、原文、标签 |
| tag | string | 否 | 空 | 按单个标签筛选 |
| sort | string | 否 | updatedAt | `createdAt` / `updatedAt` |
| order | string | 否 | desc | `asc` / `desc` |

默认行为：

- 只返回当前登录用户自己的卡片
- 排除 `deletedAt != null` 的卡片
- 按 `updatedAt DESC` 排序
- `keyword` 为空时等同普通列表
- `status=all` 时返回全部未删除状态

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "list": [
      { "... KnowledgeCard 对象 ...": "..." }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 4.2 获取卡片详情

```
GET /cards/{id}
```

默认行为：

- 只能获取当前用户自己的卡片
- 普通详情不返回已软删除卡片

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": { "... KnowledgeCard 对象 ...": "..." }
}
```

失败响应：`HTTP 404`

```json
{
  "code": 404,
  "message": "卡片不存在",
  "data": null
}
```

---

### 4.3 创建卡片

```
POST /cards
```

请求：

```json
{
  "title": "大模型工具调用笔记",
  "sourceText": "原文或摘录内容",
  "summary": "整理后的简短摘要",
  "sourceUrl": "https://example.com/article",
  "tags": ["AI", "工具"],
  "status": "todo"
}
```

规则：

- `title` 必填
- `status` 可选，默认 `todo`
- 前端不传 `userId`
- 后端从 token 解析当前用户
- `sourceText` / `summary` / `sourceUrl` 未传时按 `""` 保存
- `tags` 未传时按 `[]` 保存

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": { "... KnowledgeCard 对象 ...": "..." }
}
```

失败响应：`HTTP 400`

```json
{
  "code": 400,
  "message": "title 不能为空",
  "data": null
}
```

---

### 4.3.1 智能整理卡片草稿

```
POST /cards/organize
```

用途：根据用户粘贴的学习材料，返回可编辑的卡片草稿建议。

请求：

```json
{
  "sourceText": "用户粘贴的学习材料",
  "sourceUrl": "https://example.com/article"
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sourceText | string | 是 | 需要整理的学习材料 |
| sourceUrl | string | 否 | 来源链接，可为空 |

规则：

- 该接口只返回建议，不创建卡片
- 前端拿到结果后填充新建 / 编辑表单
- 用户确认后仍调用 `POST /cards` 保存
- 标签建议优先从预设标签中选择
- 不抓取公共内容，不生成公共信息流

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "title": "RAG 检索增强生成",
    "summary": "RAG 将外部知识检索与模型生成结合，用于提升回答的准确性和可追溯性。",
    "tags": ["RAG知识", "模型基础"],
    "status": "todo"
  }
}
```

失败响应：`HTTP 400`

```json
{
  "code": 400,
  "message": "sourceText 不能为空",
  "data": null
}
```

---

### 4.4 更新卡片

```
PATCH /cards/{id}
```

请求：所有字段均可选，未传字段保持不变。

```json
{
  "title": "修改后的标题",
  "summary": "修改后的摘要",
  "tags": ["AI", "学习"],
  "status": "done"
}
```

可更新字段：

- `title`
- `sourceText`
- `summary`
- `sourceUrl`
- `tags`
- `status`

规则：

- 不允许通过普通更新接口修改 `userId`
- 不允许通过普通更新接口修改 `createdAt`
- 不允许通过普通更新接口修改 `updatedAt`
- 不允许通过普通更新接口修改 `deletedAt`
- 保存成功后刷新 `updatedAt`
- 只能更新当前用户自己的未删除卡片

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": { "... 更新后的 KnowledgeCard 对象 ...": "..." }
}
```

失败响应：`HTTP 404`

```json
{
  "code": 404,
  "message": "卡片不存在",
  "data": null
}
```

---

### 4.5 归档卡片

```
PATCH /cards/{id}/archive
```

规则：

- 将 `status` 改为 `archived`
- 刷新 `updatedAt`
- 只能归档当前用户自己的未删除卡片

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": { "... 更新后的 KnowledgeCard 对象 ...": "..." }
}
```

---

### 4.6 软删除卡片

```
DELETE /cards/{id}
```

规则：

- 设置 `deletedAt = 当前时间`
- 刷新 `updatedAt`
- 不物理删除数据库记录
- 软删除后从普通列表、待整理列表、工作台统计中排除
- 只能删除当前用户自己的未删除卡片

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "message": "已移入回收站",
  "data": null
}
```

---

### 4.7 获取搜索联想

```
GET /cards/suggestions?keyword=rag
```

用途：搜索输入时返回关键词、标签和卡片标题联想。

参数：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| keyword | string | 是 | 无 | 搜索关键词 |
| limit | int | 否 | 8 | 每类最多返回数量 |

规则：

- 只返回当前登录用户自己的数据
- 默认排除 `deletedAt != null` 的卡片
- 第一版可使用数据库模糊匹配，不要求 AI
- `keyword` 为空时返回空数组

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "keywords": ["RAG", "检索增强"],
    "tags": ["RAG知识"],
    "cards": [
      {
        "id": "card_a1b2c3",
        "title": "RAG 检索增强生成"
      }
    ]
  }
}
```

---

## 5. 回收站接口

### 5.1 获取回收站列表

```
GET /cards/deleted?page=1&pageSize=20&keyword=&sort=deletedAt&order=desc
```

参数：

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| page | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 20 | 每页数量，最大 100 |
| keyword | string | 否 | 空 | 搜索标题、摘要、原文、标签 |
| sort | string | 否 | deletedAt | `deletedAt` / `updatedAt` / `createdAt` |
| order | string | 否 | desc | `asc` / `desc` |

默认行为：

- 只返回当前用户自己的卡片
- 只返回 `deletedAt != null` 的卡片
- 按 `deletedAt DESC` 排序

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "list": [
      { "... KnowledgeCard 对象 ...": "..." }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 5.2 恢复卡片

```
PATCH /cards/{id}/restore
```

规则：

- 清空 `deletedAt`
- 保留删除前的 `status`
- 刷新 `updatedAt`
- 只能恢复当前用户自己的已软删除卡片

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": { "... 恢复后的 KnowledgeCard 对象 ...": "..." }
}
```

---

### 5.3 彻底删除卡片

```
DELETE /cards/{id}/permanent
```

规则：

- 物理删除数据库记录
- 只允许彻底删除当前用户自己的已软删除卡片
- 前端必须二次确认
- 删除后不提供恢复

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "message": "已彻底删除",
  "data": null
}
```

---

## 6. 标签接口

### 6.1 获取预设标签

```
GET /tags/presets
```

用途：返回最终版固定标签体系，供新建 / 编辑页选择。

规则：

- 标签列表应保持稳定
- 前端允许多选
- 卡片保存时仍提交 `tags: string[]`
- 如果后端暂不实现，前端可以先使用本地常量

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": [
    "AI概念",
    "提示词工程",
    "RAG知识",
    "模型基础",
    "Agent",
    "多模态",
    "向量数据库",
    "工具使用",
    "编程学习",
    "产品思考",
    "学习方法",
    "读书笔记"
  ]
}
```

---

### 6.2 获取标签汇总

```
GET /cards/tags
```

规则：

- 由后端聚合当前用户所有未删除卡片的 `tags`
- 排除已删除卡片
- 按 `count DESC` 排序

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": [
    { "name": "AI", "count": 8 },
    { "name": "工具", "count": 5 }
  ]
}
```

---

## 7. 工作台接口

### 7.1 获取工作台概览

```
GET /cards/overview
```

规则：

- 只统计当前用户数据
- 默认排除已删除卡片
- `recentCards` 按 `updatedAt DESC` 返回最近编辑卡片
- `deletedCount` 统计已软删除卡片数量，用于回收站入口提示

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "todoCount": 3,
    "doneCount": 12,
    "archivedCount": 4,
    "deletedCount": 1,
    "recentCards": [
      { "... KnowledgeCard 对象 ...": "..." }
    ],
    "topTags": [
      { "name": "AI", "count": 8 },
      { "name": "工具", "count": 5 }
    ]
  }
}
```

说明：

- `recentCards` 使用 KnowledgeCard 对象结构
- `topTags` 可复用 `/cards/tags` 的标签项结构

---

## 8. 用户模块

### 8.1 获取用户信息

```
GET /user/profile
```

成功响应：`HTTP 200`

```json
{
  "code": 200,
  "data": {
    "userId": "u_abc123",
    "nickname": "用户昵称",
    "avatarUrl": "https://..."
  }
}
```

---

## 9. 前端对接指引

1. 在 `miniprogram/utils/api.js` 封装 `request()`，自动拼接 Base URL 和 Authorization。
2. 真机调试和正式部署时，在 `config.js` 中切换 Base URL。
3. `wx.request` 返回的 `response.data` 是完整响应体 `{ code, message, data }`，业务数据在 `response.data.data`。
4. 普通内容池使用 `GET /cards`，回收站使用 `GET /cards/deleted`。
5. 普通删除调用 `DELETE /cards/{id}`，页面文案使用“移入回收站”。
6. 彻底删除只在回收站中出现，调用 `DELETE /cards/{id}/permanent`。

---

## 10. 最终版接口清单

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/auth/wechat-login` | 微信登录 |
| GET | `/cards` | 卡片列表，支持搜索、状态、标签、排序、分页 |
| GET | `/cards/{id}` | 卡片详情 |
| POST | `/cards` | 创建卡片 |
| POST | `/cards/organize` | 智能整理卡片草稿 |
| PATCH | `/cards/{id}` | 更新卡片 |
| PATCH | `/cards/{id}/archive` | 归档卡片 |
| DELETE | `/cards/{id}` | 软删除卡片 |
| GET | `/cards/deleted` | 回收站列表 |
| PATCH | `/cards/{id}/restore` | 恢复卡片 |
| DELETE | `/cards/{id}/permanent` | 彻底删除卡片 |
| GET | `/cards/suggestions` | 搜索联想 |
| GET | `/tags/presets` | 预设标签 |
| GET | `/cards/tags` | 标签汇总 |
| GET | `/cards/overview` | 工作台概览 |
| GET | `/user/profile` | 用户信息 |

---

> 本文档即为开发契约 v0.4。后续新增能力前，先更新产品契约，再同步接口契约。
