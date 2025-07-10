# TCP端口监控平台

## 项目简介
本项目是一个基于 FastAPI + React 的全栈 TCP 端口监控平台，支持多目标网络质量监控、数据可视化、用户管理、定时任务自动探测、历史数据自动清理等功能。

## 主要功能
- 支持添加/编辑/删除监控目标（支持IP或域名）
- 实时监控端口连通性、延迟、丢包率等
- 前端可视化展示监控统计
- 支持双因子认证、用户管理
- 支持全局探测频率和定时任务开关，前端可控
- 自动清理30天前历史探测数据
- 一键启动前后端，部署简单

## 目录结构
```
monitor/
  backend/      # FastAPI后端服务
  collector/    # 旧版采集脚本（已集成到后端，可删除）
  database/     # 数据库初始化、脚本
  frontend/     # React前端项目
  monitor.db    # SQLite数据库文件
  README.md     # 项目说明
```

## 快速启动
### 1. 安装依赖
- 安装 Node.js、Python 3.8+
- 全局安装 pnpm（如未安装）：
  ```bash
  npm install -g pnpm
  ```
- 设置 pnpm 淘宝源（推荐国内用户）：
  ```bash
  pnpm config set registry https://registry.npmmirror.com
  ```
- 安装前端依赖：
  ```bash
  cd frontend
  pnpm install
  pnpm add -D concurrently
  ```
- 安装后端依赖：
  ```bash
  cd ../backend
  pip install -r requirements.txt
  ```

### 2. 初始化数据库
```bash
cd ../database
sqlite3 ../monitor.db < schema.sql
```

### 3. 一键启动前后端
```bash
cd ../frontend
pnpm dev
```
- 前端访问：http://localhost:3000
- 后端API：http://localhost:8000/docs

### 4. 默认账号
- 用户名：admin
- 密码：admin123

## 常用命令
- 启动前端：`pnpm start`（在 frontend 目录）
- 启动后端：`pnpm backend`（在 frontend 目录）
- 一键启动：`pnpm dev`（在 frontend 目录）
- 重置管理员密码：`python database/reset_admin_password.py`

## 依赖环境
- Python 3.8+
- Node.js 18+
- pnpm 8+
- 详见 backend/requirements.txt

## 常见问题
- **依赖安装慢/失败**：请务必设置 pnpm 淘宝源
- **端口探测全部失败**：请检查本机网络环境和目标端口是否可达
- **密码无法登录**：请用 reset_admin_password.py 脚本重置
- **数据库膨胀**：系统已自动清理30天前历史数据

---
如有问题请提交 issue 或联系开发者。
