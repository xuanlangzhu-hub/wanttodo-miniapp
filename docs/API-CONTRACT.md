# API 接口约定 v0.1

> **状态：草案** | 微信小程序前端 ↔ ASP.NET 后端

---

## 1. 通用约定

| 项目 | 约定 |
|------|------|
| Base URL | `https://api.example.com/api/v1`（待定） |
| 请求格式 | `application/json; charset=utf-8` |
| 鉴权方式 | Header `Authorization: Bearer <token>` |
| 时间格式 | ISO 8601（`2026-06-12T15:30:00+08:00`） |
| 通用错误格式 | `{ "code": 错误码, "message": "描述" }` |

### 通用错误码

| code | 含义 |
|------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 未登录/token 过期 |
| 404 | 资源不存在 |
| 500 | 服务端错误 |

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

**响应：**
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

---

## 3. Todo 模块

### 3.1 获取 Todo 列表

```
GET /todos?page=1&pageSize=20&status=all
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| page | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页条数，默认 20 |
| status | string | 否 | `all` / `active` / `completed` |

**响应：**
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": "todo_1",
        "title": "完成项目设计书",
        "description": "写清楚页面结构和接口",
        "completed": false,
        "priority": 1,
        "createdAt": "2026-06-12T15:30:00+08:00",
        "updatedAt": "2026-06-12T15:30:00+08:00"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20
  }
}
```

---

### 3.2 创建 Todo

```
POST /todos
```

**请求：**
```json
{
  "title": "完成项目设计书",
  "description": "写清楚页面结构和接口（选填）",
  "priority": 1
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| title | string | 是 | 最长 200 字符 |
| description | string | 否 | 最长 1000 字符 |
| priority | int | 否 | 0=无, 1=高, 2=中, 3=低；默认 2 |

**响应：**
```json
{
  "code": 200,
  "data": {
    "id": "todo_1",
    "title": "完成项目设计书",
    "description": "...",
    "completed": false,
    "priority": 1,
    "createdAt": "2026-06-12T15:30:00+08:00",
    "updatedAt": "2026-06-12T15:30:00+08:00"
  }
}
```

---

### 3.3 更新 Todo

```
PUT /todos/{id}
```

**请求：**（全部字段可选，只传要改的）
```json
{
  "title": "修改后的标题",
  "description": "修改后的描述",
  "completed": true,
  "priority": 2
}
```

**响应：**
```json
{
  "code": 200,
  "data": { "... 完整的 todo 对象 ..." }
}
```

---

### 3.4 删除 Todo

```
DELETE /todos/{id}
```

**响应：**
```json
{
  "code": 200,
  "message": "已删除"
}
```

---

### 3.5 批量操作（切换完成状态）

```
PATCH /todos/batch
```

**请求：**
```json
{
  "ids": ["todo_1", "todo_2"],
  "action": "complete"
}
```

| action | 说明 |
|--------|------|
| complete | 标记完成 |
| uncomplete | 取消完成 |
| delete | 批量删除 |

**响应：**
```json
{
  "code": 200,
  "data": {
    "affectedCount": 2
  }
}
```

---

## 4. 用户模块

### 4.1 获取用户信息

```
GET /user/profile
```

**响应：**
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

## 5. TODO：待确认事项

- [ ] Base URL 确认（部署到哪个服务器/域名）
- [ ] 是否需要分页，还是简单全量返回
- [ ] 优先级用数字还是枚举字符串
- [ ] 是否需要"清单/分组"概念（不只一个 todo 列表）
- [ ] 是否需要排序（按创建时间/优先级/截止日期）
- [ ] 是否需要截止日期字段
- [ ] 文件上传（todo 附件）要不要
- [ ] 是否需要用户注册/手机号绑定

---

> **双方确认后，此文档即为开发契约。修改需两方同步。**
> 
> 前端（Codex）：读取此文档后按接口格式发请求、解析响应
> 后端（Claude）：实现这些接口，返回文档约定的格式
