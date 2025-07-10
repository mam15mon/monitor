"""
用户认证相关API路由
"""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import User
from schemas import UserLogin, Token, MessageResponse, PasswordChange, TOTPEnable, TOTPVerify, TOTPResponse
from auth import (
    authenticate_user, create_access_token, get_current_user,
    get_password_hash, verify_password, generate_totp_secret,
    generate_totp_qr_code, verify_totp
)
from config import ACCESS_TOKEN_EXPIRE_MINUTES

router = APIRouter(prefix="/auth", tags=["认证"])

@router.post("/login", summary="用户登录")
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录接口
    - 支持用户名密码登录
    - 首次登录时自动设置TOTP
    - 已设置TOTP的用户需要提供TOTP代码
    """
    # 首先验证用户名和密码
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.password_hash) or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 检查是否需要设置TOTP（首次登录且未设置TOTP）
    if not user.totp_secret:
        # 生成TOTP密钥和二维码
        secret = generate_totp_secret()
        qr_code_url = generate_totp_qr_code(user.username, secret)

        return {
            "requires_totp_setup": True,
            "secret": secret,
            "qr_code_url": qr_code_url,
            "username": user.username
        }

    # 如果已设置TOTP，验证TOTP代码
    if not user_data.totp_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请输入TOTP验证码",
        )

    if not verify_totp(user.totp_secret, user_data.totp_code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="TOTP验证码错误",
        )

    # 生成访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }

@router.post("/setup-totp", summary="完成TOTP设置")
async def setup_totp(
    setup_data: dict,
    db: Session = Depends(get_db)
):
    """
    完成首次TOTP设置
    """
    username = setup_data.get("username")
    secret = setup_data.get("secret")
    totp_code = setup_data.get("totp_code")

    if not all([username, secret, totp_code]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少必要参数"
        )

    # 验证用户
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )

    # 验证TOTP代码
    if not verify_totp(secret, totp_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP验证码错误"
        )

    # 保存TOTP密钥
    user.totp_secret = secret
    db.commit()

    # 生成访问令牌
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "message": "TOTP设置成功"
    }

@router.post("/change-password", response_model=MessageResponse, summary="修改密码")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """修改当前用户密码"""
    # 验证旧密码
    if not verify_password(password_data.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="旧密码错误"
        )
    
    # 更新密码
    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    
    return MessageResponse(message="密码修改成功")

@router.post("/totp/enable", response_model=TOTPResponse, summary="启用TOTP双因子认证")
async def enable_totp(
    totp_data: TOTPEnable,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """为当前用户启用TOTP双因子认证"""
    # 验证密码
    if not verify_password(totp_data.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="密码错误"
        )
    
    # 如果已经启用TOTP，返回错误
    if current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP已经启用"
        )
    
    # 生成TOTP密钥
    secret = generate_totp_secret()
    qr_code_url = generate_totp_qr_code(current_user.username, secret)
    
    # 暂时保存密钥（用户验证后才正式启用）
    current_user.totp_secret = secret
    db.commit()
    
    return TOTPResponse(secret=secret, qr_code_url=qr_code_url)

@router.post("/totp/verify", response_model=MessageResponse, summary="验证并完成TOTP绑定")
async def verify_totp_setup(
    verify_data: TOTPVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """验证TOTP代码并完成绑定"""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="请先启用TOTP"
        )
    
    # 验证TOTP代码
    if not verify_totp(current_user.totp_secret, verify_data.totp_code):
        # 验证失败，清除密钥
        current_user.totp_secret = None
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP验证码错误"
        )
    
    return MessageResponse(message="TOTP双因子认证启用成功")

@router.post("/totp/disable", response_model=MessageResponse, summary="禁用TOTP双因子认证")
async def disable_totp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """禁用当前用户的TOTP双因子认证"""
    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP未启用"
        )
    
    current_user.totp_secret = None
    db.commit()
    
    return MessageResponse(message="TOTP双因子认证已禁用")

@router.get("/me", summary="获取当前用户信息")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """获取当前登录用户的信息"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "is_active": current_user.is_active,
        "has_totp": bool(current_user.totp_secret),
        "created_at": current_user.created_at
    }
