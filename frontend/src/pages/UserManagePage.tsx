import React, { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Tag,
  Typography
} from 'antd';
import {
  UserAddOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const { Content } = Layout;
const { Title } = Typography;

interface User {
  id: number;
  username: string;
  is_active: boolean;
  has_totp: boolean;
  created_at: string;
  updated_at: string;
}

interface CreateUserForm {
  username: string;
  password: string;
  is_active: boolean;
}

interface UpdateUserForm {
  password?: string;
  is_active: boolean;
}

const UserManagePage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const { user } = useAuth();

  // 获取用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/users/');
      setUsers(response.data);
    } catch (error: any) {
      message.error('获取用户列表失败: ' + (error.response?.data?.detail || error.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // 创建用户
  const handleCreateUser = async (values: CreateUserForm) => {
    try {
      await axios.post('/api/users/', values);
      message.success('用户创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      fetchUsers();
    } catch (error: any) {
      message.error('创建用户失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 更新用户
  const handleUpdateUser = async (values: UpdateUserForm) => {
    if (!editingUser) return;
    
    try {
      await axios.put(`/api/users/${editingUser.id}`, values);
      message.success('用户更新成功');
      setEditModalVisible(false);
      setEditingUser(null);
      editForm.resetFields();
      fetchUsers();
    } catch (error: any) {
      message.error('更新用户失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 删除用户
  const handleDeleteUser = async (userId: number) => {
    try {
      await axios.delete(`/api/users/${userId}`);
      message.success('用户删除成功');
      fetchUsers();
    } catch (error: any) {
      message.error('删除用户失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 重置TOTP
  const handleResetTotp = async (userId: number, username: string) => {
    try {
      await axios.post(`/api/users/${userId}/reset-totp`);
      message.success(`用户 ${username} 的TOTP设置已重置`);
      fetchUsers();
    } catch (error: any) {
      message.error('重置TOTP失败: ' + (error.response?.data?.detail || error.message));
    }
  };

  // 打开编辑模态框
  const openEditModal = (user: User) => {
    setEditingUser(user);
    editForm.setFieldsValue({
      is_active: user.is_active
    });
    setEditModalVisible(true);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: User) => (
        <Space>
          {username}
          {username === 'admin' && <Tag color="red">管理员</Tag>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (is_active: boolean) => (
        <Tag color={is_active ? 'green' : 'red'}>
          {is_active ? '启用' : '禁用'}
        </Tag>
      ),
    },
    {
      title: 'TOTP状态',
      dataIndex: 'has_totp',
      key: 'has_totp',
      render: (has_totp: boolean) => (
        <Tag color={has_totp ? 'blue' : 'default'}>
          {has_totp ? '已启用' : '未启用'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          
          {record.has_totp && (
            <Popconfirm
              title="确定要重置此用户的TOTP设置吗？"
              onConfirm={() => handleResetTotp(record.id, record.username)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                size="small"
                icon={<SafetyOutlined />}
              >
                重置TOTP
              </Button>
            </Popconfirm>
          )}
          
          {record.username !== 'admin' && record.id !== user?.id && (
            <Popconfirm
              title="确定要删除此用户吗？"
              onConfirm={() => handleDeleteUser(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Content style={{ padding: '24px' }}>
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>用户管理</Title>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchUsers}
                loading={loading}
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建用户
              </Button>
            </Space>
          </div>

          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个用户`,
            }}
          />
        </Card>

        {/* 创建用户模态框 */}
        <Modal
          title="创建用户"
          open={createModalVisible}
          onCancel={() => {
            setCreateModalVisible(false);
            createForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreateUser}
            initialValues={{ is_active: true }}
          >
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, message: '用户名至少3个字符' },
                { max: 50, message: '用户名最多50个字符' }
              ]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>

            <Form.Item
              name="is_active"
              label="启用状态"
              valuePropName="checked"
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setCreateModalVisible(false);
                  createForm.resetFields();
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  创建
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* 编辑用户模态框 */}
        <Modal
          title="编辑用户"
          open={editModalVisible}
          onCancel={() => {
            setEditModalVisible(false);
            setEditingUser(null);
            editForm.resetFields();
          }}
          footer={null}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdateUser}
          >
            <Form.Item
              name="password"
              label="新密码（留空则不修改）"
              rules={[
                { min: 6, message: '密码至少6个字符' }
              ]}
            >
              <Input.Password placeholder="请输入新密码" />
            </Form.Item>

            <Form.Item
              name="is_active"
              label="启用状态"
              valuePropName="checked"
            >
              <Switch 
                checkedChildren="启用" 
                unCheckedChildren="禁用"
                disabled={editingUser?.username === 'admin'}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => {
                  setEditModalVisible(false);
                  setEditingUser(null);
                  editForm.resetFields();
                }}>
                  取消
                </Button>
                <Button type="primary" htmlType="submit">
                  更新
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Content>
    </Layout>
  );
};

export default UserManagePage;
