"""
用户管理相关路由
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from database import get_db
from models import User
from schemas import UserCreate, UserUpdate, UserResponse, MessageResponse
from auth import get_current_user, get_password_hash, verify_password

router = APIRouter(prefix="/api/users", tags=["用户管理"])

def check_admin_permission(current_user: User = Depends(get_current_user)):
    """检查管理员权限"""
    if current_user.username != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="只有管理员可以执行此操作"
        )
    return current_user

@router.get("/", response_model=List[UserResponse], summary="获取用户列表")
async def get_users(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """获取用户列表（仅管理员）"""
    query = db.query(User)
    
    if search:
        query = query.filter(
            or_(
                User.username.contains(search),
            )
        )
    
    users = query.offset(skip).limit(limit).all()
    
    return [
        UserResponse(
            id=user.id,
            username=user.username,
            is_active=user.is_active,
            has_totp=bool(user.totp_secret),
            created_at=user.created_at,
            updated_at=user.updated_at
        )
        for user in users
    ]

@router.post("/", response_model=UserResponse, summary="创建用户")
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """创建新用户（仅管理员）"""
    # 检查用户名是否已存在
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="用户名已存在"
        )
    
    # 创建新用户
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        password_hash=hashed_password,
        is_active=user_data.is_active if user_data.is_active is not None else True
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        is_active=new_user.is_active,
        has_totp=bool(new_user.totp_secret),
        created_at=new_user.created_at,
        updated_at=new_user.updated_at
    )

@router.get("/{user_id}", response_model=UserResponse, summary="获取用户详情")
async def get_user(
    user_id: int,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """获取指定用户详情（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    return UserResponse(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        has_totp=bool(user.totp_secret),
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.put("/{user_id}", response_model=UserResponse, summary="更新用户")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """更新用户信息（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不允许修改admin用户的状态
    if user.username == "admin" and user_data.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能禁用admin用户"
        )
    
    # 更新用户信息
    if user_data.password:
        user.password_hash = get_password_hash(user_data.password)
    
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    
    db.commit()
    db.refresh(user)
    
    return UserResponse(
        id=user.id,
        username=user.username,
        is_active=user.is_active,
        has_totp=bool(user.totp_secret),
        created_at=user.created_at,
        updated_at=user.updated_at
    )

@router.delete("/{user_id}", response_model=MessageResponse, summary="删除用户")
async def delete_user(
    user_id: int,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """删除用户（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 不允许删除admin用户
    if user.username == "admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除admin用户"
        )
    
    # 不允许删除自己
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="不能删除自己"
        )
    
    db.delete(user)
    db.commit()
    
    return MessageResponse(message="用户删除成功")

@router.post("/{user_id}/reset-totp", response_model=MessageResponse, summary="重置用户TOTP")
async def reset_user_totp(
    user_id: int,
    current_user: User = Depends(check_admin_permission),
    db: Session = Depends(get_db)
):
    """重置用户的TOTP设置（仅管理员）"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    user.totp_secret = None
    db.commit()
    
    return MessageResponse(message=f"用户 {user.username} 的TOTP设置已重置")
