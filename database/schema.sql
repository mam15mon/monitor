-- TCP端口监控平台数据库结构
-- 使用SQLite数据库

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 监控目标表
CREATE TABLE IF NOT EXISTS monitored_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region VARCHAR(100) NOT NULL,
    public_ip VARCHAR(45) NOT NULL,
    port INTEGER NOT NULL,
    business_system VARCHAR(255),
    internal_ip VARCHAR(45),
    internal_port INTEGER,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(public_ip, port)
);

-- TCP探测结果表 (时序数据)
CREATE TABLE IF NOT EXISTS tcp_probe_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_id INTEGER NOT NULL,
    region VARCHAR(100) NOT NULL,
    public_ip VARCHAR(45) NOT NULL,
    port INTEGER NOT NULL,
    latency_ms REAL,  -- 延迟毫秒数，-1表示连接失败
    is_successful BOOLEAN NOT NULL,  -- 连接是否成功
    probe_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (target_id) REFERENCES monitored_targets(id) ON DELETE CASCADE
);

-- 为查询性能创建索引
CREATE INDEX IF NOT EXISTS idx_tcp_probe_results_target_id ON tcp_probe_results(target_id);
CREATE INDEX IF NOT EXISTS idx_tcp_probe_results_probe_time ON tcp_probe_results(probe_time);
CREATE INDEX IF NOT EXISTS idx_tcp_probe_results_region ON tcp_probe_results(region);
CREATE INDEX IF NOT EXISTS idx_tcp_probe_results_target_time ON tcp_probe_results(target_id, probe_time);

-- 用户表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 监控目标表更新时间触发器
CREATE TRIGGER IF NOT EXISTS update_monitored_targets_updated_at 
    AFTER UPDATE ON monitored_targets
    FOR EACH ROW
BEGIN
    UPDATE monitored_targets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 插入默认管理员用户 (密码: admin123)
INSERT OR IGNORE INTO users (username, password_hash, is_active) 
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj3L6V.2Oa2u', 1);

-- 插入示例监控目标
INSERT OR IGNORE INTO monitored_targets (region, public_ip, port, business_system) VALUES
('北京', '8.8.8.8', 53, 'Google DNS'),
('上海', '1.1.1.1', 53, 'Cloudflare DNS'),
('广州', '114.114.114.114', 53, '114 DNS'),
('深圳', '223.5.5.5', 53, '阿里DNS'),
('新加坡', '8.8.4.4', 53, 'Google DNS Secondary');
