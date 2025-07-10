"""
数据库配置
"""

import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.parent

# 数据库文件路径
DATABASE_PATH = PROJECT_ROOT / "monitor.db"

# 数据库连接字符串
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

# 数据库配置
DATABASE_CONFIG = {
    "path": str(DATABASE_PATH),
    "url": DATABASE_URL,
    "check_same_thread": False,  # SQLite配置，允许多线程访问
    "timeout": 30,  # 连接超时时间（秒）
}

# 确保数据库目录存在
DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
