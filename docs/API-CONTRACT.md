# API 接口约定 v0.2

> **状态：已确认** | 微信小程序前端（Codex）↔ ASP.NET 后端（Claude）

---

## 1. 通用约定

| 项目 | 约定 |
|------|------|
| 本地开发 | `http://localhost:5000/api/v1` |
| 真机调试 | 局域网 IP 或内网穿透，`config.js` 中切换 |
| 正式部署 | `https://<你的域名>/api/v1`（待部署时确认） |
| 请求格式 | `application/json; charset=utf-8` |
| 鉴权方式 | Header `Authorization: Bearer <token>` |
| 时间格式 | ISO 8601（`2026-06-12T15:30:00+08:00`） |

### 响应格式（统一）

成功和失败共用同一结构：

```json
{
  "code": 200,
  "message": "可选提示信息",
  "data": { ... }
}
```

| 字段 | 说明 |
|------|------|
| code | 业务状态码，与 HTTP 状态码保持一致 |
| message | 提示信息，成功时可省略，失败时必填 |
| data | 业务数据，成功时有值，失败时为 `null` |

### HTTP 状态码 = JSON code

| HTTP | code | 含义 |
|------|------|------|
| 200 | 200 | 成功 |
| 400 | 400 | 参数错误 |
| 401 | 401 | 未登录 / token 过期 |
| 404 | 404 | 资源不存在 |
| 500 | 500 | 服务端错误 |

> **规则：HTTP 状态码和 JSON body 里的 code 永远相同。前端优先看 HTTP 状态码做分支处理。**

---

## 2. 鉴权模块

### 2.1 微信登录

```
POST /auth/wechat-login
```

**请求：**
```json
{
  "code": "wx.login() 返回的 code"
}
```

**成功响应：** `HTTP 200`
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

**失败响应：** `HTTP 400`
```json
{
  "code": 400,
  "message": "code 无效或已过期",
  "data": null
}
```

---

## 3. Todo 数据模型

### 3.1 字段定义（固定）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | — | 服务端生成，前端只读 |
| title | string | 是 | 最长 200 字符 |
| description | string | 否 | 最长 1000 字符，**为空时返回 `""`，永不返回 null** |
| completed | bool | — | 默认 false |
| priority | int | 否 | 0=无, 1=高, 2=中, 3=低；默认 2 |
| dueDate | string? | 否 | ISO 8601 日期，无截止日期时为 `null` |
| createdAt | string | — | 服务端生成 |
| updatedAt | string | — | 服务端生成，每次更新自动刷新 |

### 3.2 完整示例

```json
{
  "id": "todo_a1b2c3",
  "title": "完成项目设计书",
  "description": "",
  "completed": false,
  "priority": 1,
  "dueDate": "2026-06-30T23:59:59+08:00",
  "createdAt": "2026-06-12T15:30:00+08:00",
  "updatedAt": "2026-06-12T15:30:00+08:00"
}
```

---

## 4. Todo 接口

### 4.1 获取列表

```
GET /todos?page=1&pageSize=20&status=all&sort=createdAt&order=desc
```

| 参数 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| page | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 20 | 每页条数，最大 100 |
| status | string | 否 | all | `all` / `active` / `completed` |
| sort | string | 否 | createdAt | `createdAt` / `priority` / `dueDate` |
| order | string | 否 | desc | `asc` / `desc` |

**默认排序：按创建时间倒序（最新的在最上面）。**

**成功响应：** `HTTP 200`
```json
{
  "code": 200,
  "data": {
    "list": [ "... Todo 对象数组 ..." ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 4.2 创建

```
POST /todos
```

```json
{
  "title": "完成项目设计书",
  "description": "选填描述",
  "priority": 1,
  "dueDate": "2026-06-30T23:59:59+08:00"
}
```

**成功响应：** `HTTP 200`
```json
{
  "code": 200,
  "data": { "... 完整的 Todo 对象 ..." }
}
```

**失败响应（缺少 title）：** `HTTP 400`
```json
{
  "code": 400,
  "message": "title 不能为空",
  "data": null
}
```

---

### 4.3 更新（部分字段）

> 改为 `PATCH`，只传要改的字段，未传字段保持不变。

```
PATCH /todos/{id}
```

**请求：**（所有字段可选）
```json
{
  "title": "修改后的标题",
  "completed": true
}
```

**成功响应：** `HTTP 200`
```json
{
  "code": 200,
  "data": { "... 更新后的完整 Todo 对象 ..." }
}
```

**失败响应：** `HTTP 404`
```json
{
  "code": 404,
  "message": "Todo 不存在",
  "data": null
}
```

---

### 4.4 删除

```
DELETE /todos/{id}
```

**成功响应：** `HTTP 200`
```json
{
  "code": 200,
  "message": "已删除",
  "data": null
}
```

---

### 4.5 批量操作

```
PATCH /todos/batch
```

**请求：**
```json
{
  "ids": ["todo_1", "todo_2", "todo_3"],
  "action": "complete"
}
```

| action | 说明 |
|--------|------|
| complete | 全部标记完成 |
| uncomplete | 全部取消完成 |
| delete | 全部删除 |

**响应（逐条返回结果，部分失败不影响其他）：** `HTTP 200`
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 3,
    "successCount": 2,
    "failedCount": 1,
    "results": [
      { "id": "todo_1", "success": true, "message": "已完成" },
      { "id": "todo_2", "success": true, "message": "已完成" },
      { "id": "todo_404", "success": false, "message": "Todo 不存在" }
    ]
  }
}
```

> **规则：批量操作尽量执行到底，逐条汇报结果，不因为一条失败就全部回滚。**

---

## 5. 用户模块

### 5.1 获取用户信息

```
GET /user/profile
```

**成功响应：** `HTTP 200`
```json
{
  "code": 200,
  "data": {
    "userId": "u_abc123",
    "nickname": "用户昵称",
    "avatarUrl": "https://...",
    "todoCount": 42,
    "completedCount": 18
  }
}
```

---

## 6. 前端对接指引（给 Codex）

1. 在 `miniprogram/utils/api.js` 封装一个 `request()` 函数，自动拼接 Base URL 和 Authorization
2. 本地开发时 Base URL 指向 `http://localhost:5000/api/v1`
3. 真机调试和正式部署时，修改 `app.js` 里的全局 baseUrl 即可
4. **注意层级**：`wx.request` 返回的 `response.data` 是整个响应体 `{ code, message, data }`，真正的业务数据在 `response.data.data` 里

---

> **双方已确认，此文档即为开发契约 v0.2。**
> 
> 前端（Codex）：`miniapp-frontend` 分支
> 后端（Claude）：`aspnet-backend` 分支
> 文档（用户）：`project-docs` 分支
