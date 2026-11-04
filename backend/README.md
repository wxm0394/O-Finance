# O-Finance Backend — Private Financial OS Core

Phase 2.1 Backend Foundation for O-Finance. This service provides the local Python backend infrastructure powering the unified `OFinanceAssistant`, multi-institution financial account ledgering, and future Beancount plain-text double-entry bookkeeping.

---

## 1. 技术栈 (Tech Stack)

- **Python**: 3.12+ (兼容 3.10+)
- **Web 框架**: FastAPI 0.115+
- **数据验证与配置**: Pydantic v2 + pydantic-settings
- **ORM & 数据库引擎**: SQLAlchemy 2.x (Async) + psycopg 3
- **数据库迁移**: Alembic
- **主数据库**: PostgreSQL (业务事务、账户、审批流、审计日志)
- **未来的分析引擎**: DuckDB + Parquet (P2.2 接入)
- **未来的总账核心**: Beancount (P2.2 接入)
- **测试框架**: pytest + pytest-asyncio + httpx

---

## 2. 目录架构 (Architecture)

```text
backend/
├── app/
│   ├── main.py                     # FastAPI 顶层入口、生命周期管理、CORS与全局路由
│   ├── core/                       # 核心配置与底层设施
│   │   ├── config.py               # pydantic-settings 配置加载与凭据隔离
│   │   ├── database.py             # SQLAlchemy 2.x 异步引擎、Session 工厂与真实探针
│   │   └── security.py             # 10 大金融安全不变量与写操作限制
│   ├── api/
│   │   └── v1/
│   │       ├── router.py           # v1 路由汇总 (/api/v1/...)
│   │       └── assistant.py        # Assistant 接口 (/status, /config, /run)
│   ├── schemas/                    # Pydantic v2 请求/响应 DTO (snake_case)
│   │   ├── assistant.py            # 6 种 Task Mode 及 DTO
│   │   └── health.py               # 细粒度子系统健康状态 DTO
│   ├── models/                     # SQLAlchemy 2.x 实体模型 (PostgreSQL)
│   │   ├── base.py                 # 基础模型与 TimestampMixin
│   │   ├── account.py              # 财务账户表 (financial_accounts)
│   │   ├── transaction.py          # 交易事务表 (transaction_records)
│   │   ├── approval.py             # 人工审批流表 (approval_tasks)
│   │   └── audit.py                # 安全审计日志表 (audit_logs)
│   ├── services/                   # 业务逻辑服务
│   │   ├── assistant_service.py    # Assistant 配置与合约执行
│   │   └── health_service.py       # 真实数据库与 API 探针逻辑
│   ├── assistant/                  # 未来统一 Assistant Runtime (Pydantic AI)
│   │   └── runtime.py              # OFinanceAssistantRuntime 架构骨架
│   └── ledger/                     # 未来 Beancount 复式簿记集成
│       └── beancount_bridge.py     # Beancount 桥接器骨架
├── migrations/                     # Alembic 迁移脚本
│   ├── env.py                      # 异步迁移执行器
│   └── versions/
│       └── 001_initial_schema.py   # 初始表结构迁移
├── tests/                          # 完整测试套件
│   ├── conftest.py                 # ASGI 测试客户端与环境变量隔离
│   ├── test_health.py              # 健康检查与子系统解耦测试
│   ├── test_assistant_status.py    # Assistant 状态与 6 模式验证
│   ├── test_assistant_config.py    # 密钥绝不泄漏测试
│   ├── test_assistant_run.py       # Run 契约与非法 Task Mode 拦截
│   ├── test_database.py            # 数据库未连接时的诚实状态验证
│   └── test_security.py            # 默认拒绝白名单、任务隔离与审计哈希链验证
├── .env.example                    # 环境变量模版 (绝不含真实密钥)
├── alembic.ini                     # Alembic 配置文件
├── pyproject.toml                  # 项目依赖与工具链配置
├── requirements.txt                # pip 依赖清单
└── README.md                       # 说明文档
```

