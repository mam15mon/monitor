import React, { useState } from 'react';
import { Modal, Form, Input, Button, message, Typography, Space, Divider } from 'antd';
import { SafetyOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;

interface TOTPSetupProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

const TOTPSetup: React.FC<TOTPSetupProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { setupTotp, totpSetupData } = useAuth();

  const handleSubmit = async (values: { totpCode: string }) => {
    if (!totpSetupData) {
      message.error('TOTP设置数据不存在');
      return;
    }

    setLoading(true);
    try {
      await setupTotp(totpSetupData.username, totpSetupData.secret, values.totpCode);
      message.success('TOTP双因子认证设置成功！');
      form.resetFields();
      onSuccess();
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  if (!totpSetupData) {
    return null;
  }

  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined style={{ color: '#1890ff' }} />
          <span>设置双因子认证</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={600}
      maskClosable={false}
    >
      <div style={{ padding: '20px 0' }}>
        <Title level={4}>
          <QrcodeOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          扫描二维码设置TOTP
        </Title>
        
        <Paragraph>
          为了保护您的账户安全，系统要求启用双因子认证。请按照以下步骤完成设置：
        </Paragraph>

        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <img 
            src={totpSetupData.qr_code_url} 
            alt="TOTP QR Code" 
            style={{ 
              maxWidth: '200px', 
              border: '1px solid #d9d9d9',
              borderRadius: '8px',
              padding: '10px',
              backgroundColor: '#fff'
            }} 
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <Text strong>步骤说明：</Text>
          <ol style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>在手机上下载并安装认证器应用（如 Google Authenticator、Microsoft Authenticator 等）</li>
            <li>打开认证器应用，扫描上方二维码</li>
            <li>输入认证器应用显示的6位验证码</li>
            <li>点击"完成设置"按钮</li>
          </ol>
        </div>

        <Divider />

        <Form form={form} onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="totpCode"
            label="TOTP验证码"
            rules={[
              { required: true, message: '请输入TOTP验证码' },
              { len: 6, message: '验证码必须是6位数字' },
              { pattern: /^\d{6}$/, message: '验证码只能包含数字' }
            ]}
          >
            <Input
              prefix={<SafetyOutlined />}
              placeholder="请输入6位验证码"
              maxLength={6}
              size="large"
              style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '4px' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Space size="large">
              <Button onClick={handleCancel} size="large">
                取消
              </Button>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading}
                size="large"
              >
                完成设置
              </Button>
            </Space>
          </Form.Item>
        </Form>

        <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <strong>安全提示：</strong>请妥善保管您的认证器应用，它是您账户安全的重要保障。
            如果更换手机，请提前备份或重新设置认证器。
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default TOTPSetup;
