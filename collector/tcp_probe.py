#!/usr/bin/env python3
"""
TCP端口探测器
独立的数据采集脚本，定期探测监控目标并存储结果
"""

import asyncio
import socket
import time
import sqlite3
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional
import logging

# 添加项目根目录到路径
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.append(str(PROJECT_ROOT))

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(PROJECT_ROOT / 'collector.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# 数据库路径
DATABASE_PATH = PROJECT_ROOT / "monitor.db"

class TCPProbe:
    """TCP探测器类"""
    
    def __init__(self, timeout: float = 3.0, max_concurrent: int = 50):
        self.timeout = timeout
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
    
    async def probe_target(self, target_id: int, region: str, ip: str, port: int) -> Tuple[int, str, str, int, Optional[float], bool]:
        """
        探测单个目标
        返回: (target_id, region, ip, port, latency_ms, is_successful)
        """
        async with self.semaphore:
            start_time = time.time()
            
            try:
                # 创建socket连接
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(ip, port),
                    timeout=self.timeout
                )
                
                # 连接成功，立即关闭
                writer.close()
                await writer.wait_closed()
                
                end_time = time.time()
                latency_ms = (end_time - start_time) * 1000
                
                logger.debug(f"探测成功: {ip}:{port} - {latency_ms:.2f}ms")
                return (target_id, region, ip, port, latency_ms, True)
                
            except asyncio.TimeoutError:
                logger.debug(f"探测超时: {ip}:{port}")
                return (target_id, region, ip, port, -1, False)
            except Exception as e:
                logger.debug(f"探测失败: {ip}:{port} - {str(e)}")
                return (target_id, region, ip, port, -1, False)
    
    async def probe_all_targets(self, targets: List[Tuple[int, str, str, int]]) -> List[Tuple]:
        """
        并发探测所有目标
        """
        tasks = []
        for target_id, region, ip, port in targets:
            task = self.probe_target(target_id, region, ip, port)
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # 过滤异常结果
        valid_results = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"探测任务异常: {result}")
            else:
                valid_results.append(result)
        
        return valid_results

class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self, db_path: Path):
        self.db_path = db_path
    
    def get_active_targets(self) -> List[Tuple[int, str, str, int]]:
        """获取所有活跃的监控目标"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id, region, public_ip, port 
                FROM monitored_targets 
                WHERE is_active = 1
            """)
            
            targets = cursor.fetchall()
            conn.close()
            
            logger.info(f"获取到 {len(targets)} 个活跃监控目标")
            return targets
            
        except Exception as e:
            logger.error(f"获取监控目标失败: {e}")
            return []
    
    def save_probe_results(self, results: List[Tuple]) -> bool:
        """保存探测结果到数据库"""
        if not results:
            logger.warning("没有探测结果需要保存")
            return True
        
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # 准备插入数据
            insert_data = []
            for target_id, region, ip, port, latency_ms, is_successful in results:
                insert_data.append((
                    target_id, region, ip, port, 
                    latency_ms, is_successful, datetime.utcnow()
                ))
            
            # 批量插入
            cursor.executemany("""
                INSERT INTO tcp_probe_results 
                (target_id, region, public_ip, port, latency_ms, is_successful, probe_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, insert_data)
            
            conn.commit()
            conn.close()
            
            logger.info(f"成功保存 {len(results)} 条探测结果")
            return True
            
        except Exception as e:
            logger.error(f"保存探测结果失败: {e}")
            return False

async def main():
    """主函数"""
    logger.info("开始TCP端口探测任务")
    
    # 检查数据库文件是否存在
    if not DATABASE_PATH.exists():
        logger.error(f"数据库文件不存在: {DATABASE_PATH}")
        logger.error("请先运行 'python database/init_db.py' 初始化数据库")
        return
    
    # 初始化组件
    db_manager = DatabaseManager(DATABASE_PATH)
    tcp_probe = TCPProbe(timeout=3.0, max_concurrent=50)
    
    # 获取监控目标
    targets = db_manager.get_active_targets()
    if not targets:
        logger.warning("没有找到活跃的监控目标")
        return
    
    # 执行探测
    start_time = time.time()
    results = await tcp_probe.probe_all_targets(targets)
    end_time = time.time()
    
    # 统计结果
    successful_count = sum(1 for _, _, _, _, _, is_successful in results if is_successful)
    total_count = len(results)
    success_rate = (successful_count / total_count * 100) if total_count > 0 else 0
    
    logger.info(f"探测完成: {total_count} 个目标, 成功 {successful_count} 个 ({success_rate:.1f}%), 耗时 {end_time - start_time:.2f}s")
    
    # 保存结果
    if db_manager.save_probe_results(results):
        logger.info("探测任务完成")
    else:
        logger.error("保存结果失败")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("探测任务被用户中断")
    except Exception as e:
        logger.error(f"探测任务异常: {e}")
        sys.exit(1)
