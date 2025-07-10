"""
后端配置文件
"""

import os
from pathlib import Path
from decouple import config

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent

# 数据库配置
DATABASE_PATH = PROJECT_ROOT / "monitor.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# JWT配置
SECRET_KEY = config("SECRET_KEY", default="your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# CORS配置
# 开发环境允许所有来源，生产环境需要配置具体域名
DEBUG = config("DEBUG", default=True, cast=bool)
if DEBUG:
    ALLOWED_ORIGINS = ["*"]  # 开发环境允许所有来源
else:
    ALLOWED_ORIGINS = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ]

# 应用配置
APP_NAME = "TCP端口监控平台"
APP_VERSION = "1.0.0"

# 分页配置
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 1000  # 增加最大页面大小以支持管理页面显示所有目标

# 数据导出配置
EXPORT_MAX_RECORDS = 10000

# 时间范围配置（天数）
TIME_RANGES = {
    "1d": 1,
    "7d": 7,
    "1M": 30,
    "3M": 90,
    "6M": 180,
    "1Y": 365,
}
