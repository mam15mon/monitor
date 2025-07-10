"""
TCP端口监控平台后端主应用
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config import APP_NAME, APP_VERSION, DEBUG, ALLOWED_ORIGINS
from database import init_db
from routers import auth, targets, stats, users

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

@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    # 初始化数据库表（如果不存在）
    init_db()
    print(f"{APP_NAME} v{APP_VERSION} 启动成功!")

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
