import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

interface User {
  id: number;
  username: string;
  is_active: boolean;
  has_totp: boolean;
  created_at: string;
}

interface TOTPSetupData {
  secret: string;
  qr_code_url: string;
  username: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string, totpCode?: string) => Promise<void>;
  setupTotp: (username: string, secret: string, totpCode: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  totpSetupData: TOTPSetupData | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 配置axios默认设置
axios.defaults.baseURL = 'http://localhost:8000';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  const [totpSetupData, setTotpSetupData] = useState<TOTPSetupData | null>(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      // 验证token并获取用户信息
      fetchUserInfo();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setUser(response.data);
    } catch (error) {
      // Token无效，清除本地存储
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string, totpCode?: string) => {
    try {
      const response = await axios.post('/api/auth/login', {
        username,
        password,
        totp_code: totpCode
      });

      // 检查是否需要设置TOTP
      if (response.data.requires_totp_setup) {
        setTotpSetupData({
          secret: response.data.secret,
          qr_code_url: response.data.qr_code_url,
          username: response.data.username
        });
        throw new Error('TOTP_SETUP_REQUIRED');
      }

      const { access_token } = response.data;
      setToken(access_token);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // 获取用户信息
      await fetchUserInfo();
    } catch (error: any) {
      if (error.message === 'TOTP_SETUP_REQUIRED') {
        throw error;
      }
      throw new Error(error.response?.data?.detail || '登录失败');
    }
  };

  const setupTotp = async (username: string, secret: string, totpCode: string) => {
    try {
      const response = await axios.post('/api/auth/setup-totp', {
        username,
        secret,
        totp_code: totpCode
      });

      const { access_token } = response.data;
      setToken(access_token);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // 清除TOTP设置数据
      setTotpSetupData(null);

      // 获取用户信息
      await fetchUserInfo();
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'TOTP设置失败');
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setTotpSetupData(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
    login,
    setupTotp,
    logout,
    isLoading,
    totpSetupData
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
