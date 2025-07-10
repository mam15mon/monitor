"""
TCP端口监控平台后端主应用
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
import threading
import socket
from datetime import datetime

from config import APP_NAME, APP_VERSION, DEBUG, ALLOWED_ORIGINS
from database import init_db
from routers import auth, targets, stats, users
from routers import settings

# 创建FastAPI应用
app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="一个用于持续监控指定公网IP和TCP端口网络质量的Web应用平台",
    debug=DEBUG
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api")
app.include_router(targets.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(users.router)
app.include_router(settings.router, prefix="/api")

# TCP探测函数
async def tcp_probe(ip, port, timeout=3):
    loop = asyncio.get_event_loop()
    start = loop.time()
    try:
        fut = loop.run_in_executor(None, lambda: _tcp_connect(ip, port, timeout))
        result = await asyncio.wait_for(fut, timeout=timeout)
        latency = (loop.time() - start) * 1000
        return result, latency
    except Exception:
        return False, -1

def _tcp_connect(ip, port, timeout):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(timeout)
    try:
        s.connect((ip, port))
        s.close()
        return True
    except Exception:
        return False

# 定时任务后台线程（优化版，频率实时生效，集成探测）
async def background_probe_task():
    from database import get_db
    engine = create_engine('sqlite:///../monitor.db', connect_args={"check_same_thread": False})
    tick = 0
    last_interval = 60
    while True:
        with engine.connect() as conn:
            # 获取定时任务状态
            status_row = conn.execute(text("SELECT value FROM settings WHERE key='task_status'"))
            status = status_row.fetchone()
            status = status[0] if status else 'stopped'
            # 获取探测频率
            interval_row = conn.execute(text("SELECT value FROM settings WHERE key='probe_interval'"))
            interval = interval_row.fetchone()
            interval = int(interval[0]) if interval and interval[0].isdigit() else 60
        if interval != last_interval:
            print(f"[定时任务] 探测频率已更新为 {interval} 秒")
            last_interval = interval
            tick = 0  # 频率变更时立即重置计数
        if status == 'running':
            if tick == 0:
                # 清理30天前的历史探测数据
                with engine.connect() as conn:
                    conn.execute(
                        text("DELETE FROM tcp_probe_results WHERE probe_time < datetime('now', '-31 days')")
                    )
                    conn.commit()
                    print("[定时任务] 已清理31天前的历史探测数据")
                # 采集所有启用目标
                with engine.connect() as conn:
                    targets = conn.execute(text("SELECT id, region, public_ip, port FROM monitored_targets WHERE is_active=1")).fetchall()
                print(f"[定时任务] 本轮探测 {len(targets)} 个目标")
                for t in targets:
                    success, latency = await tcp_probe(t.public_ip, t.port)
                    if not success:
                        latency = -1
                    with engine.connect() as conn:
                        conn.execute(
                            text("INSERT INTO tcp_probe_results (target_id, region, public_ip, port, latency_ms, is_successful, probe_time) VALUES (:tid, :region, :ip, :port, :latency, :success, :ptime)"),
                            {"tid": t.id, "region": t.region, "ip": t.public_ip, "port": t.port, "latency": latency, "success": int(success), "ptime": datetime.utcnow()}
                        )
                        conn.commit()
                    print(f"[定时任务] 探测 {t.public_ip}:{t.port} {'成功' if success else '失败'}，延迟: {latency if success else '超时/失败'}ms")
            tick = (tick + 1) % interval
        else:
            if tick != 0:
                print("[定时任务] 已暂停")
            tick = 0
        await asyncio.sleep(1)

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    # 初始化数据库表（如果不存在）
    init_db()
    print(f"{APP_NAME} v{APP_VERSION} 启动成功!")
    # 启动定时任务
    loop = asyncio.get_event_loop()
    loop.create_task(background_probe_task())

@app.get("/", summary="根路径")
async def root():
    """根路径，返回API信息"""
    return {
        "name": APP_NAME,
        "version": APP_VERSION,
        "status": "running",
        "docs_url": "/docs",
        "redoc_url": "/redoc"
    }

@app.get("/health", summary="健康检查")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}

# 全局异常处理
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理器"""
    if DEBUG:
        # 开发模式下显示详细错误信息
        import traceback
        return JSONResponse(
            status_code=500,
            content={
                "detail": str(exc),
                "traceback": traceback.format_exc()
            }
        )
    else:
        # 生产模式下隐藏详细错误信息
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=DEBUG,
        log_level="info"
    )
