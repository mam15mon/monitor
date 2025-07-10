import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import TOTPSetup from '../components/TOTPSetup';

const { Title } = Typography;

interface LoginForm {
  username: string;
  password: string;
  totpCode?: string;
}

const LoginPage: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [showTOTP, setShowTOTP] = useState(false);
  const [showTOTPSetup, setShowTOTPSetup] = useState(false);
  const { login, user, totpSetupData } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const onFinish = async (values: LoginForm) => {
    setLoading(true);
    try {
      await login(values.username, values.password, values.totpCode);
      message.success('登录成功！');
      navigate('/dashboard');
    } catch (error: any) {
      if (error.message === 'TOTP_SETUP_REQUIRED') {
        // 需要设置TOTP
        setShowTOTPSetup(true);
        message.info('首次登录需要设置双因子认证');
      } else if (!values.totpCode && error.message.includes('验证码')) {
        // 需要输入TOTP验证码
        setShowTOTP(true);
        message.error('请输入TOTP验证码');
      } else {
        message.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTOTPSetupSuccess = () => {
    setShowTOTPSetup(false);
    message.success('登录成功！');
    navigate('/dashboard');
  };

  const handleTOTPSetupCancel = () => {
    setShowTOTPSetup(false);
    // 可以选择是否清除表单
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
            TCP端口监控平台
          </Title>
          <p style={{ color: '#666', margin: 0 }}>请登录您的账户</p>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
            />
          </Form.Item>

          {showTOTP && (
            <Form.Item
              name="totpCode"
              rules={[{ required: true, message: '请输入TOTP验证码!' }]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder="TOTP验证码"
                maxLength={6}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{ width: '100%' }}
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', color: '#666', fontSize: '12px' }}>
          <p>默认账户: admin / admin123</p>
        </div>
      </Card>

      {/* TOTP设置模态框 */}
      <TOTPSetup
        visible={showTOTPSetup}
        onSuccess={handleTOTPSetupSuccess}
        onCancel={handleTOTPSetupCancel}
      />
    </div>
  );
};

export default LoginPage;
