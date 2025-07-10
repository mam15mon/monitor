"""
数据统计和导出API路由
"""

from datetime import datetime, timedelta
from typing import Optional
import csv
from io import StringIO
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case

from database import get_db
from models import User, MonitoredTarget, TcpProbeResult
from schemas import StatsResponse, TargetStats
from auth import get_current_user
from config import TIME_RANGES, EXPORT_MAX_RECORDS

router = APIRouter(prefix="/stats", tags=["数据统计"])

def get_time_range_filter(time_range: str) -> datetime:
    """根据时间范围字符串获取过滤时间"""
    if time_range not in TIME_RANGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"无效的时间范围: {time_range}. 支持的范围: {list(TIME_RANGES.keys())}"
        )
    
    days = TIME_RANGES[time_range]
    return datetime.utcnow() - timedelta(days=days)

@router.get("/", response_model=StatsResponse, summary="获取统计数据")
async def get_stats(
    time_range: str = Query("7d", description="时间范围: 1d, 7d, 1M, 3M, 6M, 1Y"),
    region: Optional[str] = Query(None, description="区域筛选，'all'表示所有区域"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    获取监控统计数据
    - 按目标分组统计平均延迟和丢包率
    - 支持时间范围和区域筛选
    """
    # 获取时间过滤条件
    start_time = get_time_range_filter(time_range)
    
    # 构建查询
    query = db.query(
        TcpProbeResult.target_id,
        TcpProbeResult.region,
        TcpProbeResult.public_ip,
        TcpProbeResult.port,
        MonitoredTarget.business_system,
        func.avg(
            case(
                (TcpProbeResult.is_successful == True, TcpProbeResult.latency_ms),
                else_=None
            )
        ).label('avg_latency_ms'),
        func.count(TcpProbeResult.id).label('total_probes'),
        func.sum(
            case(
                (TcpProbeResult.is_successful == True, 1),
                else_=0
            )
        ).label('successful_probes')
    ).join(
        MonitoredTarget, TcpProbeResult.target_id == MonitoredTarget.id
    ).filter(
        TcpProbeResult.probe_time >= start_time
    ).group_by(
        TcpProbeResult.target_id,
        TcpProbeResult.region,
        TcpProbeResult.public_ip,
        TcpProbeResult.port,
        MonitoredTarget.business_system
    )
    
    # 区域筛选
    if region and region != "all":
        query = query.filter(TcpProbeResult.region == region)
    
    results = query.all()
    
    # 处理统计结果
    target_stats = []
    for result in results:
        packet_loss_rate = 0.0
        if result.total_probes > 0:
            packet_loss_rate = ((result.total_probes - result.successful_probes) / result.total_probes) * 100
        
        target_stats.append(TargetStats(
            target_id=result.target_id,
            region=result.region,
            public_ip=result.public_ip,
            port=result.port,
            business_system=result.business_system,
            avg_latency_ms=round(result.avg_latency_ms, 2) if result.avg_latency_ms else None,
            packet_loss_rate=round(packet_loss_rate, 2),
            total_probes=result.total_probes,
            successful_probes=result.successful_probes
        ))
    
    return StatsResponse(
        targets=target_stats,
        time_range=time_range,
        region_filter=region,
        total_targets=len(target_stats)
    )

@router.get("/export", summary="导出统计数据")
async def export_stats(
    time_range: str = Query("7d", description="时间范围"),
    region: Optional[str] = Query(None, description="区域筛选"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    导出统计数据为CSV格式
    """
    # 获取统计数据
    stats_response = await get_stats(time_range, region, current_user, db)

    if not stats_response.targets:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="没有找到数据"
        )

    # 生成CSV内容
    output = StringIO()
    fieldnames = ["区域", "公网IP", "端口", "业务系统", "平均延迟(ms)", "丢包率(%)", "总探测次数", "成功次数"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)

    # 写入标题行
    writer.writeheader()

    # 写入数据行
    for target in stats_response.targets:
        writer.writerow({
            "区域": target.region,
            "公网IP": target.public_ip,
            "端口": target.port,
            "业务系统": target.business_system or "",
            "平均延迟(ms)": target.avg_latency_ms or 0,
            "丢包率(%)": target.packet_loss_rate,
            "总探测次数": target.total_probes,
            "成功次数": target.successful_probes
        })

    # 生成文件名
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    region_suffix = f"_{region}" if region and region != "all" else "_all"
    filename = f"monitor_stats_{time_range}{region_suffix}_{timestamp}.csv"

    csv_content = output.getvalue()
    output.close()

    return Response(
        content=csv_content.encode('utf-8-sig'),  # 使用utf-8-sig支持中文
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/summary", summary="获取总体统计摘要")
async def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """获取总体统计摘要"""
    # 总目标数
    total_targets = db.query(MonitoredTarget).filter(MonitoredTarget.is_active == True).count()
    
    # 最近24小时的探测数据
    last_24h = datetime.utcnow() - timedelta(hours=24)
    recent_probes = db.query(TcpProbeResult).filter(TcpProbeResult.probe_time >= last_24h).count()
    
    # 最近24小时的成功率
    successful_probes = db.query(TcpProbeResult).filter(
        and_(
            TcpProbeResult.probe_time >= last_24h,
            TcpProbeResult.is_successful == True
        )
    ).count()
    
    success_rate = (successful_probes / recent_probes * 100) if recent_probes > 0 else 0
    
    # 区域统计
    region_stats = db.query(
        MonitoredTarget.region,
        func.count(MonitoredTarget.id).label('count')
    ).filter(
        MonitoredTarget.is_active == True
    ).group_by(MonitoredTarget.region).all()
    
    return {
        "total_targets": total_targets,
        "recent_probes_24h": recent_probes,
        "success_rate_24h": round(success_rate, 2),
        "regions": [{"region": r.region, "count": r.count} for r in region_stats]
    }