---

## 3. 本地环境搭建与启动

### 3.1 创建 Python 虚拟环境

```bash
cd backend

# 使用 Python 3.12 (或 3.10+) 创建 venv
python3 -m venv venv

# 激活虚拟环境 (Linux / macOS)
source venv/bin/activate

# 激活虚拟环境 (Windows PowerShell)
# .\venv\Scripts\Activate.ps1
```

### 3.2 安装依赖

```bash
pip install --upgrade pip
pip install -r requirements.txt
# 或者使用可编辑模式:
# pip install -e .
```

### 3.3 配置文件

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

在 `.env` 中按需配置：

```bash
APP_ENV=development
APP_HOST=127.0.0.1
APP_PORT=8000
LOG_LEVEL=INFO

# 数据库连接 (本地 PostgreSQL)
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/ofinance_db

# Gemini API Key (仅存于 Python 后端，严禁注入前端)
GEMINI_API_KEY=your_gemini_api_key_here
LLM_PROVIDER=Gemini
GEMINI_MODEL=gemini-2.5-flash
```

### 3.4 运行数据库迁移 (Alembic)

确保 PostgreSQL 服务已启动并创建了目标数据库后执行：

```bash
alembic upgrade head
```

### 3.5 启动 FastAPI 开发服务器

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

启动后可访问：
- **API 首页**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/)
- **Swagger UI 交互文档**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc 文档**: [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **健康检查探针**: [http://127.0.0.1:8000/healthz](http://127.0.0.1:8000/healthz)

---

## 4. 运行自动化测试

```bash
pytest -v
```

测试覆盖：
- `test_health.py`: 验证 API 存活、子系统解耦与数据库未配置时的诚实状态。
- `test_assistant_status.py`: 验证 `OFinanceAssistant` 单实例及 6 大任务模式合规。
- `test_assistant_config.py`: 确保 `GEMINI_API_KEY` 绝不泄漏到前端响应。
- `test_assistant_run.py`: 验证请求校验、拦截非法任务模式（如未授权执行模式）、返回 `scaffold_not_implemented` 契约状态。
- `test_database.py`: 验证数据库连接探针逻辑，杜绝虚假报告连接成功。
- `test_security.py`: 验证 Default-Deny 默认拒绝机制、6 大模式隔离、人工审批阻断以及审计日志 SHA-256 哈希链防篡改。

---

## 5. API 接口一览

| Method | 路径 | 功能说明 | 状态/行为 |
| :--- | :--- | :--- | :--- |
| `GET` | `/healthz` | 系统综合健康检查 | 细粒度分别返回 API 存活、PostgreSQL 连通性、Gemini Key 配置状态、模型探活 |
| `GET` | `/` | API 根入口 | 返回系统版本与规范入口 |
| `GET` | `/api/v1/assistant/status` | Assistant 运行时状态 | 包含 6 大 Task Mode、预算与调用量遥测 |
| `GET` | `/api/v1/assistant/config` | Assistant 模型配置 | 返回模型名称、上下文配置；**严禁包含 API Key** |
| `POST` | `/api/v1/assistant/run` | 提交 Assistant 分析任务 | 严格验证 Task Mode；P2.1 阶段明确返回未实现脚手架状态，不虚造执行 |

---

## 6. 核心安全准则 (Security Invariants)

1. **密钥隔离**: `GEMINI_API_KEY` 仅在 Python 后端环境加载，绝不暴露给前端，绝不记录进日志。
2. **读写分离与只读连接器**: 银行与券商连接器必须保持纯只读（`Read-Only`），严禁自动执行转账或下单。
3. **资金安全审批流**: 任何转账、出金、下单与账务过账操作必须生成 `ApprovalTaskModel`，必须经由用户物理显式审批。
4. **诚实探针**: 严禁在数据库未配置或连接失败时伪造健康状态；严禁在模型未实际发起探针前伪造验证通过。
