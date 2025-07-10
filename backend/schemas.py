"""
Pydantic模式定义
用于API请求和响应的数据验证
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
import re

# 用户相关模式
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)
    is_active: Optional[bool] = True

class UserLogin(BaseModel):
    username: str
    password: str
    totp_code: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    has_totp: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    password: Optional[str] = Field(None, min_length=6)
    is_active: Optional[bool] = None

class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

# TOTP相关模式
class TOTPEnable(BaseModel):
    password: str

class TOTPVerify(BaseModel):
    totp_code: str = Field(..., min_length=6, max_length=6)

class TOTPResponse(BaseModel):
    secret: str
    qr_code_url: str

# 监控目标相关模式
class MonitoredTargetBase(BaseModel):
    region: str = Field(..., max_length=100)
    public_ip: str = Field(..., max_length=45)
    port: int = Field(..., ge=1, le=65535)
    business_system: Optional[str] = Field(None, max_length=255)
    internal_ip: Optional[str] = Field(None, max_length=45)
    internal_port: Optional[int] = Field(None, ge=1, le=65535)
    is_active: bool = True
    
    @validator('public_ip', 'internal_ip')
    def validate_ip(cls, v):
        if v is None:
            return v
        # 简单的IP地址格式验证
        ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if not re.match(ip_pattern, v):
            raise ValueError('Invalid IP address format')
        return v

class MonitoredTargetCreate(MonitoredTargetBase):
    pass

class MonitoredTargetUpdate(BaseModel):
    region: Optional[str] = Field(None, max_length=100)
    public_ip: Optional[str] = Field(None, max_length=45)
    port: Optional[int] = Field(None, ge=1, le=65535)
    business_system: Optional[str] = Field(None, max_length=255)
    internal_ip: Optional[str] = Field(None, max_length=45)
    internal_port: Optional[int] = Field(None, ge=1, le=65535)
    is_active: Optional[bool] = None

class MonitoredTargetResponse(MonitoredTargetBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# 批量操作模式
class BatchAddTargets(BaseModel):
    csv_data: str = Field(..., description="CSV格式的目标数据")

class BatchDeleteTargets(BaseModel):
    target_ids: List[int] = Field(..., min_items=1)

# 探测结果相关模式
class ProbeResultResponse(BaseModel):
    id: int
    target_id: int
    region: str
    public_ip: str
    port: int
    latency_ms: Optional[float]
    is_successful: bool
    probe_time: datetime
    
    class Config:
        from_attributes = True

# 统计数据模式
class TargetStats(BaseModel):
    target_id: int
    region: str
    public_ip: str
    port: int
    business_system: Optional[str]
    avg_latency_ms: Optional[float]
    packet_loss_rate: float
    total_probes: int
    successful_probes: int

class StatsResponse(BaseModel):
    targets: List[TargetStats]
    time_range: str
    region_filter: Optional[str]
    total_targets: int

# 通用响应模式
class MessageResponse(BaseModel):
    message: str
    success: bool = True

# JWT Token模式
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int

class TokenData(BaseModel):
    username: Optional[str] = None
