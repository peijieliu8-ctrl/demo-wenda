# 卓尔智联 AI 问答助手 Demo

结论：这是一个本地可运行的前后端全链路 MVP，用于演示 AI 产品经理的 vibe coding、RAG 产品拆解和工程落地能力。第一版使用 Mock RAG，不接真实大模型、向量库或业务系统。

## 1. 项目范围

| 层级 | 内容 | 说明 |
| --- | --- | --- |
| MVP | 登录、AI 问答、引用依据、知识库管理、会话日志、Bad Case、数据看板 | 已实现，可本地运行 |
| 二期 | 接入真实 LLM、embedding、向量库、rerank、权限细分 | 待确认模型、数据源、权限策略 |
| 长期 | 订单/物流/退款 Tool Calling、质检闭环、自动知识推荐 | 待确认业务接口、审批边界、风控策略 |

## 2. 技术栈

| 模块 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React + Vite + TypeScript + Tailwind | B 端后台样式，接口联调 |
| 后端 | FastAPI + Pydantic | REST API，Mock RAG |
| 数据 | 本地 JSON | `backend/data/*.json` |
| AI | Mock RAG | 关键词召回 + 风控规则 + 置信度 |

## 3. 目录结构

```text
.
├── backend
│   ├── app
│   │   ├── main.py       # FastAPI 路由
│   │   ├── models.py     # 请求/响应模型
│   │   ├── rag.py        # Mock RAG 逻辑
│   │   └── storage.py    # JSON 读写
│   ├── data
│   │   ├── knowledge.json
│   │   ├── sessions.json
│   │   └── badcases.json
│   └── requirements.txt
├── frontend
│   ├── src
│   │   ├── App.tsx       # 页面与交互
│   │   ├── api.ts        # 后端接口封装
│   │   └── types.ts      # 前后端类型
│   └── package.json
└── README.md
```

## 4. 启动方式

| 步骤 | 命令 | 目录 |
| --- | --- | --- |
| 创建后端虚拟环境 | `python -m venv .venv` | `backend` |
| 激活虚拟环境 | `.\.venv\Scripts\Activate.ps1` | `backend` |
| 安装后端依赖 | `pip install -r requirements.txt` | `backend` |
| 启动后端 | `uvicorn app.main:app --reload --host 127.0.0.1 --port 8000` | `backend` |
| 安装前端依赖 | `npm install` | `frontend` |
| 启动前端 | `npm run dev` | `frontend` |

访问地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://127.0.0.1:5173` |
| 后端健康检查 | `http://127.0.0.1:8000/health` |
| OpenAPI 文档 | `http://127.0.0.1:8000/docs` |

本地前端联调后端时，在 `frontend/.env.local` 中配置：

```env
VITE_API_BASE=http://127.0.0.1:8000
```

## 4.1 Vercel 部署

| 配置项 | 值 |
| --- | --- |
| Framework | `Services` |
| Root Directory | `./` |
| Frontend Service | `frontend`，路由前缀 `/` |
| Backend Service | `backend`，路由前缀 `/_backend` |

线上前端默认通过 `/_backend` 访问 FastAPI，例如 `/_backend/api/chat` 和 `/_backend/health`。部署配置见根目录 `vercel.json`。

## 5. Mock 账号

| 角色 | 用户名 | 密码 | 可演示能力 |
| --- | --- | --- | --- |
| 客服 | `cs01` | `123456` | 问答、转人工、标记 Bad Case |
| 运营 | `ops01` | `123456` | 知识维护、日志分析、Bad Case 处理 |
| 管理员 | `admin` | `123456` | 全量页面和看板 |

## 6. 接口清单

