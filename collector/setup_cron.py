#!/usr/bin/env python3
"""
设置cron定时任务的脚本
"""

import os
import subprocess
from pathlib import Path

def setup_cron_job():
    """设置cron定时任务"""
    # 获取项目路径
    project_root = Path(__file__).parent.parent.absolute()
    collector_script = project_root / "collector" / "tcp_probe.py"
    
    # 获取conda环境路径
    conda_env = os.environ.get('CONDA_DEFAULT_ENV', 'monitor')
    
    # cron任务命令
    cron_command = f"*/5 * * * * /root/miniconda3/envs/{conda_env}/bin/python {collector_script} >> {project_root}/collector.log 2>&1"
    
    print("准备添加以下cron任务:")
    print(cron_command)
    print()
    
    # 询问用户确认
    response = input("是否添加此cron任务? (y/N): ")
    if response.lower() != 'y':
        print("取消添加cron任务")
        return
    
    try:
        # 获取当前crontab
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        current_crontab = result.stdout if result.returncode == 0 else ""
        
        # 检查是否已存在相同任务
        if "tcp_probe.py" in current_crontab:
            print("检测到已存在TCP探测任务，正在更新...")
            # 移除旧任务
            lines = current_crontab.split('\n')
            new_lines = [line for line in lines if "tcp_probe.py" not in line and line.strip()]
        else:
            new_lines = [line for line in current_crontab.split('\n') if line.strip()]
        
        # 添加新任务
        new_lines.append(cron_command)
        new_crontab = '\n'.join(new_lines) + '\n'
        
        # 写入新的crontab
        process = subprocess.Popen(['crontab', '-'], stdin=subprocess.PIPE, text=True)
        process.communicate(input=new_crontab)
        
        if process.returncode == 0:
            print("✓ Cron任务添加成功!")
            print("TCP探测器将每5分钟执行一次")
            print(f"日志文件: {project_root}/collector.log")
        else:
            print("✗ 添加cron任务失败")
            
    except Exception as e:
        print(f"设置cron任务时出错: {e}")

def show_current_cron():
    """显示当前的cron任务"""
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode == 0:
            print("当前的cron任务:")
            print(result.stdout)
        else:
            print("没有找到cron任务")
    except Exception as e:
        print(f"查看cron任务时出错: {e}")

def remove_cron_job():
    """移除TCP探测的cron任务"""
    try:
        result = subprocess.run(['crontab', '-l'], capture_output=True, text=True)
        if result.returncode != 0:
            print("没有找到cron任务")
            return
        
        current_crontab = result.stdout
        lines = current_crontab.split('\n')
        new_lines = [line for line in lines if "tcp_probe.py" not in line and line.strip()]
        
        if len(new_lines) == len([line for line in lines if line.strip()]):
            print("没有找到TCP探测相关的cron任务")
            return
        
        new_crontab = '\n'.join(new_lines) + '\n' if new_lines else ''
        
        process = subprocess.Popen(['crontab', '-'], stdin=subprocess.PIPE, text=True)
        process.communicate(input=new_crontab)
        
        if process.returncode == 0:
            print("✓ TCP探测cron任务已移除")
        else:
            print("✗ 移除cron任务失败")
            
    except Exception as e:
        print(f"移除cron任务时出错: {e}")

if __name__ == "__main__":
    print("TCP端口监控 - Cron任务管理")
    print("=" * 40)
    print("1. 添加/更新cron任务")
    print("2. 查看当前cron任务")
    print("3. 移除TCP探测cron任务")
    print("4. 退出")
    
    while True:
        choice = input("\n请选择操作 (1-4): ").strip()
        
        if choice == '1':
            setup_cron_job()
        elif choice == '2':
            show_current_cron()
        elif choice == '3':
            remove_cron_job()
        elif choice == '4':
            print("退出")
            break
        else:
            print("无效选择，请输入1-4")
