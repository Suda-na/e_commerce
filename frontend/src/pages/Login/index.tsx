import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import { Input, Button, Typography, App, Divider, Space, Alert } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { login, register, clearError } from '../../store/slices/authSlice';

const { Title, Text, Link } = Typography;

// Validation schemas
const loginValidationSchema = Yup.object({
  username: Yup.string()
    .required('请输入用户名')
    .min(5, '用户名至少5个字符')
    .max(50, '用户名最多50个字符'),
  password: Yup.string()
    .required('请输入密码')
    .min(6, '密码至少6个字符')
    .max(20, '密码最多20个字符'),
});

const registerValidationSchema = Yup.object({
  username: Yup.string()
    .required('请输入用户名')
    .min(5, '用户名至少5个字符')
    .max(50, '用户名最多50个字符'),
  password: Yup.string()
    .required('请输入密码')
    .min(6, '密码至少6个字符')
    .max(20, '密码最多20个字符')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/, '密码必须包含至少一个字母和一个数字'),
  confirmPassword: Yup.string()
    .required('请确认密码')
    .oneOf([Yup.ref('password')], '两次输入的密码不一致'),
});

interface LoginFormValues {
  username: string;
  password: string;
  confirmPassword?: string;
}

interface RegisterFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

const LoginPage: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const { message } = App.useApp();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { loading, error } = useAppSelector((state) => state.auth);

  const handleLogin = async (values: LoginFormValues, { setSubmitting }: FormikHelpers<LoginFormValues>) => {
    dispatch(clearError());
    try {
      await dispatch(login(values)).unwrap();
      message.success('登录成功');
      navigate('/merchant/dashboard');
    } catch (error: any) {
      message.error(error || '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (values: RegisterFormValues, { setSubmitting }: FormikHelpers<RegisterFormValues>) => {
    dispatch(clearError());
    try {
      const { confirmPassword, ...registerData } = values;
      await dispatch(register({ ...registerData, role: 'merchant' })).unwrap();
      message.success('注册成功');
      navigate('/merchant/dashboard');
    } catch (error: any) {
      message.error(error || '注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsRegister(!isRegister);
    dispatch(clearError());
  };

  return (
    <div
      className="login-page-container"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0e27 0%, #141833 50%, #0f1229 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* 全局样式覆盖 antd 在深色背景上的默认黑色文字 */}
      <style>{`
        .login-page-container .ant-form-item-explain-error {
          color: #ff6b6b !important;
        }
        .login-page-container input::placeholder,
        .login-page-container .ant-input::placeholder,
        .login-page-container .ant-input-affix-wrapper input::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        .login-page-container .ant-input-password .ant-input,
        .login-page-container .ant-input-password .ant-input::placeholder {
          color: #fff !important;
        }
        .login-page-container .ant-input-password .ant-input::placeholder {
          color: rgba(255, 255, 255, 0.4) !important;
        }
        .login-page-container .ant-form-item-label > label {
          color: #e8e8e8 !important;
        }
      `}</style>
      {/* Background decoration */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,23,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-15%',
          width: 800,
          height: 800,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,23,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          width: 420,
          padding: '48px 40px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          border: '1px solid rgba(255, 215, 0, 0.1)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #d4a017 0%, #f0c040 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 800,
              color: '#0a0e27',
              boxShadow: '0 8px 24px rgba(212, 160, 23, 0.3)',
              marginBottom: 16,
            }}
          >
            拍
          </div>
          <Title level={3} style={{ color: '#f0c040', margin: 0, fontWeight: 700 }}>
            实时竞拍大师
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {isRegister ? '商家注册' : '商家管理控制台'}
          </Text>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            style={{ marginBottom: 24 }}
            onClose={() => dispatch(clearError())}
          />
        )}

        {/* Formik Form */}
        <Formik
          initialValues={
            isRegister
              ? { username: '', password: '', confirmPassword: '' }
              : { username: '', password: '' }
          }
          validationSchema={isRegister ? registerValidationSchema : loginValidationSchema}
          onSubmit={(values: any, helpers: any) =>
            isRegister ? handleRegister(values, helpers) : handleLogin(values, helpers)
          }
          enableReinitialize
        >
          {({ isSubmitting, handleSubmit, errors, touched }) => (
            <Form onSubmit={handleSubmit} className="ant-form ant-form-vertical">
              {/* Username Field */}
              <div className="ant-form-item">
                <div className="ant-form-item-row">
                  <div className="ant-form-item-label">
                    <label htmlFor="username" className="ant-form-item-required" style={{ color: '#e8e8e8' }}>
                      用户名
                    </label>
                  </div>
                  <div className="ant-form-item-control">
                    <div className="ant-form-item-control-input">
                      <div className="ant-form-item-control-input-content">
                        <Field name="username">
                          {({ field }: any) => (
                            <Input
                              {...field}
                              id="username"
                              prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                              placeholder="请输入用户名"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${errors.username && touched.username ? '#ff4d4f' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 10,
                                color: '#fff',
                              }}
                            />
                          )}
                        </Field>
                        <ErrorMessage name="username">
                          {(msg) => (
                            <div className="ant-form-item-explain ant-form-item-explain-error">
                              <div role="alert">{msg}</div>
                            </div>
                          )}
                        </ErrorMessage>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Field */}
              <div className="ant-form-item">
                <div className="ant-form-item-row">
                  <div className="ant-form-item-label">
                    <label htmlFor="password" className="ant-form-item-required" style={{ color: '#e8e8e8' }}>
                      密码
                    </label>
                  </div>
                  <div className="ant-form-item-control">
                    <div className="ant-form-item-control-input">
                      <div className="ant-form-item-control-input-content">
                        <Field name="password">
                          {({ field }: any) => (
                            <Input.Password
                              {...field}
                              id="password"
                              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                              placeholder="请输入密码"
                              style={{
                                background: 'rgba(255,255,255,0.06)',
                                border: `1px solid ${errors.password && touched.password ? '#ff4d4f' : 'rgba(255,255,255,0.1)'}`,
                                borderRadius: 10,
                                color: '#fff',
                              }}
                            />
                          )}
                        </Field>
                        <ErrorMessage name="password">
                          {(msg) => (
                            <div className="ant-form-item-explain ant-form-item-explain-error">
                              <div role="alert">{msg}</div>
                            </div>
                          )}
                        </ErrorMessage>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Confirm Password Field (Register only) */}
              {isRegister && (
                <div className="ant-form-item">
                  <div className="ant-form-item-row">
                    <div className="ant-form-item-label">
                    <label htmlFor="confirmPassword" className="ant-form-item-required" style={{ color: '#e8e8e8' }}>
                      确认密码
                    </label>
                    </div>
                    <div className="ant-form-item-control">
                      <div className="ant-form-item-control-input">
                        <div className="ant-form-item-control-input-content">
                          <Field name="confirmPassword">
                            {({ field }: any) => (
                              <Input.Password
                                {...field}
                                id="confirmPassword"
                                prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.3)' }} />}
                                placeholder="请再次输入密码"
                                style={{
                                  background: 'rgba(255,255,255,0.06)',
                                  border: `1px solid ${errors.confirmPassword && touched.confirmPassword ? '#ff4d4f' : 'rgba(255,255,255,0.1)'}`,
                                  borderRadius: 10,
                                  color: '#fff',
                                }}
                              />
                            )}
                          </Field>
                          <ErrorMessage name="confirmPassword">
                            {(msg) => (
                              <div className="ant-form-item-explain ant-form-item-explain-error">
                                <div role="alert">{msg}</div>
                              </div>
                            )}
                          </ErrorMessage>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="ant-form-item" style={{ marginBottom: 16 }}>
                <div className="ant-form-item-row">
                  <div className="ant-form-item-control">
                    <div className="ant-form-item-control-input">
                      <div className="ant-form-item-control-input-content">
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={isSubmitting || loading}
                          block
                          style={{
                            height: 48,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #d4a017 0%, #f0c040 100%)',
                            border: 'none',
                            fontWeight: 700,
                            fontSize: 15,
                            color: '#0a0e27',
                            boxShadow: '0 4px 16px rgba(212, 160, 23, 0.3)',
                          }}
                        >
                          {isRegister ? '注册商家账号' : '登录'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Form>
          )}
        </Formik>

        <Divider style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>或</Text>
        </Divider>

        <div style={{ textAlign: 'center' }}>
          <Space>
            <Text style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isRegister ? '已有账号?' : '没有账号?'}
            </Text>
            <Link
              onClick={toggleMode}
              style={{ color: '#f0c040', fontWeight: 600 }}
            >
              {isRegister ? '立即登录' : '注册商家账号'}
            </Link>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;