| 方法 | 路径 | 目标 |
| --- | --- | --- |
| GET | `/health` | 服务健康检查 |
| POST | `/api/auth/login` | Mock 登录 |
| POST | `/api/chat` | Mock RAG 问答 |
| GET | `/api/knowledge` | 查询知识库 |
| POST | `/api/knowledge` | 新增知识 |
| PUT | `/api/knowledge/{id}` | 编辑/启停知识 |
| GET | `/api/sessions` | 查询会话日志 |
| POST | `/api/sessions/{id}/transfer` | 一键转人工状态记录 |
| GET | `/api/badcases` | 查询 Bad Case |
| POST | `/api/badcases` | 标记 Bad Case |
| PUT | `/api/badcases/{id}` | 更新 Bad Case |
| GET | `/api/metrics` | 查询指标看板 |

## 7. 接口测试示例

```powershell
curl.exe http://127.0.0.1:8000/health
```

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d "{\"username\":\"cs01\",\"password\":\"123456\",\"role\":\"customer_service\"}"
```

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"question\":\"客户签收后发现包装破损，还能申请售后吗？\",\"user_id\":\"user_cs01\",\"role\":\"customer_service\"}"
```

## 8. Mock RAG 设计

| 要素 | MVP 规则 |
| --- | --- |
| 何时触发 | 用户在 AI 问答工作台提交问题时触发 `/api/chat` |
| 如何判断 | 对启用知识做关键词、标题、分类、正文片段匹配，返回 Top 3 |
| 上下文来源 | `backend/data/knowledge.json` 中的启用知识 |
| Prompt 逻辑 | 第一版不调用模型，用命中文档片段模板化生成答案 |
| 失败怎么办 | 无明确命中时返回 `fallback`，提示补充信息或转人工 |
| 兜底策略 | 低置信、无命中、高风险场景均提示人工确认 |
| 风控点 | 订单查询、物流查询、赔付承诺、退款审批不由 AI 直接给最终结论 |

## 9. 功能验收标准

| 模块 | 可验收标准 |
| --- | --- |
| 登录页 | 三类 Mock 用户可登录，用户信息写入 localStorage，退出后清空 |
| AI 问答工作台 | 可输入问题，返回答案、状态、置信度、引用、建议动作 |
| 低置信兜底 | 未命中知识或置信度低时返回 fallback 提示 |
| 高风险问题 | 订单、物流、赔付、退款审批问题返回人工确认提示 |
| 一键转人工 | 点击后会话日志中的 `transferred_to_human` 更新为 true |
| 标记 Bad Case | 点击后写入 Bad Case 列表，并更新会话反馈 |
| 知识库管理 | 可新增、编辑、启用、停用知识 |
| 会话日志 | 每次问答自动写入日志并可查看 |
| Bad Case 标注 | 可修改问题类型、处理状态、修复建议 |
| 数据看板 | 展示 8 个指标卡片，无日志时使用 Mock 兜底值 |

## 10. 内置示例知识

| 序号 | 标题 |
| --- | --- |
| 1 | 生鲜商品售后规则 |
| 2 | 包装破损处理流程 |
| 3 | 开票信息修改规则 |
| 4 | 平台交易规则 |
| 5 | 退款审核边界 |
| 6 | 人工客服转接规则 |

## 11. 内置示例问题

| 序号 | 问题 |
| --- | --- |
| 1 | 客户签收后发现包装破损，还能申请售后吗？ |
| 2 | 开票信息填错了可以修改吗？ |
| 3 | 订单现在到哪里了？ |
| 4 | 客户要求赔偿 500 元怎么办？ |
| 5 | 平台保证金规则是什么？ |

## 12. 后续替换真实能力

| 能力 | 替换位置 | 注意事项 |
| --- | --- | --- |
| DeepSeek / 真实 LLM | `backend/app/rag.py` 的答案生成部分 | 需要补充 API Key、超时、重试、敏感信息过滤 |
| 向量库 | `backend/app/rag.py` 的 `_retrieve` | 需要新增文档切片、embedding、TopK、rerank |
| SQLite | `backend/app/storage.py` | 需要迁移 JSON 文件和增删改查实现 |
| Tool Calling | 新增订单、物流、退款等工具路由 | 不要与知识问答混成一个能力，需明确权限和风控 |
