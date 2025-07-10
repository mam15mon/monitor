"""
监控目标管理API路由
"""

import csv
from io import StringIO
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import User, MonitoredTarget
from schemas import (
    MonitoredTargetCreate, MonitoredTargetUpdate, MonitoredTargetResponse,
    BatchAddTargets, BatchDeleteTargets, MessageResponse
)
from auth import get_current_user
from config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE

router = APIRouter(prefix="/targets", tags=["监控目标"])

@router.get("/", response_model=List[MonitoredTargetResponse], summary="获取监控目标列表")
async def get_targets(
    skip: int = Query(0, ge=0, description="跳过的记录数"),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="返回的记录数"),
    region: Optional[str] = Query(None, description="按区域筛选"),
    is_active: Optional[bool] = Query(None, description="按状态筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取监控目标列表"""
    query = db.query(MonitoredTarget)
    
    if region:
        query = query.filter(MonitoredTarget.region == region)
    
    if is_active is not None:
        query = query.filter(MonitoredTarget.is_active == is_active)
    
    targets = query.offset(skip).limit(limit).all()
    return targets

@router.post("/", response_model=MonitoredTargetResponse, summary="添加监控目标")
async def create_target(
    target: MonitoredTargetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """添加单个监控目标"""
    db_target = MonitoredTarget(**target.dict())
    
    try:
        db.add(db_target)
        db.commit()
        db.refresh(db_target)
        return db_target
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"监控目标 {target.public_ip}:{target.port} 已存在"
        )

@router.put("/{target_id}", response_model=MonitoredTargetResponse, summary="更新监控目标")
async def update_target(
    target_id: int,
    target_update: MonitoredTargetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """更新监控目标"""
    db_target = db.query(MonitoredTarget).filter(MonitoredTarget.id == target_id).first()
    if not db_target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="监控目标不存在"
        )
    
    # 更新字段
    update_data = target_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_target, field, value)
    
    try:
        db.commit()
        db.refresh(db_target)
        return db_target
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="IP和端口组合已存在"
        )

@router.delete("/{target_id}", response_model=MessageResponse, summary="删除监控目标")
async def delete_target(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """删除单个监控目标"""
    db_target = db.query(MonitoredTarget).filter(MonitoredTarget.id == target_id).first()
    if not db_target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="监控目标不存在"
        )
    
    db.delete(db_target)
    db.commit()
    
    return MessageResponse(message="监控目标删除成功")

@router.post("/batch-add", response_model=MessageResponse, summary="批量添加监控目标")
async def batch_add_targets(
    batch_data: BatchAddTargets,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    批量添加监控目标
    CSV格式: region,public_ip,port,business_system,internal_ip,internal_port
    """
    try:
        # 解析CSV数据
        csv_file = StringIO(batch_data.csv_data)
        reader = csv.DictReader(csv_file)
        
        added_count = 0
        error_count = 0
        errors = []
        
        for row_num, row in enumerate(reader, start=2):  # 从第2行开始（第1行是标题）
            try:
                # 验证必需字段
                if not all([row.get('region'), row.get('public_ip'), row.get('port')]):
                    errors.append(f"第{row_num}行: 缺少必需字段")
                    error_count += 1
                    continue
                
                # 创建目标对象
                target_data = {
                    'region': row['region'].strip(),
                    'public_ip': row['public_ip'].strip(),
                    'port': int(row['port']),
                    'business_system': row.get('business_system', '').strip() or None,
                    'internal_ip': row.get('internal_ip', '').strip() or None,
                    'internal_port': int(row['internal_port']) if row.get('internal_port', '').strip() else None,
                    'is_active': True
                }
                
                db_target = MonitoredTarget(**target_data)
                db.add(db_target)
                db.commit()
                added_count += 1
                
            except ValueError as e:
                errors.append(f"第{row_num}行: 数据格式错误 - {str(e)}")
                error_count += 1
                db.rollback()
            except IntegrityError:
                errors.append(f"第{row_num}行: {row.get('public_ip')}:{row.get('port')} 已存在")
                error_count += 1
                db.rollback()
            except Exception as e:
                errors.append(f"第{row_num}行: {str(e)}")
                error_count += 1
                db.rollback()
        
        message = f"批量添加完成: 成功 {added_count} 个，失败 {error_count} 个"
        if errors:
            message += f"\n错误详情:\n" + "\n".join(errors[:10])  # 只显示前10个错误
            if len(errors) > 10:
                message += f"\n... 还有 {len(errors) - 10} 个错误"
        
        return MessageResponse(message=message, success=error_count == 0)
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV解析失败: {str(e)}"
        )

@router.post("/batch-delete", response_model=MessageResponse, summary="批量删除监控目标")
async def batch_delete_targets(
    batch_data: BatchDeleteTargets,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """批量删除监控目标"""
    deleted_count = db.query(MonitoredTarget).filter(
        MonitoredTarget.id.in_(batch_data.target_ids)
    ).delete(synchronize_session=False)
    
    db.commit()
    
    return MessageResponse(
        message=f"成功删除 {deleted_count} 个监控目标",
        success=True
    )

@router.patch("/{target_id}/toggle-status", response_model=MonitoredTargetResponse, summary="切换监控目标状态")
async def toggle_target_status(
    target_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """切换监控目标的启用/禁用状态"""
    db_target = db.query(MonitoredTarget).filter(MonitoredTarget.id == target_id).first()
    if not db_target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="监控目标不存在"
        )
    
    # 切换状态
    db_target.is_active = not db_target.is_active
    
    try:
        db.commit()
        db.refresh(db_target)
        return db_target
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"状态切换失败: {str(e)}"
        )

@router.get("/regions", summary="获取所有区域列表")
async def get_regions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取所有区域列表"""
    regions = db.query(MonitoredTarget.region).distinct().all()
    return [region[0] for region in regions]
