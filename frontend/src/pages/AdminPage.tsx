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

  useEffect(() => {
    fetchTargets();
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

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      width: 100,
    },
    {
      title: '公网IP',
      dataIndex: 'public_ip',
      key: 'public_ip',
      width: 120,
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '业务系统',
      dataIndex: 'business_system',
      key: 'business_system',
      width: 150,
      render: (text: string) => text || '-',
    },
    {
      title: '内网IP',
      dataIndex: 'internal_ip',
      key: 'internal_ip',
      width: 120,
      render: (text: string) => text || '-',
    },
    {
      title: '内网端口',
      dataIndex: 'internal_port',
      key: 'internal_port',
      width: 100,
      render: (text: number) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (text: string) => moment(text).format('YYYY-MM-DD HH:mm'),
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
          <Button onClick={() => window.open('/dashboard', '_blank')}>监控面板</Button>
          <Button onClick={logout}>退出</Button>
        </Space>
      </Header>

      <Content style={{ padding: 24 }}>
        <Tabs defaultActiveKey="targets">
          <TabPane tab="监控目标管理" key="targets">
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
                    onClick={() => window.open('/user-manage', '_blank')}
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
      </Content>
    </Layout>
  );
};

export default AdminPage;
