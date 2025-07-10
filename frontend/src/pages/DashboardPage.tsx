import React, { useState, useEffect } from 'react';
import {
  Layout, Card, Table, Select, Button, Space, Statistic, Row, Col,
  message, Typography, Tag, Tooltip
} from 'antd';
import {
  DownloadOutlined, ReloadOutlined, DashboardOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import moment from 'moment';
import { useNavigate } from 'react-router-dom';

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;

interface TargetStats {
  target_id: number;
  region: string;
  public_ip: string;
  port: number;
  business_system: string;
  avg_latency_ms: number;
  packet_loss_rate: number;
  total_probes: number;
  successful_probes: number;
}

interface StatsResponse {
  targets: TargetStats[];
  time_range: string;
  region_filter: string;
  total_targets: number;
}

interface Summary {
  total_targets: number;
  recent_probes_24h: number;
  success_rate_24h: number;
  regions: { region: string; count: number }[];
}

const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [regionFilter, setRegionFilter] = useState('all');
  const [regions, setRegions] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    fetchSummary();
    fetchRegions();
  }, [timeRange, regionFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { time_range: timeRange };
      if (regionFilter !== 'all') {
        params.region = regionFilter;
      }
      
      const response = await axios.get('/api/stats/', { params });
      setStats(response.data);
    } catch (error: any) {
      message.error('获取数据失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get('/api/stats/summary');
      setSummary(response.data);
    } catch (error: any) {
      console.error('获取摘要数据失败:', error);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await axios.get('/api/targets/regions');
      setRegions(response.data);
    } catch (error: any) {
      console.error('获取区域列表失败:', error);
    }
  };

  const handleExport = async () => {
    try {
      const params: any = { time_range: timeRange };
      if (regionFilter !== 'all') {
        params.region = regionFilter;
      }
      
      const response = await axios.get('/api/stats/export', {
        params,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `monitor_stats_${timeRange}_${moment().format('YYYYMMDD_HHmmss')}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      message.success('数据导出成功！');
    } catch (error: any) {
      message.error('导出失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const columns = [
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      width: 100,
      sorter: (a: any, b: any) => a.region.localeCompare(b.region),
    },
    {
      title: '公网IP',
      dataIndex: 'public_ip',
      key: 'public_ip',
      width: 120,
      sorter: (a: any, b: any) => a.public_ip.localeCompare(b.public_ip),
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
      sorter: (a: any, b: any) => a.port - b.port,
    },
    {
      title: '业务系统',
      dataIndex: 'business_system',
      key: 'business_system',
      width: 150,
      render: (text: string) => text || '-',
      sorter: (a: any, b: any) => (a.business_system || '').localeCompare(b.business_system || ''),
    },
    {
      title: '平均延迟(ms)',
      dataIndex: 'avg_latency_ms',
      key: 'avg_latency_ms',
      width: 120,
      render: (value: number) => {
        if (value === null || value === undefined) return '-';
        const color = value < 50 ? 'green' : value < 200 ? 'orange' : 'red';
        return <Tag color={color}>{value.toFixed(2)}</Tag>;
      },
      sorter: (a: any, b: any) => (a.avg_latency_ms || 0) - (b.avg_latency_ms || 0),
    },
    {
      title: '丢包率(%)',
      dataIndex: 'packet_loss_rate',
      key: 'packet_loss_rate',
      width: 100,
      render: (value: number) => {
        const color = value === 0 ? 'green' : value < 10 ? 'orange' : 'red';
        return <Tag color={color}>{value.toFixed(2)}%</Tag>;
      },
      sorter: (a: any, b: any) => (a.packet_loss_rate || 0) - (b.packet_loss_rate || 0),
    },
    {
      title: '探测次数',
      dataIndex: 'total_probes',
      key: 'total_probes',
      width: 100,
      sorter: (a: any, b: any) => (a.total_probes || 0) - (b.total_probes || 0),
    },
    {
      title: '成功次数',
      dataIndex: 'successful_probes',
      key: 'successful_probes',
      width: 100,
      sorter: (a: any, b: any) => (a.successful_probes || 0) - (b.successful_probes || 0),
    },
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (record: any) => {
        const isHealthy = record.packet_loss_rate < 5 && (record.avg_latency_ms || 0) < 200;
        return isHealthy ? 
          <CheckCircleOutlined style={{ color: 'green', fontSize: 16 }} /> :
          <CloseCircleOutlined style={{ color: 'red', fontSize: 16 }} />;
      },
      sorter: (a: any, b: any) => {
        // 绿色健康优先
        const aHealthy = a.packet_loss_rate < 5 && (a.avg_latency_ms || 0) < 200;
        const bHealthy = b.packet_loss_rate < 5 && (b.avg_latency_ms || 0) < 200;
        return Number(bHealthy) - Number(aHealthy);
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff', 
        padding: '0 24px', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <DashboardOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            TCP端口监控平台
          </Title>
        </div>
        <Space>
          <span>欢迎, {user?.username}</span>
          <Button onClick={() => navigate('/admin')}>管理</Button>
          <Button onClick={logout}>退出</Button>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        {/* 统计卡片 */}
        {summary && (
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card>
                <Statistic
                  title="监控目标总数"
                  value={summary.total_targets}
                  prefix={<DashboardOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="24小时探测次数"
                  value={summary.recent_probes_24h}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="24小时成功率"
                  value={summary.success_rate_24h}
                  suffix="%"
                  precision={2}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: summary.success_rate_24h > 95 ? '#3f8600' : '#cf1322' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="监控区域数"
                  value={summary.regions.length}
                  prefix={<DashboardOutlined />}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* 筛选和操作栏 */}
        <Card style={{ marginBottom: 24 }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space>
                <span>时间范围:</span>
                <Select value={timeRange} onChange={setTimeRange} style={{ width: 120 }}>
                  <Option value="1d">最近1天</Option>
                  <Option value="7d">最近7天</Option>
                  <Option value="1M">最近1月</Option>
                  <Option value="3M">最近3月</Option>
                </Select>
                
                <span>区域:</span>
                <Select value={regionFilter} onChange={setRegionFilter} style={{ width: 120 }}>
                  <Option value="all">全部区域</Option>
                  {regions.map(region => (
                    <Option key={region} value={region}>{region}</Option>
                  ))}
                </Select>
              </Space>
            </Col>
            <Col>
              <Space>
                <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
                  刷新
                </Button>
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />} 
                  onClick={handleExport}
                >
                  导出数据
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        {/* 数据表格 */}
        <Card title={`监控统计 (${stats?.total_targets || 0} 个目标)`}>
          <Table
            columns={columns}
            dataSource={stats?.targets || []}
            rowKey="target_id"
            loading={loading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: stats?.targets?.length || 0,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`,
              pageSizeOptions: ['20', '50', '100', '200'],
              onChange: (page, size) => {
                setCurrentPage(page);
                if (size !== pageSize) {
                  setPageSize(size);
                  setCurrentPage(1); // 改变页面大小时重置到第一页
                }
              },
            }}
            scroll={{ x: 1000 }}
          />
        </Card>
      </Content>
    </Layout>
  );
};

export default DashboardPage;
