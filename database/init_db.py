#!/usr/bin/env python3
"""
数据库初始化脚本
创建SQLite数据库并初始化表结构
"""

import sqlite3
import os
import sys
from pathlib import Path

# 获取项目根目录
PROJECT_ROOT = Path(__file__).parent.parent
DATABASE_PATH = PROJECT_ROOT / "monitor.db"
SCHEMA_PATH = Path(__file__).parent / "schema.sql"

def init_database():
    """初始化数据库"""
    try:
        # 如果数据库文件已存在，询问是否重新创建
        if DATABASE_PATH.exists():
            response = input(f"数据库文件 {DATABASE_PATH} 已存在，是否重新创建？(y/N): ")
            if response.lower() != 'y':
                print("取消初始化")
                return False
            
            # 备份现有数据库
            backup_path = DATABASE_PATH.with_suffix('.db.backup')
            DATABASE_PATH.rename(backup_path)
            print(f"已备份现有数据库到: {backup_path}")
        
        # 读取SQL schema文件
        if not SCHEMA_PATH.exists():
            print(f"错误: 找不到schema文件: {SCHEMA_PATH}")
            return False
        
        with open(SCHEMA_PATH, 'r', encoding='utf-8') as f:
            schema_sql = f.read()
        
        # 创建数据库连接
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 执行schema
        cursor.executescript(schema_sql)
        conn.commit()
        
        # 验证表是否创建成功
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        print("数据库初始化成功!")
        print(f"数据库文件: {DATABASE_PATH}")
        print("创建的表:")
        for table in tables:
            print(f"  - {table[0]}")
        
        # 检查默认用户是否创建成功
        cursor.execute("SELECT username FROM users WHERE username='admin';")
        admin_user = cursor.fetchone()
        if admin_user:
            print("\n默认管理员账户已创建:")
            print("  用户名: admin")
            print("  密码: admin123")
            print("  请首次登录后立即修改密码!")
        
        # 检查示例数据
        cursor.execute("SELECT COUNT(*) FROM monitored_targets;")
        target_count = cursor.fetchone()[0]
        print(f"\n已添加 {target_count} 个示例监控目标")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"数据库错误: {e}")
        return False
    except Exception as e:
        print(f"初始化失败: {e}")
        return False

def check_database():
    """检查数据库状态"""
    if not DATABASE_PATH.exists():
        print(f"数据库文件不存在: {DATABASE_PATH}")
        return False
    
    try:
        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        
        # 检查表结构
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [table[0] for table in cursor.fetchall()]
        
        required_tables = ['users', 'monitored_targets', 'tcp_probe_results']
        missing_tables = [table for table in required_tables if table not in tables]
        
        if missing_tables:
            print(f"缺少必要的表: {missing_tables}")
            return False
        
        print("数据库状态正常")
        print(f"数据库文件: {DATABASE_PATH}")
        print(f"包含表: {', '.join(tables)}")
        
        # 显示统计信息
        cursor.execute("SELECT COUNT(*) FROM users;")
        user_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM monitored_targets WHERE is_active=1;")
        active_targets = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM tcp_probe_results;")
        probe_count = cursor.fetchone()[0]
        
        print(f"\n统计信息:")
        print(f"  用户数: {user_count}")
        print(f"  活跃监控目标: {active_targets}")
        print(f"  探测记录数: {probe_count}")
        
        conn.close()
        return True
        
    except sqlite3.Error as e:
        print(f"数据库检查失败: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "check":
        check_database()
    else:
        init_database()
