from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import User
from auth import get_current_user
from fastapi import status
from pydantic import BaseModel

router = APIRouter(prefix="/settings", tags=["系统设置"])

class ProbeIntervalRequest(BaseModel):
    value: int

@router.get("/probe-interval", summary="获取全局探测频率（秒）")
def get_probe_interval(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    row = db.execute(text("SELECT value FROM settings WHERE key='probe_interval'")).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="未设置探测频率")
    return {"probe_interval": int(row[0])}

@router.post("/probe-interval", summary="设置全局探测频率（秒）")
def set_probe_interval(
    req: ProbeIntervalRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    value = req.value
    if value < 10 or value > 86400:
        raise HTTPException(status_code=400, detail="探测频率应在10~86400秒之间")
    db.execute(text("INSERT OR REPLACE INTO settings (key, value) VALUES ('probe_interval', :v)"), {"v": str(value)})
    db.commit()
    return {"probe_interval": value}

@router.get("/task-status", summary="获取定时任务状态")
def get_task_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    result = db.execute(text("SELECT value FROM settings WHERE key='task_status'"))
    row = result.fetchone()
    status = row[0] if row else 'stopped'
    return {"task_status": status}

@router.post("/task-status", summary="设置定时任务状态")
def set_task_status(
    req: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    status = req.get('status')
    if status not in ['running', 'stopped']:
        raise HTTPException(status_code=400, detail="状态只能为 running 或 stopped")
    db.execute(text("INSERT OR REPLACE INTO settings (key, value) VALUES ('task_status', :v)"), {"v": status})
    db.commit()
    return {"task_status": status} 