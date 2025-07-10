"""
数据库模型定义
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, ForeignKey, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class User(Base):
    """用户模型"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    totp_secret = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

class MonitoredTarget(Base):
    """监控目标模型"""
    __tablename__ = "monitored_targets"
    
    id = Column(Integer, primary_key=True, index=True)
    region = Column(String(100), nullable=False)
    public_ip = Column(String(45), nullable=False)
    port = Column(Integer, nullable=False)
    business_system = Column(String(255), nullable=True)
    internal_ip = Column(String(45), nullable=True)
    internal_port = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    
    # 关系
    probe_results = relationship("TcpProbeResult", back_populates="target", cascade="all, delete-orphan")
    
    # 唯一约束
    __table_args__ = (UniqueConstraint('public_ip', 'port', name='_ip_port_uc'),)

class TcpProbeResult(Base):
    """TCP探测结果模型"""
    __tablename__ = "tcp_probe_results"
    
    id = Column(Integer, primary_key=True, index=True)
    target_id = Column(Integer, ForeignKey("monitored_targets.id", ondelete="CASCADE"), nullable=False)
    region = Column(String(100), nullable=False)
    public_ip = Column(String(45), nullable=False)
    port = Column(Integer, nullable=False)
    latency_ms = Column(Float, nullable=True)  # -1表示连接失败
    is_successful = Column(Boolean, nullable=False)
    probe_time = Column(DateTime, default=func.now(), index=True)
    
    # 关系
    target = relationship("MonitoredTarget", back_populates="probe_results")
