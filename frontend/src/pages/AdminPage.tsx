import React, { useState, useEffect } from 'react';
import {
  Layout, Card, Table, Button, Space, message, Modal, Form, Input,
  Typography, Tabs, Upload, Popconfirm, Tag
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined,
  SettingOutlined, UserOutlined, SafetyOutlined, TeamOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import moment from 'moment';

const { Header, Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;
const { TextArea } = Input;

interface MonitoredTarget {
  id: number;
  region: string;
  public_ip: string;
  port: number;
  business_system: string;
  internal_ip: string;
  internal_port: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const AdminPage: React.FC = () => {
  const { user, logout } = useAuth();
  const [targets, setTargets] = useState<MonitoredTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [form] = Form.useForm();
  const [csvData, setCsvData] = useState('');
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [passwordForm] = Form.useForm();
  // 添加编辑相关状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTarget, setEditingTarget] = useState<MonitoredTarget | null>(null);
  const [editForm] = Form.useForm();

  // 全局探测频率相关状态
  const [probeInterval, setProbeInterval] = useState<number>(60);
  const [probeIntervalLoading, setProbeIntervalLoading] = useState(false);
  const [probeIntervalInput, setProbeIntervalInput] = useState<string>('60');

  // 定时任务状态相关
  const [taskStatus, setTaskStatus] = useState<'running' | 'stopped'>('stopped');
  const [taskStatusLoading, setTaskStatusLoading] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchTargets();
  }, []);

  useEffect(() => {
    fetchProbeInterval();
    fetchTaskStatus();
  }, []);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/targets/', {
        params: { limit: 1000 } // 获取所有数据，前端分页
      });
      setTargets(response.data);
    } catch (error: any) {
      message.error('获取监控目标失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAddTarget = async (values: any) => {
    try {
      await axios.post('/api/targets/', values);
      message.success('添加成功！');
      setModalVisible(false);
      form.resetFields();
      fetchTargets();
    } catch (error: any) {
      message.error('添加失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要删除的目标');
      return;
    }

    try {
      await axios.post('/api/targets/batch-delete', {
        target_ids: selectedRowKeys
      });
      message.success(`成功删除 ${selectedRowKeys.length} 个目标`);
      setSelectedRowKeys([]);
      fetchTargets();
    } catch (error: any) {
      message.error('批量删除失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleChangePassword = async (values: any) => {
    try {
      await axios.post('/api/auth/change-password', {
        old_password: values.oldPassword,
        new_password: values.newPassword
      });
      message.success('密码修改成功！');
      setChangePasswordModalVisible(false);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error('密码修改失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleBatchAdd = async () => {
    if (!csvData.trim()) {
      message.warning('请输入CSV数据');
      return;
    }

    try {
      const response = await axios.post('/api/targets/batch-add', {
        csv_data: csvData
      });
      message.success('批量添加完成');
      if (response.data.message) {
        Modal.info({
          title: '批量添加结果',
          content: response.data.message,
          width: 600,
        });
      }
      setUploadModalVisible(false);
      setCsvData('');
      fetchTargets();
    } catch (error: any) {
      message.error('批量添加失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 添加编辑处理函数
  const handleEdit = (record: MonitoredTarget) => {
    setEditingTarget(record);
    editForm.setFieldsValue(record);
    setEditModalVisible(true);
  };

  const handleSaveEdit = async (values: any) => {
    if (!editingTarget) return;
    
    try {
      await axios.put(`/api/targets/${editingTarget.id}`, values);
      message.success('修改成功！');
      setEditModalVisible(false);
      editForm.resetFields();
      setEditingTarget(null);
      fetchTargets();
    } catch (error: any) {
      message.error('修改失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 添加状态切换处理函数
  const handleToggleStatus = async (record: MonitoredTarget) => {
    try {
      await axios.patch(`/api/targets/${record.id}/toggle-status`);
      message.success(`已${record.is_active ? '禁用' : '启用'}监控目标`);
      fetchTargets(); // 刷新数据
    } catch (error: any) {
      message.error('状态切换失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 获取全局探测频率
  const fetchProbeInterval = async () => {
    setProbeIntervalLoading(true);
    try {
      const res = await axios.get('/api/settings/probe-interval');
      setProbeInterval(res.data.probe_interval);
      setProbeIntervalInput(String(res.data.probe_interval));
    } catch (e) {
      message.error('获取探测频率失败');
    } finally {
      setProbeIntervalLoading(false);
    }
  };

  // 修改全局探测频率
  const handleProbeIntervalSave = async () => {
    const value = parseInt(probeIntervalInput, 10);
    if (isNaN(value) || value < 10 || value > 86400) {
      message.error('请输入10~86400之间的秒数');
      return;
    }
    setProbeIntervalLoading(true);
    try {
      await axios.post('/api/settings/probe-interval', { value }, {
        headers: { 'Content-Type': 'application/json' }
      });
      setProbeInterval(value);
      message.success('探测频率已更新');
    } catch (e) {
      message.error('设置探测频率失败');
    } finally {
      setProbeIntervalLoading(false);
    }
  };

  // 获取定时任务状态
  const fetchTaskStatus = async () => {
    setTaskStatusLoading(true);
    try {
      const res = await axios.get('/api/settings/task-status');
      setTaskStatus(res.data.task_status);
    } catch (e) {
      message.error('获取定时任务状态失败');
    } finally {
      setTaskStatusLoading(false);
    }
  };

  // 设置定时任务状态
  const handleTaskStatusChange = async (status: 'running' | 'stopped') => {
    setTaskStatusLoading(true);
    try {
      await axios.post('/api/settings/task-status', { status });
      setTaskStatus(status);
      message.success(`定时任务已${status === 'running' ? '开启' : '关闭'}`);
    } catch (e) {
      message.error('设置定时任务状态失败');
    } finally {
      setTaskStatusLoading(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
      sorter: (a: any, b: any) => a.id - b.id,
    },
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
      title: '内网IP',
      dataIndex: 'internal_ip',
      key: 'internal_ip',
      width: 120,
      render: (text: string) => text || '-',
      sorter: (a: any, b: any) => (a.internal_ip || '').localeCompare(b.internal_ip || ''),
    },
    {
      title: '内网端口',
      dataIndex: 'internal_port',
      key: 'internal_port',
      width: 100,
      render: (text: number) => text || '-',
      sorter: (a: any, b: any) => (a.internal_port || 0) - (b.internal_port || 0),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean, record: MonitoredTarget) => (
        <Tag 
          color={active ? 'green' : 'red'}
          style={{ cursor: 'pointer' }}
          onClick={() => handleToggleStatus(record)}
        >
          {active ? '启用' : '禁用'}
        </Tag>
      ),
      sorter: (a: any, b: any) => Number(a.is_active) - Number(b.is_active),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => moment(text).format('YYYY-MM-DD HH:mm'),
      sorter: (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (record: MonitoredTarget) => (
        <Space>
          <Button 
            type="link" 
            size="small" 
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
  };

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
          <SettingOutlined style={{ fontSize: 24, color: '#1890ff', marginRight: 12 }} />
          <Title level={3} style={{ margin: 0, color: '#1890ff' }}>
            系统管理
          </Title>
        </div>
        <Space>
          <span>管理员: {user?.username}</span>
          <Button onClick={() => navigate('/dashboard')}>监控面板</Button>
          <Button onClick={logout}>退出</Button>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        <Tabs defaultActiveKey="targets">
          <TabPane tab="监控目标管理" key="targets">
            <Card title="监控设置" style={{ marginBottom: 16 }}>
              <Space direction="vertical" size="middle">
                <Space>
                  <span>全局探测频率（秒）:</span>
                  <Input
                    style={{ width: 120 }}
                    value={probeIntervalInput}
                    onChange={e => setProbeIntervalInput(e.target.value.replace(/[^\d]/g, ''))}
                    disabled={probeIntervalLoading}
                    min={10}
                    max={86400}
                  />
                  <span style={{ color: '#888' }}>
                    （范围：10~86400）
                  </span>
                  <Button
                    type="primary"
                    loading={probeIntervalLoading}
                    onClick={handleProbeIntervalSave}
                  >
                    保存
                  </Button>
                  <span style={{ color: '#888' }}>
                    当前：{probeInterval} 秒
                  </span>
                </Space>
                <Space>
                  <span>定时任务状态：</span>
                  <span style={{ color: taskStatus === 'running' ? 'green' : 'red' }}>
                    {taskStatus === 'running' ? '运行中' : '已停止'}
                  </span>
                  <Button
                    type={taskStatus === 'running' ? 'default' : 'primary'}
                    loading={taskStatusLoading}
                    onClick={() => handleTaskStatusChange(taskStatus === 'running' ? 'stopped' : 'running')}
                  >
                    {taskStatus === 'running' ? '关闭定时任务' : '开启定时任务'}
                  </Button>
                </Space>
              </Space>
            </Card>
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Button 
                    type="primary" 
                    icon={<PlusOutlined />} 
                    onClick={() => setModalVisible(true)}
                  >
                    添加目标
                  </Button>
                  <Button 
                    icon={<UploadOutlined />} 
                    onClick={() => setUploadModalVisible(true)}
                  >
                    批量导入
                  </Button>
                  <Popconfirm
                    title={`确定要删除选中的 ${selectedRowKeys.length} 个目标吗？`}
                    onConfirm={handleBatchDelete}
                    disabled={selectedRowKeys.length === 0}
                  >
                    <Button 
                      danger 
                      icon={<DeleteOutlined />}
                      disabled={selectedRowKeys.length === 0}
                    >
                      批量删除 ({selectedRowKeys.length})
                    </Button>
                  </Popconfirm>
                </Space>
              </div>

              <Table
                columns={columns}
                dataSource={targets}
                rowKey="id"
                loading={loading}
                rowSelection={rowSelection}
                pagination={{
                  current: currentPage,
                  pageSize: pageSize,
                  total: targets.length,
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
                scroll={{ x: 1200 }}
              />
            </Card>
          </TabPane>

          <TabPane tab="用户设置" key="user">
            <Card title="账户信息">
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <UserOutlined style={{ marginRight: 8 }} />
                  用户名: {user?.username}
                </div>
                <div>
                  <SafetyOutlined style={{ marginRight: 8 }} />
                  双因子认证: {user?.has_totp ? '已启用' : '未启用'}
                </div>
                <div>
                  创建时间: {user?.created_at ? moment(user.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </div>
                <Space>
                  <Button onClick={() => setChangePasswordModalVisible(true)}>修改密码</Button>
                  <Button disabled>
                    {user?.has_totp ? '双因子认证已启用' : '双因子认证未启用'}
                  </Button>
                </Space>
              </Space>
            </Card>

            {user?.username === 'admin' && (
              <Card title="用户管理" style={{ marginTop: 16 }}>
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <TeamOutlined style={{ marginRight: 8 }} />
                    管理系统中的所有用户账户
                  </div>
                  <Button
                    type="primary"
                    icon={<TeamOutlined />}
                    onClick={() => navigate('/user-manage')}
                  >
                    打开用户管理
                  </Button>
                </Space>
              </Card>
            )}
          </TabPane>
        </Tabs>

        {/* 添加目标模态框 */}
        <Modal
          title="添加监控目标"
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} onFinish={handleAddTarget} layout="vertical">
            <Form.Item
              name="region"
              label="区域"
              rules={[{ required: true, message: '请输入区域' }]}
            >
              <Input placeholder="如: 北京, 上海, 新加坡" />
            </Form.Item>
            <Form.Item
              name="public_ip"
              label="公网IP"
              rules={[{ required: true, message: '请输入公网IP' }]}
            >
              <Input placeholder="如: 8.8.8.8" />
            </Form.Item>
            <Form.Item
              name="port"
              label="端口"
              rules={[{ required: true, message: '请输入端口' }]}
            >
              <Input type="number" placeholder="如: 80, 443, 22" />
            </Form.Item>
            <Form.Item name="business_system" label="业务系统">
              <Input placeholder="如: Web服务器, 数据库" />
            </Form.Item>
            <Form.Item name="internal_ip" label="内网IP">
              <Input placeholder="如: 192.168.1.100" />
            </Form.Item>
            <Form.Item name="internal_port" label="内网端口">
              <Input type="number" placeholder="如: 8080" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  添加
                </Button>
                <Button onClick={() => {
                  setModalVisible(false);
                  form.resetFields();
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 批量导入模态框 */}
        <Modal
          title="批量导入监控目标"
          open={uploadModalVisible}
          onCancel={() => {
            setUploadModalVisible(false);
            setCsvData('');
          }}
          footer={[
            <Button key="cancel" onClick={() => {
              setUploadModalVisible(false);
              setCsvData('');
            }}>
              取消
            </Button>,
            <Button key="submit" type="primary" onClick={handleBatchAdd}>
              导入
            </Button>,
          ]}
          width={800}
        >
          <div style={{ marginBottom: 16 }}>
            <p>请按以下格式输入CSV数据（第一行为标题行）：</p>
            <code style={{ background: '#f5f5f5', padding: 8, display: 'block' }}>
              region,public_ip,port,business_system,internal_ip,internal_port<br/>
              北京,8.8.8.8,53,Google DNS,192.168.1.1,53<br/>
              上海,1.1.1.1,53,Cloudflare DNS,,
            </code>
          </div>
          <TextArea
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="请粘贴CSV格式的数据..."
            rows={10}
          />
        </Modal>

        {/* 修改密码弹窗 */}
        <Modal
          title="修改密码"
          open={changePasswordModalVisible}
          onCancel={() => {
            setChangePasswordModalVisible(false);
            passwordForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={passwordForm}
            onFinish={handleChangePassword}
            layout="vertical"
          >
            <Form.Item
              name="oldPassword"
              label="原密码"
              rules={[{ required: true, message: '请输入原密码' }]}
            >
              <Input.Password placeholder="请输入原密码" />
            </Form.Item>
            <Form.Item
              name="newPassword"
              label="新密码"
              rules={[{ required: true, message: '请输入新密码' }]}
            >
              <Input.Password placeholder="请输入新密码" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">提交</Button>
                <Button onClick={() => {
                  setChangePasswordModalVisible(false);
                  passwordForm.resetFields();
                }}>取消</Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑目标模态框 */}
        <Modal
          title="编辑监控目标"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false);
            editForm.resetFields();
            setEditingTarget(null);
          }}
          footer={null}
        >
          <Form form={editForm} onFinish={handleSaveEdit} layout="vertical">
            <Form.Item
              name="region"
              label="区域"
              rules={[{ required: true, message: '请输入区域' }]}
            >
              <Input placeholder="如: 北京, 上海, 新加坡" />
            </Form.Item>
            <Form.Item
              name="public_ip"
              label="公网IP"
              rules={[{ required: true, message: '请输入公网IP' }]}
            >
              <Input placeholder="如: 8.8.8.8" />
            </Form.Item>
            <Form.Item
              name="port"
              label="端口"
              rules={[{ required: true, message: '请输入端口' }]}
            >
              <Input type="number" placeholder="如: 80, 443, 22" />
            </Form.Item>
            <Form.Item name="business_system" label="业务系统">
              <Input placeholder="如: Web服务器, 数据库" />
            </Form.Item>
            <Form.Item name="internal_ip" label="内网IP">
              <Input placeholder="如: 192.168.1.100" />
            </Form.Item>
            <Form.Item name="internal_port" label="内网端口">
              <Input type="number" placeholder="如: 8080" />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  保存
                </Button>
                <Button onClick={() => {
                  setEditModalVisible(false);
                  editForm.resetFields();
                  setEditingTarget(null);
                }}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default AdminPage;
