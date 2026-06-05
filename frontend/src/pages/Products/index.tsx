import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Modal,
  InputNumber,
  Select,
  App,
  Popconfirm,
  Image,
  Upload,
  Row,
  Col,
  Tooltip,
  Form,
  Empty,
  Dropdown,
  Drawer,
  Badge,
  Statistic,
  Alert,
  Progress,
} from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  ReloadOutlined,
  RollbackOutlined,
  InboxOutlined,
  DeleteFilled,
  AppstoreOutlined,
  PlusCircleOutlined,
  DownloadOutlined,
  TagsOutlined,
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FolderOutlined,
  FileExcelOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector, useDebounce, useThrottleCallback } from '../../utils/hooks';
import { fetchProducts, createProduct, updateProduct, deleteProduct, restoreProduct, updateProductStatus } from '../../store/slices/productSlice';
import { fetchCategories, createCategory } from '../../store/slices/categorySlice';
import { formatPrice, formatDate, statusColors, productStatusLabels } from '../../utils/hooks';
import { Product, CreateProductRequest, DescriptionStyle, SuggestedPricing } from '../../types';
import { aiAssistantService } from '../../services/ai-assistant.service';
import { exportService } from '../../services/export.service';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待开始' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已结束' },
  { value: 'cancelled', label: '已取消' },
];

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <ClockCircleOutlined style={{ marginRight: 4 }} />,
  active: <ThunderboltOutlined style={{ marginRight: 4 }} />,
  completed: <CheckCircleOutlined style={{ marginRight: 4 }} />,
  cancelled: <CloseCircleOutlined style={{ marginRight: 4 }} />,
};

const ProductsPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { products, loading, total } = useAppSelector((state) => state.products);
  const { categories } = useAppSelector((state) => state.categories);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryForm] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiStyle, setAiStyle] = useState<DescriptionStyle>('professional');
  const [uploadFileList, setUploadFileList] = useState<UploadFile[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [form] = Form.useForm();

  const [batchPriceModalVisible, setBatchPriceModalVisible] = useState(false);
  const [batchPriceType, setBatchPriceType] = useState<'increase' | 'discount' | 'uniform'>('increase');
  const [batchPriceValue, setBatchPriceValue] = useState<number | null>(null);
  const [batchPriceLoading, setBatchPriceLoading] = useState(false);
  const [batchCategoryModalVisible, setBatchCategoryModalVisible] = useState(false);
  const [batchCategoryLoading, setBatchCategoryLoading] = useState(false);
  const [batchCategoryForm] = Form.useForm();
  const [batchStatusLoading, setBatchStatusLoading] = useState(false);

  const [pricingSuggestion, setPricingSuggestion] = useState<SuggestedPricing | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);

  const debouncedSearch = useDebounce(searchText, 400);

  const throttledSetIsMobile = useThrottleCallback(
    () => setIsMobile(window.innerWidth < 768),
    200,
  );

  useEffect(() => {
    window.addEventListener('resize', throttledSetIsMobile);
    return () => window.removeEventListener('resize', throttledSetIsMobile);
  }, [throttledSetIsMobile]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchProducts({
      page,
      pageSize: 10,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
      categoryId: selectedCategoryId || undefined,
    }));
  }, [dispatch, page, debouncedSearch, statusFilter, selectedCategoryId]);

  const handleCreate = useCallback(() => {
    setEditingProduct(null);
    setUploadFileList([]);
    setUploadedUrls([]);
    setPricingSuggestion(null);
    form.resetFields();
    form.setFieldsValue({
      name: '',
      description: '',
      productType: '',
      features: '',
      startingPrice: 0,
      priceIncrement: 0,
      duration: 60,
      capPrice: null,
      delayTime: 10,
      categoryId: undefined,
      tags: [],
    });
    setModalVisible(true);
  }, [form]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreate();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('.product-search-input input');
        searchInput?.focus();
      }
      if (e.key === 'Escape') {
        if (aiModalVisible) {
          setAiModalVisible(false);
        } else if (modalVisible) {
          setModalVisible(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalVisible, aiModalVisible, handleCreate]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setPricingSuggestion(null);
    const existingUrls = product.images || [];
    setUploadedUrls(existingUrls);
    setUploadFileList(
      existingUrls.map((url, idx) => ({
        uid: `-${idx}`,
        name: `image-${idx + 1}.jpg`,
        status: 'done' as const,
        url: url,
      }))
    );
    form.resetFields();
    form.setFieldsValue({
      name: product.name,
      description: product.description || '',
      productType: '',
      features: '',
      startingPrice: product.startingPrice,
      priceIncrement: product.priceIncrement,
      duration: product.duration,
      capPrice: product.capPrice || null,
      delayTime: product.delayTime || 10,
      categoryId: product.categoryId || undefined,
      tags: product.tags || [],
    });
    setModalVisible(true);
  };

  const handleDuplicate = (product: Product) => {
    setEditingProduct(null);
    setUploadFileList(
      (product.images || []).map((url, idx) => ({
        uid: `-${idx}`,
        name: `image-${idx + 1}.jpg`,
        status: 'done' as const,
        url: url,
      }))
    );
    setUploadedUrls(product.images || []);
    form.resetFields();
    form.setFieldsValue({
      name: `${product.name} (副本)`,
      description: product.description || '',
      productType: '',
      features: '',
      startingPrice: product.startingPrice,
      priceIncrement: product.priceIncrement,
      duration: product.duration,
      capPrice: product.capPrice || null,
      delayTime: product.delayTime || 10,
      categoryId: product.categoryId || undefined,
      tags: product.tags || [],
    });
    setModalVisible(true);
    message.info('已复制商品信息，请修改后保存');
  };

  const handleDelete = async (id: number) => {
    try {
      await dispatch(deleteProduct(id)).unwrap();
      message.success('商品删除成功');
    } catch (error: any) {
      message.error(error || '删除失败');
    }
  };

  const handleRestore = async (id: number) => {
    try {
      await dispatch(restoreProduct(id)).unwrap();
      message.success('商品已恢复为待开始状态');
    } catch (error: any) {
      message.error(error || '恢复失败');
    }
  };

  const handleBatchDelete = useCallback(() => {
    modal.confirm({
      title: '批量删除',
      content: `确定删除选中的 ${selectedRowKeys.length} 个商品？此操作不可恢复。`,
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map((key) => dispatch(deleteProduct(key as number)).unwrap())
          );
          message.success(`成功删除 ${selectedRowKeys.length} 个商品`);
          setSelectedRowKeys([]);
        } catch (error: any) {
          message.error(error || '批量删除失败');
        }
      },
    });
  }, [selectedRowKeys, dispatch, message, modal]);

  const handleBatchStatus = async (targetStatus: 'active' | 'cancelled') => {
    const statusLabel = targetStatus === 'active' ? '上架' : '下架';
    const selectedProducts = (products ?? []).filter((p) => selectedRowKeys.includes(p.id));
    const validProducts = selectedProducts.filter((p) => {
      if (targetStatus === 'active') return p.status === 'pending';
      return p.status === 'active' || p.status === 'pending';
    });

    if (validProducts.length === 0) {
      message.warning(`没有可${statusLabel}的商品（仅${targetStatus === 'active' ? '待开始' : '待开始/进行中'}状态可操作）`);
      return;
    }

    modal.confirm({
      title: `批量${statusLabel}`,
      content: `确定将 ${validProducts.length} 个商品${statusLabel}？`,
      onOk: async () => {
        setBatchStatusLoading(true);
        try {
          const results = await Promise.allSettled(
            validProducts.map((p) => dispatch(updateProductStatus({ id: p.id, status: targetStatus })).unwrap())
          );
          const succeeded = results.filter((r) => r.status === 'fulfilled').length;
          const failed = results.filter((r) => r.status === 'rejected').length;
          if (failed === 0) {
            message.success(`成功${statusLabel} ${succeeded} 个商品`);
          } else {
            message.warning(`${succeeded} 个商品${statusLabel}成功，${failed} 个失败`);
          }
          setSelectedRowKeys([]);
          dispatch(fetchProducts({
            page,
            pageSize: 10,
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            categoryId: selectedCategoryId || undefined,
          }));
        } catch (error: any) {
          message.error(error || `批量${statusLabel}失败`);
        } finally {
          setBatchStatusLoading(false);
        }
      },
    });
  };

  const handleBatchPriceSubmit = async () => {
    if (batchPriceValue === null || batchPriceValue <= 0) {
      message.warning('请输入有效的价格数值');
      return;
    }

    const selectedProducts = (products ?? []).filter((p) => selectedRowKeys.includes(p.id));
    const editableProducts = selectedProducts.filter((p) => p.status === 'pending');

    if (editableProducts.length === 0) {
      message.warning('没有可修改价格的商品（仅待开始状态可修改）');
      return;
    }

    setBatchPriceLoading(true);
    try {
      const results = await Promise.allSettled(
        editableProducts.map((p) => {
          let newPrice = p.startingPrice;
          switch (batchPriceType) {
            case 'increase':
              newPrice = p.startingPrice + batchPriceValue;
              break;
            case 'discount':
              newPrice = Math.round(p.startingPrice * (1 - batchPriceValue / 100) * 100) / 100;
              break;
            case 'uniform':
              newPrice = batchPriceValue;
              break;
          }
          newPrice = Math.max(0.01, newPrice);
          return dispatch(updateProduct({
            id: p.id,
            data: { startingPrice: newPrice },
          })).unwrap();
        })
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        message.success(`成功修改 ${succeeded} 个商品的价格`);
      } else {
        message.warning(`${succeeded} 个商品价格修改成功，${failed} 个失败`);
      }
      setBatchPriceModalVisible(false);
      setBatchPriceValue(null);
      setSelectedRowKeys([]);
      dispatch(fetchProducts({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        categoryId: selectedCategoryId || undefined,
      }));
    } catch (error: any) {
      message.error(error || '批量修改价格失败');
    } finally {
      setBatchPriceLoading(false);
    }
  };

  const handleBatchCategorySubmit = async () => {
    try {
      const values = await batchCategoryForm.validateFields();
      const selectedProducts = (products ?? []).filter((p) => selectedRowKeys.includes(p.id));
      const editableProducts = selectedProducts.filter((p) => p.status === 'pending');

      if (editableProducts.length === 0) {
        message.warning('没有可修改的商品（仅待开始状态可修改）');
        return;
      }

      setBatchCategoryLoading(true);
      const updateData: any = {};
      if (values.categoryId !== undefined) updateData.categoryId = values.categoryId || undefined;
      if (values.tags !== undefined) updateData.tags = values.tags;

      const results = await Promise.allSettled(
        editableProducts.map((p) =>
          dispatch(updateProduct({ id: p.id, data: updateData })).unwrap()
        )
      );
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed === 0) {
        message.success(`成功修改 ${succeeded} 个商品`);
      } else {
        message.warning(`${succeeded} 个商品修改成功，${failed} 个失败`);
      }
      setBatchCategoryModalVisible(false);
      batchCategoryForm.resetFields();
      setSelectedRowKeys([]);
      dispatch(fetchProducts({
        page,
        pageSize: 10,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        categoryId: selectedCategoryId || undefined,
      }));
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(error || '批量修改失败');
    } finally {
      setBatchCategoryLoading(false);
    }
  };

  const [exportLoading, setExportLoading] = useState(false);

  const handleBatchExport = useCallback(async (format: 'csv' | 'excel') => {
    try {
      setExportLoading(true);
      await exportService.exportData({
        type: 'products',
        format,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId?.toString() || undefined,
      });
      message.success('商品数据导出成功');
    } catch (error: any) {
      message.error(error?.response?.data?.error?.message || '导出失败');
    } finally {
      setExportLoading(false);
    }
  }, [statusFilter, debouncedSearch, selectedCategoryId, message]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: CreateProductRequest = {
        name: values.name,
        description: values.description,
        images: uploadedUrls,
        startingPrice: values.startingPrice,
        priceIncrement: values.priceIncrement,
        duration: values.duration,
        capPrice: values.capPrice ?? undefined,
        delayTime: values.delayTime || 10,
        categoryId: values.categoryId || undefined,
        tags: values.tags || [],
      };

      if (editingProduct) {
        await dispatch(updateProduct({ id: editingProduct.id, data })).unwrap();
        message.success('商品更新成功');
      } else {
        await dispatch(createProduct(data)).unwrap();
        message.success('商品创建成功');
      }
      setModalVisible(false);
    } catch (error: any) {
      if (error.errorFields) return;
      const errorMsg = typeof error === 'string'
        ? error
        : error?.message || error?.data?.message || '操作失败，请检查网络连接';
      message.error(errorMsg);
    }
  };

  const handleAIDescription = async () => {
    const name = form.getFieldValue('name');
    const productType = form.getFieldValue('productType');
    const features = form.getFieldValue('features');

    if (!name) {
      message.warning('请先输入商品名称');
      return;
    }

    const featuresList = features
      ? features.split(/[,，、\n]/).map((f: string) => f.trim()).filter(Boolean)
      : [];
    let additionalInfo = '以下为AI生成辅助信息：\n';
    if (productType) additionalInfo += `- 商品类型：${productType}\n`;
    if (featuresList.length > 0) additionalInfo += `- 商品特点：${featuresList.join('、')}\n`;

    setAiLoading(true);
    try {
      const result = await aiAssistantService.generateDescription({
        productName: name,
        productType: productType || '未分类',
        features: featuresList,
        style: aiStyle,
        additionalInfo,
      });
      setAiResult(result.description);
      setAiModalVisible(true);
    } catch {
      message.error('AI 描述生成失败，请稍后重试');
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseAIDescription = () => {
    form.setFieldValue('description', aiResult);
    setAiModalVisible(false);
    message.success('已应用 AI 生成的描述');
  };

  const handleAIPricing = async () => {
    const name = form.getFieldValue('name');
    const productType = form.getFieldValue('productType');

    if (!name) {
      message.warning('请先输入商品名称');
      return;
    }

    setPricingLoading(true);
    try {
      const result = await aiAssistantService.suggestPricing({
        productName: name,
        productType: productType || undefined,
        images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        targetAudience: '高端消费者',
      });
      setPricingSuggestion(result);
    } catch {
      message.error('AI 定价建议获取失败，请稍后重试');
    } finally {
      setPricingLoading(false);
    }
  };

  const handleApplyPricing = () => {
    if (!pricingSuggestion) return;
    form.setFieldsValue({
      startingPrice: pricingSuggestion.suggestedStartingPrice,
      priceIncrement: pricingSuggestion.suggestedPriceIncrement,
    });
    message.success('已采用 AI 定价建议');
  };

  const handleUploadChange: UploadProps['onChange'] = ({ fileList }) => {
    setUploadFileList(fileList);
    const urls: string[] = [];
    fileList.forEach((f) => {
      if (f.status === 'done') {
        const resp = f.response;
        if (resp?.data?.urls?.length) {
          urls.push(...resp.data.urls);
        } else if (resp?.urls?.length) {
          urls.push(...resp.urls);
        } else if (resp?.url) {
          urls.push(resp.url);
        } else if (f.url) {
          urls.push(f.url);
        }
      }
    });
    setUploadedUrls(urls);
  };

  const beforeUpload = (file: File) => {
    const isImage = file.type.startsWith('image/');
    const isLt10M = file.size / 1024 / 1024 <= 10;
    if (!isImage) {
      message.error('只能上传图片文件！');
      return Upload.LIST_IGNORE;
    }
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB！');
      return Upload.LIST_IGNORE;
    }
    return true;
  };

  const columns = [
    {
      title: '商品信息',
      key: 'info',
      render: (_: any, record: Product) => (
        <Space>
          <Image
            src={record.images?.[0]}
            width={56}
            height={56}
            style={{ borderRadius: 8, objectFit: 'cover', cursor: 'pointer' }}
            fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGVIMDCAlxmbzmCIHFEBEFMAoKDSAYN0fERHRUYAIYnMZAoYPk0E7PABNk/A7A/gzALYFhcKWDQMHB0ycA05AYJ8YGgAE9dg3HBwSAxIQ0hDP0F0Q4JN6OIgyXoIR4khKSgAO58OjkBKhhAAAAAElFTkSuQmCC"
            preview={false}
            onClick={() => navigate(`/merchant/products/${record.id}`)}
          />
          <div>
            <Text
              strong
              style={{ cursor: 'pointer', color: '#1890ff' }}
              onClick={() => navigate(`/merchant/products/${record.id}`)}
            >
              {record.name}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description?.substring(0, 50) || '暂无描述'}
              {record.description && record.description.length > 50 ? '...' : ''}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: '分类',
      key: 'category',
      responsive: ['md'] as any,
      render: (_: any, record: Product) => (
        <Space direction="vertical" size={2}>
          {record.category ? (
            <Tag icon={<AppstoreOutlined />} color="gold">{record.category.name}</Tag>
          ) : (
            <Text type="secondary" style={{ fontSize: 12 }}>未分类</Text>
          )}
          {record.tags && record.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {record.tags.slice(0, 2).map((tag) => (
                <Tag key={tag} style={{ fontSize: 11, margin: 0 }}>{tag}</Tag>
              ))}
              {record.tags.length > 2 && (
                <Tag style={{ fontSize: 11, margin: 0 }}>+{record.tags.length - 2}</Tag>
              )}
            </div>
          )}
        </Space>
      ),
    },
    {
      title: '价格信息',
      key: 'price',
      responsive: ['md'] as any,
      render: (_: any, record: Product) => (
        <Space direction="vertical" size={2}>
          <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>起拍价</Text>
          <Text strong style={{ color: '#d4a017' }}>{formatPrice(record.startingPrice)}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)' }}>加价幅度</Text>
          <Text>{formatPrice(record.priceIncrement)}</Text>
        </Space>
      ),
    },
    {
      title: '竞拍时长',
      key: 'duration',
      responsive: ['lg'] as any,
      render: (_: any, record: Product) => <Text>{record.duration}分钟</Text>,
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: Product) => (
        <Tag
          color={statusColors[record.status]}
          icon={STATUS_ICONS[record.status]}
          style={{ borderRadius: 12, padding: '2px 12px', fontSize: 13 }}
        >
          {productStatusLabels[record.status]}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      key: 'createdAt',
      responsive: ['lg'] as any,
      render: (_: any, record: Product) => <Text type="secondary">{formatDate(record.createdAt)}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Product) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
              disabled={record.status !== 'pending'}
            >
              {!isMobile && '编辑'}
            </Button>
          </Tooltip>
          <Tooltip title="复制商品">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleDuplicate(record)}
            />
          </Tooltip>
          <Popconfirm title="确定删除此商品？" onConfirm={() => handleDelete(record.id)} okText="确定" cancelText="取消">
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={record.status !== 'pending'}
              >
                {!isMobile && '删除'}
              </Button>
            </Tooltip>
          </Popconfirm>
          {record.status === 'cancelled' && (
            <Popconfirm title="确定恢复此商品为待开始状态？" onConfirm={() => handleRestore(record.id)} okText="确定" cancelText="取消">
              <Tooltip title="恢复">
                <Button
                  type="text"
                  icon={<RollbackOutlined style={{ color: '#52c41a' }} />}
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const batchMenuItems = useMemo(() => [
    {
      key: 'batchPrice',
      icon: <DollarOutlined />,
      label: '批量修改价格',
      onClick: () => {
        setBatchPriceType('increase');
        setBatchPriceValue(null);
        setBatchPriceModalVisible(true);
      },
    },
    {
      key: 'batchCategory',
      icon: <FolderOutlined />,
      label: '批量设置分类/标签',
      onClick: () => {
        batchCategoryForm.resetFields();
        setBatchCategoryModalVisible(true);
      },
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'exportCsv',
      icon: <DownloadOutlined />,
      label: '导出 CSV',
      disabled: exportLoading,
      onClick: () => handleBatchExport('csv'),
    },
    {
      key: 'exportExcel',
      icon: <FileExcelOutlined />,
      label: '导出 Excel',
      disabled: exportLoading,
      onClick: () => handleBatchExport('excel'),
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'batchDelete',
      icon: <DeleteFilled />,
      label: '批量删除',
      danger: true,
      onClick: handleBatchDelete,
    },
  ], [batchCategoryForm, exportLoading, handleBatchDelete, handleBatchExport]);

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      validateTrigger={['onBlur', 'onChange']}
      style={{ marginTop: 16 }}
    >
      <Form.Item
        name="name"
        label="商品名称"
        rules={[
          { required: true, message: '请输入商品名称' },
          { min: 2, message: '商品名称至少2个字符' },
          { max: 100, message: '商品名称最多100个字符' },
        ]}
      >
        <Input placeholder="输入商品名称" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="categoryId" label="商品分类">
            <Select
              placeholder="选择分类"
              allowClear
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="tags" label="商品标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车"
              tokenSeparators={[',']}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        name="description"
        label="商品描述"
        rules={[
          { max: 1500, message: '商品描述最多1500个字符' },
        ]}
      >
        <TextArea rows={4} placeholder="输入商品描述，或使用 AI 自动生成" />
      </Form.Item>

      <Form.Item
        name="productType"
        label={<span>商品分类 <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>(辅助AI生成描述)</Text></span>}
      >
        <Input placeholder="例如：数码产品、服装、美妆" />
      </Form.Item>

      <Form.Item
        name="features"
        label={<span>商品特点 <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>(逗号分隔，辅助AI生成描述)</Text></span>}
      >
        <Input placeholder="例如：轻薄、高性能、长续航" />
      </Form.Item>

      <div style={{ marginBottom: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Select
          value={aiStyle}
          onChange={setAiStyle}
          style={{ minWidth: 120 }}
          size="small"
          options={[
            { value: 'professional', label: '专业严谨' },
            { value: 'lively', label: '活泼生动' },
            { value: 'luxury', label: '奢华高端' },
          ]}
        />
        <Button
          icon={<RobotOutlined />}
          loading={aiLoading}
          onClick={handleAIDescription}
          size="small"
        >
          AI 生成描述
        </Button>
      </div>

      <Form.Item label="商品图片 (支持jpg/png，单张10MB以内)">
        <Dragger
          listType="picture-card"
          fileList={uploadFileList}
          action={`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/upload/images`}
          headers={{
            Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
          }}
          name="images"
          multiple
          onChange={handleUploadChange}
          beforeUpload={beforeUpload}
          maxCount={5}
          accept="image/*"
        >
          {uploadFileList.length >= 5 ? null : (
            <div>
              <InboxOutlined style={{ fontSize: 24, color: '#d4a017' }} />
              <div style={{ marginTop: 8, fontSize: 12 }}>点击或拖拽上传</div>
            </div>
          )}
        </Dragger>
        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
          最多上传 5 张图片，支持 jpg/png 格式，单张不超过 10MB
        </Text>
      </Form.Item>

      <Card
        title={
          <Space>
            <BulbOutlined style={{ color: '#d4a017' }} />
            <span>AI 智能定价建议</span>
          </Space>
        }
        size="small"
        style={{
          marginBottom: 24,
          borderRadius: 8,
          border: '1px solid rgba(212,160,23,0.2)',
          background: 'linear-gradient(135deg, rgba(212,160,23,0.03) 0%, rgba(212,160,23,0.08) 100%)',
        }}
        extra={
          <Button
            icon={<BulbOutlined />}
            loading={pricingLoading}
            onClick={handleAIPricing}
            size="small"
            type="primary"
            ghost
          >
            获取建议
          </Button>
        }
      >
        {pricingSuggestion ? (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <Alert
              type="info"
              message={
                <span>
                  建议起拍价: <Text strong style={{ color: '#d4a017', fontSize: 16 }}>¥{pricingSuggestion.suggestedStartingPrice}</Text>
                  {' | '}
                  建议加价幅度: <Text strong style={{ color: '#d4a017', fontSize: 16 }}>¥{pricingSuggestion.suggestedPriceIncrement}</Text>
                </span>
              }
              description={pricingSuggestion.reasoning}
              showIcon
              action={
                <Button size="small" type="primary" onClick={handleApplyPricing}>
                  采用建议
                </Button>
              }
            />
            <div>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                置信度: {Math.round(pricingSuggestion.confidence * 100)}%
              </Text>
              <Progress
                percent={Math.round(pricingSuggestion.confidence * 100)}
                status="active"
                strokeColor="#d4a017"
                size="small"
              />
            </div>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="市场均价"
                  value={pricingSuggestion.marketData.averagePrice}
                  prefix="¥"
                  valueStyle={{ fontSize: 14, color: '#d4a017' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="价格区间"
                  value={`¥${pricingSuggestion.marketData.priceRange[0]} - ¥${pricingSuggestion.marketData.priceRange[1]}`}
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="竞品数量"
                  value={pricingSuggestion.marketData.competitorCount}
                  suffix="个"
                  valueStyle={{ fontSize: 14 }}
                />
              </Col>
            </Row>
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            输入商品名称后，点击「获取建议」获取 AI 智能定价推荐
          </Text>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Form.Item
            name="startingPrice"
            label="起拍价 (元)"
            rules={[
              { required: true, message: '请输入起拍价' },
              { type: 'number', min: 0.01, message: '起拍价必须大于0' },
            ]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="priceIncrement"
            label="加价幅度 (元)"
            rules={[
              { required: true, message: '请输入加价幅度' },
              { type: 'number', min: 0.01, message: '加价幅度必须大于0' },
            ]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="0.00" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={8}>
          <Form.Item
            name="duration"
            label="竞拍时长 (分钟)"
            rules={[
              { required: true, message: '请输入竞拍时长' },
              { type: 'number', min: 1, max: 1440, message: '竞拍时长1-1440分钟' },
            ]}
          >
            <InputNumber min={1} max={1440} style={{ width: '100%' }} placeholder="60" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12}>
          <Form.Item
            name="capPrice"
            label="封顶价 (元, 可选)"
            rules={[
              { type: 'number', min: 0.01, message: '封顶价必须大于0' },
            ]}
          >
            <InputNumber min={0.01} step={0.01} style={{ width: '100%' }} placeholder="不设置" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12}>
          <Form.Item
            name="delayTime"
            label="延时时间 (秒)"
            rules={[
              { type: 'number', min: 10, max: 30, message: '延时时间10-30秒' },
            ]}
          >
            <InputNumber min={10} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
    </Form>
  );

  const formFooter = (
    <div style={{ textAlign: 'right' }}>
      <Space>
        <Button onClick={() => setModalVisible(false)}>取消</Button>
        <Button type="primary" onClick={handleSubmit}>
          {editingProduct ? '更新' : '创建'}
        </Button>
      </Space>
    </div>
  );

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <GoldDivider />
          <Title level={4} style={{ margin: 0 }}>
            商品管理
          </Title>
          <Text type="secondary">管理您的竞拍商品</Text>
        </div>
        <Space wrap>
          <Input
            className="product-search-input"
            placeholder="搜索商品... (Ctrl+F)"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: isMobile ? '100%' : 220 }}
          />
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            style={{ width: 130 }}
            options={STATUS_OPTIONS}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建商品
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col xs={24} md={5}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              marginBottom: 16,
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(212,160,23,0.15)',
            }}
            bodyStyle={{ padding: 0 }}
          >
            <div style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid rgba(212,160,23,0.15)',
            }}>
              <Text strong style={{ color: '#d4a017', fontSize: 14 }}>
                <AppstoreOutlined style={{ marginRight: 6 }} />
                商品分类
              </Text>
              <Button
                type="text"
                size="small"
                icon={<PlusCircleOutlined style={{ color: '#d4a017' }} />}
                onClick={() => {
                  categoryForm.resetFields();
                  setCategoryModalVisible(true);
                }}
              />
            </div>
            <div style={{ padding: '4px 0' }}>
              <div
                onClick={() => { setSelectedCategoryId(null); setPage(1); }}
                style={{
                  padding: '8px 16px',
                  cursor: 'pointer',
                  background: selectedCategoryId === null ? 'rgba(212,160,23,0.12)' : 'transparent',
                  borderLeft: selectedCategoryId === null ? '3px solid #d4a017' : '3px solid transparent',
                  transition: 'all 0.2s',
                }}
              >
                <Text style={{ color: selectedCategoryId === null ? '#d4a017' : 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                  全部
                </Text>
                <Badge
                  count={total}
                  style={{ backgroundColor: 'rgba(212,160,23,0.2)', color: '#d4a017', marginLeft: 8 }}
                  overflowCount={999}
                />
              </div>
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => { setSelectedCategoryId(cat.id); setPage(1); }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    background: selectedCategoryId === cat.id ? 'rgba(212,160,23,0.12)' : 'transparent',
                    borderLeft: selectedCategoryId === cat.id ? '3px solid #d4a017' : '3px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Text style={{ color: selectedCategoryId === cat.id ? '#d4a017' : 'rgba(255,255,255,0.85)', fontSize: 13 }}>
                    {cat.icon && <span style={{ marginRight: 6 }}>{cat.icon}</span>}
                    {cat.name}
                  </Text>
                  {cat.productCount !== undefined && (
                    <Badge
                      count={cat.productCount}
                      style={{ backgroundColor: 'rgba(212,160,23,0.2)', color: '#d4a017', marginLeft: 8 }}
                      overflowCount={999}
                    />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} md={19}>
          {selectedRowKeys.length > 0 && (
            <div style={{
              marginBottom: 16,
              padding: '8px 16px',
              background: 'rgba(212,160,23,0.06)',
              borderRadius: 8,
              border: '1px solid rgba(212,160,23,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
              <Text>已选择 <Text strong style={{ color: '#d4a017' }}>{selectedRowKeys.length}</Text> 项</Text>
              <Space wrap size="small">
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  loading={batchStatusLoading}
                  onClick={() => handleBatchStatus('active')}
                >
                  批量上架
                </Button>
                <Button
                  size="small"
                  icon={<ArrowDownOutlined />}
                  loading={batchStatusLoading}
                  onClick={() => handleBatchStatus('cancelled')}
                >
                  批量下架
                </Button>
                <Dropdown menu={{ items: batchMenuItems }}>
                  <Button size="small" icon={<AppstoreOutlined />}>
                    更多操作
                  </Button>
                </Dropdown>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>取消选择</Button>
              </Space>
            </div>
          )}

          <Card bordered={false} style={{ borderRadius: 12 }}>
            {(products ?? []).length === 0 && !loading ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  debouncedSearch || statusFilter || selectedCategoryId
                    ? '没有找到匹配的商品，试试其他搜索条件'
                    : <span>还没有商品，<a href="#create" onClick={(e) => { e.preventDefault(); handleCreate(); }}>立即创建第一个商品</a></span>
                }
              >
                {!debouncedSearch && !statusFilter && !selectedCategoryId && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                    创建商品
                  </Button>
                )}
              </Empty>
            ) : (
              <Table
                columns={columns}
                dataSource={products ?? []}
                rowKey="id"
                loading={loading}
                scroll={{ x: 800 }}
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                  getCheckboxProps: (record: Product) => ({
                    disabled: record.status !== 'pending',
                  }),
                }}
                pagination={{
                  current: page,
                  total,
                  pageSize: 10,
                  onChange: (p) => setPage(p),
                  showTotal: (t) => `共 ${t} 条`,
                  responsive: true,
                  showSizeChanger: false,
                }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {isMobile ? (
        <Drawer
          title={editingProduct ? '编辑商品' : '创建商品'}
          open={modalVisible}
          onClose={() => setModalVisible(false)}
          width="100%"
          extra={formFooter}
          destroyOnClose
        >
          {formContent}
        </Drawer>
      ) : (
        <Modal
          title={editingProduct ? '编辑商品' : '创建商品'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={formFooter}
          width={640}
          destroyOnClose
          style={{ maxWidth: '95vw', top: 20 }}
          styles={{ content: { borderRadius: 12 } }}
        >
          {formContent}
        </Modal>
      )}

      <Modal
        title={
          <Space>
            <DollarOutlined style={{ color: '#d4a017' }} />
            <span>批量修改价格</span>
          </Space>
        }
        open={batchPriceModalVisible}
        onCancel={() => { setBatchPriceModalVisible(false); setBatchPriceValue(null); }}
        onOk={handleBatchPriceSubmit}
        confirmLoading={batchPriceLoading}
        okText="确认修改"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            将对选中的 <Text strong>{selectedRowKeys.length}</Text> 个商品中状态为"待开始"的商品生效
          </Text>
        </div>
        <Form layout="vertical">
          <Form.Item label="修改方式">
            <Select
              value={batchPriceType}
              onChange={setBatchPriceType}
              options={[
                { value: 'increase', label: '加价（在原价基础上增加）' },
                { value: 'discount', label: '打折（按百分比降价）' },
                { value: 'uniform', label: '统一价格（设置为相同价格）' },
              ]}
            />
          </Form.Item>
          <Form.Item label={
            batchPriceType === 'increase' ? '加价金额 (元)' :
            batchPriceType === 'discount' ? '折扣百分比 (%)' :
            '统一价格 (元)'
          }>
            <InputNumber
              min={batchPriceType === 'discount' ? 1 : 0.01}
              max={batchPriceType === 'discount' ? 99 : 99999999.99}
              step={batchPriceType === 'discount' ? 1 : 0.01}
              value={batchPriceValue}
              onChange={(v) => setBatchPriceValue(v)}
              style={{ width: '100%' }}
              placeholder={
                batchPriceType === 'increase' ? '输入加价金额，如 10' :
                batchPriceType === 'discount' ? '输入折扣，如 20 表示降价20%' :
                '输入统一价格，如 99.00'
              }
              addonAfter={batchPriceType === 'discount' ? '% off' : '元'}
            />
          </Form.Item>
          {batchPriceType === 'discount' && batchPriceValue && (
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 8, marginTop: -8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                示例：原价 ¥100 的商品 → 折后价 ¥{Math.round(100 * (1 - batchPriceValue / 100) * 100) / 100}
              </Text>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <TagsOutlined style={{ color: '#d4a017' }} />
            <span>批量设置分类/标签</span>
          </Space>
        }
        open={batchCategoryModalVisible}
        onCancel={() => { setBatchCategoryModalVisible(false); batchCategoryForm.resetFields(); }}
        onOk={handleBatchCategorySubmit}
        confirmLoading={batchCategoryLoading}
        okText="确认修改"
        cancelText="取消"
        width={480}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            将对选中的 <Text strong>{selectedRowKeys.length}</Text> 个商品中状态为"待开始"的商品生效
          </Text>
        </div>
        <Form form={batchCategoryForm} layout="vertical">
          <Form.Item name="categoryId" label="商品分类">
            <Select
              placeholder="选择分类（不修改则留空）"
              allowClear
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="tags" label="商品标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车（不修改则留空）"
              tokenSeparators={[',']}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#d4a017' }} />
            <span>AI 生成的商品描述</span>
          </Space>
        }
        open={aiModalVisible}
        onCancel={() => setAiModalVisible(false)}
        width={600}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Button
                icon={<CopyOutlined />}
                onClick={() => {
                  navigator.clipboard.writeText(aiResult);
                  message.success('已复制到剪贴板');
                }}
              >
                复制
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setAiModalVisible(false);
                  handleAIDescription();
                }}
              >
                重新生成
              </Button>
            </Space>
            <Space>
              <Button onClick={() => setAiModalVisible(false)}>取消</Button>
              <Button type="primary" onClick={handleUseAIDescription}>
                使用此描述
              </Button>
            </Space>
          </div>
        }
      >
        <div style={{ marginBottom: 8 }}>
          <Tag color={
            aiStyle === 'professional' ? 'blue' :
            aiStyle === 'lively' ? 'green' : 'gold'
          }>
            {aiStyle === 'professional' ? '专业严谨' :
             aiStyle === 'lively' ? '活泼生动' : '奢华高端'}
          </Tag>
        </div>
        <Paragraph
          style={{
            background: '#f5f5f5',
            padding: 16,
            borderRadius: 8,
            whiteSpace: 'pre-wrap',
            maxHeight: 400,
            overflow: 'auto',
            marginBottom: 0,
          }}
        >
          {aiResult}
        </Paragraph>
      </Modal>

      <Modal
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#d4a017' }} />
            <span>新建分类</span>
          </Space>
        }
        open={categoryModalVisible}
        onCancel={() => setCategoryModalVisible(false)}
        onOk={async () => {
          try {
            const values = await categoryForm.validateFields();
            await dispatch(createCategory({
              name: values.name,
              icon: values.icon || undefined,
              sortOrder: values.sortOrder || undefined,
            })).unwrap();
            message.success('分类创建成功');
            setCategoryModalVisible(false);
          } catch (error: any) {
            if (error.errorFields) return;
            message.error(error || '创建分类失败');
          }
        }}
        okText="创建"
        cancelText="取消"
        width={420}
        destroyOnClose
      >
        <Form form={categoryForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="分类名称"
            rules={[
              { required: true, message: '请输入分类名称' },
              { max: 50, message: '分类名称最多50个字符' },
            ]}
          >
            <Input placeholder="输入分类名称" />
          </Form.Item>
          <Form.Item name="icon" label="分类图标 (可选)">
            <Input placeholder="输入图标名称，如：📱" />
          </Form.Item>
          <Form.Item name="sortOrder" label="排序 (可选)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="数值越小越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductsPage;
