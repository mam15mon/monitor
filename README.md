# TCP端口监控平台

一个用于持续监控指定公网IP和TCP端口网络质量的Web应用平台。

## 系统架构

- **前端**: React + Vite + TypeScript
- **后端**: FastAPI + Python
- **数据库**: SQLite (配置数据 + 时序数据)
- **数据采集器**: Python异步脚本

## 核心功能

- TCP端口连接延迟监控
- 丢包率统计
- 多维度数据展示
- 批量目标管理
- 数据导出
- 用户权限管理
- TOTP双因子认证

## 项目结构

```
monitor/
├── backend/          # 后端API服务
├── frontend/         # 前端React应用
├── collector/        # 数据采集器
├── database/         # 数据库初始化脚本
├── docker-compose.yml
└── README.md
```

## 快速开始

### 环境要求

- Python 3.9+
- Node.js 18+

### 安装和运行

1. 克隆项目
```bash
git clone <repository-url>
cd monitor
```

2. 初始化数据库
```bash
cd database
python init_db.py
```

3. 启动后端服务
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

4. 启动前端服务
```bash
cd frontend
npm install
npm run dev
```

5. 配置数据采集器
```bash
cd collector
pip install -r requirements.txt
# 添加到crontab: */5 * * * * /path/to/python /path/to/collector/main.py
```

## API文档

后端服务启动后，访问 http://localhost:8000/docs 查看API文档。

## 默认账户

- 用户名: admin
- 密码: admin123

首次登录后请立即修改密码。
# monitor
