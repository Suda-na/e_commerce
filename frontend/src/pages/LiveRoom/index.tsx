import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Typography,
  Tag,
  Select,
  Table,
  Statistic,
  Badge,
  Tooltip,
  Empty,
  message,
  Divider,
  FloatButton,
  Drawer,
  List,
  Avatar,
  Popconfirm,
} from 'antd';
import {
  VideoCameraOutlined,
  AppstoreAddOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  UserOutlined,
  EyeOutlined,
  DollarOutlined,
  RiseOutlined,
  CopyOutlined,
  ReloadOutlined,
  SoundOutlined,
  FireOutlined,
  TeamOutlined,
  TrophyOutlined,
  BulbOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  FullscreenOutlined,
  MessageOutlined,
  HeartOutlined,
  ShoppingCartOutlined,
  MinusCircleOutlined,
  ClockCircleOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import { fetchProducts } from '../../store/slices/productSlice';
import { fetchAuctions } from '../../store/slices/auctionSlice';
import { auctionService } from '../../services/auction.service';
import { aiAssistantService } from '../../services/ai-assistant.service';
import { socketService } from '../../services/socket.service';
import { formatPrice, formatCountdown } from '../../utils/hooks';
import { Product, Auction, LiveScript, LiveScriptStyle, LiveRoomStats, LeaderboardEntry } from '../../types';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text, Paragraph } = Typography;

const SCRIPT_SECTIONS = [
  { key: 'opening', label: '开场白', icon: <SoundOutlined />, color: '#1890ff' },
  { key: 'productIntro', label: '商品介绍', icon: <ShoppingCartOutlined />, color: '#52c41a' },
  { key: 'biddingGuide', label: '引导出价', icon: <RiseOutlined />, color: '#d4a017' },
  { key: 'urgencyTactics', label: '紧迫感', icon: <FireOutlined />, color: '#ff4d4f' },
  { key: 'closing', label: '结束语', icon: <TrophyOutlined />, color: '#722ed1' },
] as const;

const LiveRoomPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const { products } = useAppSelector((state) => state.products);
  const { auctions } = useAppSelector((state) => state.auctions);
  const { token } = useAppSelector((state) => state.auth);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [liveScript, setLiveScript] = useState<LiveScript | null>(null);
  const [scriptStyle, setScriptStyle] = useState<LiveScriptStyle>('enthusiastic');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [quickAddVisible, setQuickAddVisible] = useState(false);
  const [scriptDrawerVisible, setScriptDrawerVisible] = useState(false);
  const [liveStats, setLiveStats] = useState<LiveRoomStats>({
    onlineCount: 0,
    totalViews: 0,
    totalBids: 0,
    totalRevenue: 0,
    activeAuctions: 0,
    recentBids: [],
  });
  const [isLive, setIsLive] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 倒计时状态：存储每个竞拍的剩余秒数
  const [countdowns, setCountdowns] = useState<Record<number, number>>({});
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 本地 endTime 覆盖：延时事件更新后，优先使用此值而非 Redux 中的旧值
  const endTimeOverridesRef = useRef<Record<number, number>>({});
  // 排行榜数据：存储每个竞拍的排行榜
  const [leaderboards, setLeaderboards] = useState<Record<number, LeaderboardEntry[]>>({});
  // 最新出价动态：存储所有竞拍的最新出价
  const [recentBids, setRecentBids] = useState<Array<{
    id: number;
    username: string;
    amount: number;
    productName: string;
    time: string;
    auctionId: number;
  }>>([]);

  const pendingProducts = useMemo(() => (products ?? []).filter((p) => p.status === 'pending'), [products]);
  const activeAuctions = useMemo(() => (auctions ?? []).filter((a) => a.status === 'active'), [auctions]);
  // 基于竞拍状态判断真正的活跃商品：只有竞拍状态为active的商品才算进行中
  const activeAuctionProductIds = useMemo(() => new Set(activeAuctions.map(a => a.productId).filter(Boolean)), [activeAuctions]);
  const activeProducts = useMemo(() => 
    (products ?? []).filter((p) => p.status === 'active' && activeAuctionProductIds.has(p.id)), 
    [products, activeAuctionProductIds]
  );
  // 已结束但状态仍为active的商品（竞拍已结束，需刷新或手动处理）
  const endedProducts = useMemo(() => 
    (products ?? []).filter((p) => p.status === 'active' && !activeAuctionProductIds.has(p.id)), 
    [products, activeAuctionProductIds]
  );

  const activeAuctionsLength = activeAuctions.length;
  const activeAuctionsBids = useMemo(() => activeAuctions.reduce((sum, a) => sum + a.bidCount, 0), [activeAuctions]);
  const activeAuctionsRevenue = useMemo(() => activeAuctions.reduce((sum, a) => sum + a.currentPrice, 0), [activeAuctions]);

  useEffect(() => {
    dispatch(fetchProducts({ page: 1, pageSize: 100 }));
    dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
  }, [dispatch]);

  // WebSocket连接和事件监听
  useEffect(() => {
    if (!token || !isLive) return;

    socketService.connect(token);
    setSocketConnected(true);

    // 监听新出价事件
    const handleNewBid = (data: any) => {
      const auctionId = data.auctionId;
      if (data.bid) {
        // 更新最新出价动态
        const newBid = {
          id: Date.now(),
          username: data.bid.username || `用户#${data.bid.userId}`,
          amount: data.bid.amount,
          productName: data.productName || `竞拍 #${auctionId}`,
          time: new Date().toLocaleTimeString(),
          auctionId,
        };
        setRecentBids((prev) => [newBid, ...prev].slice(0, 50));

        // 更新统计数据
        setLiveStats((prev) => ({
          ...prev,
          totalBids: prev.totalBids + 1,
          totalRevenue: prev.totalRevenue + data.bid.amount,
        }));
      }

      // 重新获取该竞拍的排行榜
      if (auctionId) {
        auctionService.getLeaderboard(auctionId).then((leaderboard) => {
          setLeaderboards((prev) => ({
            ...prev,
            [auctionId]: leaderboard,
          }));
        }).catch(console.error);
      }

      // 新增：如果包含 endTime 更新，刷新该竞拍的倒计时
      if (data.endTime) {
        const endTimeMs = typeof data.endTime === 'number' ? data.endTime : new Date(data.endTime).getTime();
        endTimeOverridesRef.current[auctionId] = endTimeMs;
        setCountdowns((prev) => {
          const now = Date.now();
          const newDiff = Math.max(0, Math.floor((endTimeMs - now) / 1000));
          return { ...prev, [auctionId]: newDiff };
        });
        // 同时刷新 Redux 中的竞拍数据，确保 endTime 同步
        dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
      }
    };

    // 监听排行榜更新事件
    const handleLeaderboardUpdate = (data: any) => {
      const auctionId = data.auctionId;
      if (data.leaderboard) {
        setLeaderboards((prev) => ({
          ...prev,
          [auctionId]: data.leaderboard,
        }));
      }
    };

    // 监听在线人数更新
    const handleOnlineCount = (data: any) => {
      setLiveStats((prev) => ({
        ...prev,
        onlineCount: data.count || 0,
      }));
    };

    // 监听用户加入/离开
    const handleUserJoined = (data: any) => {
      console.log('User joined:', data.username);
    };

    const handleUserLeft = (data: any) => {
      console.log('User left:', data.username);
    };

    // 监听竞拍状态变化
    const handleAuctionStatus = (data: any) => {
      if (data.status === 'ended' || data.status === 'cancelled') {
        // 竞拍结束，移除排行榜
        setLeaderboards((prev) => {
          const newLeaderboards = { ...prev };
          delete newLeaderboards[data.auctionId];
          return newLeaderboards;
        });
        dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
      }
    };

    // 监听竞拍延时事件
    const handleTimeExtended = (data: any) => {
      const auctionId = data.auctionId;
      if (data.newEndTime) {
        const endTimeMs = typeof data.newEndTime === 'number' ? data.newEndTime : new Date(data.newEndTime).getTime();
        // 记录到本地覆盖，倒计时定时器会优先使用此值
        endTimeOverridesRef.current[auctionId] = endTimeMs;
        // 立即更新本地倒计时状态，实现即时响应
        setCountdowns((prev) => {
          const now = Date.now();
          const newDiff = Math.max(0, Math.floor((endTimeMs - now) / 1000));
          return { ...prev, [auctionId]: newDiff };
        });
        // 提示商家延时信息
        const extSeconds = data.extensionSeconds || 0;
        if (extSeconds > 0) {
          message.info(`竞拍 #${auctionId} 已延时 ${extSeconds} 秒`);
        }
        // 同时刷新 Redux 中的竞拍数据
        dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
      }
    };

    // 监听达到封顶价事件
    const handleCapPriceReached = (data: any) => {
      const auctionId = data.auctionId;
      const capPrice = data.capPrice;
      const winnerId = data.winnerId;
      message.warning(
        `竞拍 #${auctionId} 已达到封顶价 ¥${capPrice}，自动成交！中标用户: #${winnerId}`
      );
      // 刷新竞拍数据
      dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
    };

    // 监听竞拍结束事件
    const handleAuctionEnded = (data: any) => {
      const auctionId = data.auctionId;
      const winnerId = data.winnerId;
      const finalPrice = data.finalPrice;
      message.success(
        `竞拍 #${auctionId} 已结束，中标用户: #${winnerId}，成交价: ¥${finalPrice}`
      );
      // 移除排行榜
      setLeaderboards((prev) => {
        const newLeaderboards = { ...prev };
        delete newLeaderboards[auctionId];
        return newLeaderboards;
      });
      // 停止倒计时
      setCountdowns((prev) => {
        const newCountdowns = { ...prev };
        delete newCountdowns[auctionId];
        return newCountdowns;
      });
      // 清除 endTime 覆盖
      delete endTimeOverridesRef.current[auctionId];
      // 刷新竞拍数据
      dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
    };

    socketService.on('new_bid', handleNewBid);
    socketService.on('leaderboard_update', handleLeaderboardUpdate);
    socketService.on('online_count', handleOnlineCount);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    socketService.on('auction_status', handleAuctionStatus);
    socketService.on('auction_status_change', handleAuctionStatus);
    socketService.on('time_extended', handleTimeExtended);
    socketService.on('cap_price_reached', handleCapPriceReached);
    socketService.on('auction_ended', handleAuctionEnded);

    return () => {
      socketService.off('new_bid', handleNewBid);
      socketService.off('leaderboard_update', handleLeaderboardUpdate);
      socketService.off('online_count', handleOnlineCount);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.off('auction_status', handleAuctionStatus);
      socketService.off('auction_status_change', handleAuctionStatus);
      socketService.off('time_extended', handleTimeExtended);
      socketService.off('cap_price_reached', handleCapPriceReached);
      socketService.off('auction_ended', handleAuctionEnded);
      socketService.disconnect();
      setSocketConnected(false);
    };
  }, [token, isLive, dispatch]);

  useEffect(() => {
    if (isLive) {
      statsTimerRef.current = setInterval(() => {
        setLiveStats((prev) => ({
          ...prev,
          onlineCount: Math.max(0, prev.onlineCount + Math.floor(Math.random() * 5) - 2),
          totalViews: prev.totalViews + Math.floor(Math.random() * 3),
          activeAuctions: activeAuctionsLength,
        }));
      }, 3000);
    }
    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [isLive, activeAuctionsLength]);

  useEffect(() => {
    setLiveStats((prev) => ({
      ...prev,
      activeAuctions: activeAuctionsLength,
      totalBids: activeAuctionsBids,
      totalRevenue: activeAuctionsRevenue,
    }));
  }, [activeAuctionsLength, activeAuctionsBids, activeAuctionsRevenue]);

  // 倒计时定时器
  useEffect(() => {
    if (activeAuctions.length === 0) {
      setCountdowns({});
      return;
    }

    const updateCountdowns = () => {
      const now = Date.now();
      const newCountdowns: Record<number, number> = {};
      activeAuctions.forEach((auction) => {
        if (auction.endTime) {
          // 优先使用本地覆盖的 endTime（延时事件更新后 Redux 还未刷新时使用）
          const overriddenEndTime = endTimeOverridesRef.current[auction.id];
          const end = overriddenEndTime
            ? overriddenEndTime
            : new Date(auction.endTime).getTime();
          const diff = Math.max(0, Math.floor((end - now) / 1000));
          newCountdowns[auction.id] = diff;
          // 如果 Redux 数据已经追上了覆盖值，清除覆盖
          if (overriddenEndTime && new Date(auction.endTime).getTime() >= overriddenEndTime - 1000) {
            delete endTimeOverridesRef.current[auction.id];
          }
        }
      });
      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    countdownTimerRef.current = setInterval(updateCountdowns, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [activeAuctions]);

  // 为每个活跃竞拍获取排行榜数据
  useEffect(() => {
    if (!isLive || activeAuctions.length === 0) return;

    const fetchAllLeaderboards = async () => {
      const promises = activeAuctions.map(async (auction) => {
        try {
          const leaderboard = await auctionService.getLeaderboard(auction.id);
          return { auctionId: auction.id, leaderboard };
        } catch (error) {
          console.error(`获取竞拍 ${auction.id} 排行榜失败:`, error);
          return { auctionId: auction.id, leaderboard: [] };
        }
      });

      const results = await Promise.all(promises);
      const newLeaderboards: Record<number, LeaderboardEntry[]> = {};
      results.forEach(({ auctionId, leaderboard }) => {
        newLeaderboards[auctionId] = leaderboard;
      });
      setLeaderboards(newLeaderboards);
    };

    fetchAllLeaderboards();

    // 每30秒刷新一次排行榜
    const refreshTimer = setInterval(fetchAllLeaderboards, 30000);

    return () => {
      clearInterval(refreshTimer);
    };
  }, [isLive, activeAuctions]);

  const [listingProductId, setListingProductId] = useState<number | null>(null);
  const [delistingProductId, setDelistingProductId] = useState<number | null>(null);

  const handleQuickList = useCallback(async (product: Product) => {
    try {
      setListingProductId(product.id);
      await auctionService.listProduct(product.id);
      message.success(`商品「${product.name}」已上架，竞拍已开始`);
      dispatch(fetchProducts({ page: 1, pageSize: 100 }));
      dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '上架失败');
    } finally {
      setListingProductId(null);
    }
  }, [dispatch]);

  const handleDelist = useCallback(async (product: Product) => {
    try {
      setDelistingProductId(product.id);
      await auctionService.delistProduct(product.id);
      message.success(`商品「${product.name}」已下架`);
      dispatch(fetchProducts({ page: 1, pageSize: 100 }));
      dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
    } catch (error: any) {
      message.error(error?.response?.data?.message || error?.message || '下架失败');
    } finally {
      setDelistingProductId(null);
    }
  }, [dispatch]);

  const handleGenerateScript = async () => {
    if (!selectedProduct && !selectedAuction) {
      message.warning('请先选择一个商品');
      return;
    }

    setScriptLoading(true);
    try {
      // 如果选择了竞拍商品，使用竞拍信息；否则使用普通商品信息
      const productName = selectedAuction 
        ? (selectedAuction.product?.name || `竞拍 #${selectedAuction.id}`)
        : selectedProduct!.name;
      
      const productFeatures = selectedAuction
        ? (selectedAuction.product?.tags || [])
        : (selectedProduct?.tags || []);

      // 构建竞拍信息
      let auctionInfo = undefined;
      if (selectedAuction) {
        auctionInfo = {
          startingPrice: selectedAuction.product?.startingPrice || 0,
          currentPrice: selectedAuction.currentPrice,
          currentBidCount: selectedAuction.bidCount,
          timeRemaining: countdowns[selectedAuction.id] || undefined,
        };
      } else if (selectedProduct) {
        auctionInfo = {
          startingPrice: selectedProduct.startingPrice,
        };
      }

      const result = await aiAssistantService.generateLiveScript({
        productName,
        productFeatures,
        auctionInfo,
        style: scriptStyle,
      });
      if (result && result.opening) {
        setLiveScript(result);
        setScriptDrawerVisible(true);
        message.success('直播话术生成成功');
      } else {
        message.error('话术数据异常，请重试');
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || error?.message || '直播话术生成失败，请稍后重试';
      message.error(msg);
    } finally {
      setScriptLoading(false);
    }
  };

  const handleCopyScript = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const handleCopyAllScript = () => {
    if (!liveScript) return;
    const fullScript = SCRIPT_SECTIONS.map((s) => {
      const content = liveScript[s.key as keyof LiveScript];
      return `【${s.label}】\n${content}`;
    }).join('\n\n');
    navigator.clipboard.writeText(fullScript);
    message.success('完整话术已复制到剪贴板');
  };

  const toggleLive = () => {
    if (!isLive) {
      // 开始直播
      setLiveStats((prev) => ({
        ...prev,
        onlineCount: Math.floor(Math.random() * 50) + 20,
        totalViews: Math.floor(Math.random() * 100) + 50,
      }));

      // 连接WebSocket并加入所有活跃竞拍房间
      if (token) {
        socketService.connect(token);
        setSocketConnected(true);

        // 加入所有活跃竞拍房间
        activeAuctions.forEach((auction) => {
          socketService.joinAuction(auction.id);
        });
      }

      message.success('直播间已开启');
    } else {
      // 结束直播
      if (token) {
        // 离开所有竞拍房间
        activeAuctions.forEach((auction) => {
          socketService.leaveAuction(auction.id);
        });
        socketService.disconnect();
        setSocketConnected(false);
      }

      // 清空排行榜和出价记录
      setLeaderboards({});
      setRecentBids([]);

      message.info('直播间已关闭');
    }
    setIsLive(!isLive);
  };

  // 排行榜列定义（参考竞拍详情页的排行榜样式）
  const leaderboardColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 60,
      render: (_: any, __: any, index: number) => (
        <div style={{ textAlign: 'center' }}>
          {index < 3 ? (
            <TrophyOutlined
              style={{
                color: index === 0 ? '#d4a017' : index === 1 ? '#8c8c8c' : '#d4876c',
                fontSize: 18,
              }}
            />
          ) : (
            <Text type="secondary">{index + 1}</Text>
          )}
        </div>
      ),
    },
    {
      title: '用户',
      key: 'user',
      render: (_: any, record: LeaderboardEntry) => (
        <Space>
          <Avatar size={28} icon={<UserOutlined />} style={{ background: '#d4a017', color: '#0a0e27' }} />
          <Text>{record.username}</Text>
        </Space>
      ),
    },
    {
      title: '出价',
      key: 'amount',
      render: (_: any, record: LeaderboardEntry) => (
        <Text strong style={{ color: '#d4a017' }}>
          {formatPrice(record.amount)}
        </Text>
      ),
    },
  ];

  // 最新出价动态列定义
  const quickListColumns = [
    {
      title: '商品',
      key: 'name',
      render: (_: any, record: Product) => (
        <Space>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{formatPrice(record.startingPrice)}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: Product) => (
        <Button
          type="primary"
          size="small"
          icon={<PlayCircleOutlined />}
          loading={listingProductId === record.id}
          onClick={() => handleQuickList(record)}
        >
          上架
        </Button>
      ),
    },
  ];

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
            <VideoCameraOutlined style={{ marginRight: 8, color: '#d4a017' }} />
            直播间管理
          </Title>
          <Text type="secondary">直播竞拍专业工具</Text>
        </div>
        <Space wrap>
          <Badge status={isLive ? 'processing' : 'default'} text={isLive ? '直播中' : '未开播'} />
          <Button
            type={isLive ? 'default' : 'primary'}
            danger={isLive}
            icon={isLive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={toggleLive}
          >
            {isLive ? '结束直播' : '开始直播'}
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            bordered={false}
            style={{ borderRadius: 12, marginBottom: 16 }}
            title={
              <Space>
                <EyeOutlined style={{ color: '#d4a017' }} />
                <span>实时数据大屏</span>
                {isLive && <Tag color="red" style={{ animation: 'pulse 2s infinite' }}>LIVE</Tag>}
              </Space>
            }
            extra={
              <Button
                icon={<FullscreenOutlined />}
                size="small"
                type="text"
              />
            }
          >
            <Row gutter={[16, 16]}>
              <Col xs={12} sm={6}>
                <Statistic
                  title="在线人数"
                  value={liveStats.onlineCount}
                  prefix={<TeamOutlined style={{ color: '#1890ff' }} />}
                  valueStyle={{ color: '#1890ff', fontSize: 28 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="累计观看"
                  value={liveStats.totalViews}
                  prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
                  valueStyle={{ color: '#52c41a', fontSize: 28 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="出价次数"
                  value={liveStats.totalBids}
                  prefix={<RiseOutlined style={{ color: '#d4a017' }} />}
                  valueStyle={{ color: '#d4a017', fontSize: 28 }}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="成交额"
                  value={liveStats.totalRevenue}
                  prefix="¥"
                  valueStyle={{ color: '#ff4d4f', fontSize: 28 }}
                />
              </Col>
            </Row>

            <Divider style={{ margin: '20px 0 16px' }} />

            {/* 实时排行榜区域 */}
            <div style={{ marginBottom: 12 }}>
              <Space>
                <Text strong style={{ fontSize: 14 }}>
                  <TrophyOutlined style={{ marginRight: 6, color: '#d4a017' }} />
                  实时排行榜
                </Text>
                {isLive && (
                  <Tooltip title={socketConnected ? '实时连接正常' : '实时连接断开，数据可能延迟'}>
                    <Tag
                      icon={socketConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                      color={socketConnected ? 'success' : 'error'}
                      style={{ borderRadius: 12, padding: '2px 8px', fontSize: 11 }}
                    >
                      {socketConnected ? '实时' : '离线'}
                    </Tag>
                  </Tooltip>
                )}
              </Space>
            </div>

            {/* 显示每个活跃竞拍的排行榜 */}
            {isLive && activeAuctions.length > 0 ? (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {activeAuctions.map((auction) => {
                  const leaderboard = leaderboards[auction.id] || [];
                  return (
                    <div key={auction.id} style={{ marginBottom: 16 }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        marginBottom: 8,
                        padding: '8px 12px',
                        background: 'linear-gradient(135deg, rgba(212,160,23,0.1) 0%, rgba(212,160,23,0.05) 100%)',
                        borderRadius: 8,
                        border: '1px solid rgba(212,160,23,0.15)',
                      }}>
                        <Space>
                          <Text strong style={{ fontSize: 13 }}>
                            {auction.product?.name || `竞拍 #${auction.id}`}
                          </Text>
                          <Tag color="processing">进行中</Tag>
                        </Space>
                        <Space size={4}>
                          <Text style={{ color: '#d4a017', fontWeight: 700 }}>
                            {formatPrice(auction.currentPrice)}
                          </Text>
                          {countdowns[auction.id] !== undefined && (
                            <Space size={2}>
                              <ClockCircleOutlined style={{ fontSize: 12, color: countdowns[auction.id] < 60 ? '#ff4d4f' : '#d4a017' }} />
                              <Text style={{ fontSize: 12, color: countdowns[auction.id] < 60 ? '#ff4d4f' : '#d4a017', fontWeight: 600 }}>
                                {formatCountdown(countdowns[auction.id])}
                              </Text>
                            </Space>
                          )}
                        </Space>
                      </div>
                      {leaderboard.length > 0 ? (
                        <Table
                          columns={leaderboardColumns}
                          dataSource={leaderboard}
                          rowKey="userId"
                          size="small"
                          pagination={false}
                          showHeader={false}
                          style={{ marginBottom: 0 }}
                        />
                      ) : (
                        <div style={{ 
                          textAlign: 'center', 
                          padding: '12px 0',
                          color: 'rgba(0,0,0,0.45)',
                          fontSize: 12,
                        }}>
                          暂无出价记录
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={isLive ? '等待出价中...' : '开播后将显示实时排行榜'}
                style={{ padding: '20px 0' }}
              />
            )}

            {/* 最新出价动态 */}
            {isLive && recentBids.length > 0 && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <div style={{ marginBottom: 12 }}>
                  <Space>
                    <Text strong style={{ fontSize: 14 }}>
                      <SoundOutlined style={{ marginRight: 6, color: '#d4a017' }} />
                      最新出价动态
                    </Text>
                    <Badge count={recentBids.length} style={{ backgroundColor: '#d4a017' }} />
                  </Space>
                </div>
                <div style={{ maxHeight: 150, overflow: 'auto' }}>
                  <List
                    size="small"
                    dataSource={recentBids.slice(0, 10)}
                    renderItem={(bid) => (
                      <List.Item style={{ padding: '6px 0' }}>
                        <Space>
                          <Avatar size={20} icon={<UserOutlined />} style={{ background: '#d4a017', color: '#0a0e27' }} />
                          <Text style={{ fontSize: 12 }}>{bid.username}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>出价</Text>
                          <Text strong style={{ color: '#d4a017', fontSize: 12 }}>{formatPrice(bid.amount)}</Text>
                          <Text type="secondary" style={{ fontSize: 11 }}>{bid.time}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              </>
            )}
          </Card>

          <Card
            bordered={false}
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <AppstoreAddOutlined style={{ color: '#d4a017' }} />
                <span>商品快速上下架</span>
                <Badge count={pendingProducts.length} style={{ backgroundColor: '#d4a017' }} />
              </Space>
            }
            extra={
              <Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  进行中: {activeProducts.length}
                </Text>
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  onClick={() => dispatch(fetchProducts({ page: 1, pageSize: 100 }))}
                >
                  刷新
                </Button>
              </Space>
            }
          >
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              {activeProducts.slice(0, 4).map((product) => {
                // 找到对应的竞拍信息
                const auction = activeAuctions.find(a => a.productId === product.id);
                return (
                <Col xs={12} sm={6} key={product.id}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(212,160,23,0.2)',
                      background: 'linear-gradient(135deg, rgba(212,160,23,0.03) 0%, rgba(212,160,23,0.08) 100%)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {product.name}
                        </Text>
                        <Text style={{ color: '#d4a017', fontSize: 16, fontWeight: 700 }}>
                          {auction ? formatPrice(auction.currentPrice) : formatPrice(product.startingPrice)}
                        </Text>
                      </div>
                      <Tag color="processing" style={{ marginLeft: 4 }}>进行中</Tag>
                    </div>
                    {auction && (
                      <div style={{ marginTop: 4 }}>
                        <Space size={4}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{auction.bidCount}次出价</Text>
                          {countdowns[auction.id] !== undefined && (
                            <Text 
                              style={{ fontSize: 11, color: countdowns[auction.id] < 60 ? '#ff4d4f' : '#d4a017', fontWeight: 600 }}
                            >
                              ⏱ {formatCountdown(countdowns[auction.id])}
                            </Text>
                          )}
                        </Space>
                      </div>
                    )}
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <Popconfirm
                        title="确认下架"
                        description={`确定要下架「${product.name}」吗？下架后竞拍将被取消。`}
                        onConfirm={() => handleDelist(product)}
                        okText="确认"
                        cancelText="取消"
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          danger
                          size="small"
                          icon={<MinusCircleOutlined />}
                          loading={delistingProductId === product.id}
                        >
                          下架
                        </Button>
                      </Popconfirm>
                    </div>
                  </Card>
                </Col>
                );
              })}
              {/* 已结束竞拍的商品 */}
              {endedProducts.slice(0, 4 - activeProducts.length).map((product) => (
                <Col xs={12} sm={6} key={`ended-${product.id}`}>
                  <Card
                    size="small"
                    style={{
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.1)',
                      background: 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
                      opacity: 0.7,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>
                          {product.name}
                        </Text>
                        <Text style={{ color: '#999', fontSize: 14, fontWeight: 600 }}>
                          {formatPrice(product.startingPrice)}
                        </Text>
                      </div>
                      <Tag color="default" style={{ marginLeft: 4 }}>已结束</Tag>
                    </div>
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => {
                          dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
                          dispatch(fetchProducts({ page: 1, pageSize: 100 }));
                          message.info('正在刷新商品状态...');
                        }}
                      >
                        刷新状态
                      </Button>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>

            {/* 显示已结束竞拍数量提示 */}
            {endedProducts.length > 0 && activeProducts.length >= 4 && (
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  还有 {endedProducts.length} 个已结束的竞拍商品
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      dispatch(fetchAuctions({ page: 1, pageSize: 100 }));
                      dispatch(fetchProducts({ page: 1, pageSize: 100 }));
                      message.info('正在刷新...');
                    }}
                    style={{ padding: 0, marginLeft: 4 }}
                  >
                    刷新同步状态
                  </Button>
                </Text>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            <div style={{ marginBottom: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>待上架商品</Text>
            </div>
            {pendingProducts.length > 0 ? (
              <Table
                columns={quickListColumns}
                dataSource={pendingProducts}
                rowKey="id"
                size="small"
                pagination={{ pageSize: 5, size: 'small' }}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="暂无待上架商品"
                style={{ padding: '16px 0' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            bordered={false}
            style={{
              borderRadius: 12,
              marginBottom: 16,
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(212,160,23,0.15)',
            }}
            styles={{ body: { padding: 20 } }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: isLive
                  ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)'
                  : 'linear-gradient(135deg, #555 0%, #888 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                boxShadow: isLive ? '0 0 20px rgba(255,77,79,0.4)' : 'none',
              }}>
                <VideoCameraOutlined style={{ fontSize: 32, color: '#fff' }} />
              </div>
              <Title level={5} style={{ color: '#f0c040', margin: 0 }}>
                {isLive ? '直播进行中' : '直播间控制台'}
              </Title>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                {isLive ? '实时竞拍数据监控' : '点击"开始直播"开启'}
              </Text>
            </div>

            {isLive && (
              <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <HeartOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                      {Math.floor(liveStats.onlineCount * 0.6)}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>点赞</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <MessageOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                      {Math.floor(liveStats.totalViews * 0.3)}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>评论</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center' }}>
                    <DollarOutlined style={{ color: '#d4a017', fontSize: 18 }} />
                    <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                      {liveStats.activeAuctions}
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>竞拍中</div>
                  </div>
                </Col>
              </Row>
            )}

            <Button
              type="primary"
              block
              danger={isLive}
              icon={isLive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={toggleLive}
              size="large"
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              {isLive ? '结束直播' : '开始直播'}
            </Button>
          </Card>

          <Card
            bordered={false}
            style={{ borderRadius: 12 }}
            title={
              <Space>
                <RobotOutlined style={{ color: '#d4a017' }} />
                <span>AI 话术助手</span>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  选择商品
                </Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择要生成话术的商品（支持竞拍中商品）"
                  value={selectedAuction ? `auction_${selectedAuction.id}` : selectedProduct?.id}
                  onChange={(val) => {
                    if (typeof val === 'string' && val.startsWith('auction_')) {
                      // 选择了竞拍商品
                      const auctionId = parseInt(val.replace('auction_', ''));
                      const auction = activeAuctions.find((a) => a.id === auctionId);
                      setSelectedAuction(auction || null);
                      setSelectedProduct(null);
                    } else {
                      // 选择了普通商品
                      const p = (products ?? []).find((item) => item.id === val);
                      setSelectedProduct(p || null);
                      setSelectedAuction(null);
                    }
                  }}
                  showSearch
                  optionFilterProp="label"
                >
                  {/* 竞拍中商品分组 */}
                  {activeAuctions.length > 0 && (
                    <Select.OptGroup label={
                      <Space>
                        <FireOutlined style={{ color: '#ff4d4f' }} />
                        <span>竞拍中商品</span>
                        <Badge count={activeAuctions.length} style={{ backgroundColor: '#ff4d4f' }} />
                      </Space>
                    }>
                      {activeAuctions.map((auction) => (
                        <Select.Option
                          key={`auction_${auction.id}`}
                          value={`auction_${auction.id}`}
                          label={`${auction.product?.name || `竞拍 #${auction.id}`} - ${formatPrice(auction.currentPrice)}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Space>
                              <FireOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />
                              <Text>{auction.product?.name || `竞拍 #${auction.id}`}</Text>
                            </Space>
                            <Space size={4}>
                              <Text style={{ color: '#d4a017', fontWeight: 600 }}>
                                {formatPrice(auction.currentPrice)}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {auction.bidCount}次出价
                              </Text>
                            </Space>
                          </div>
                        </Select.Option>
                      ))}
                    </Select.OptGroup>
                  )}
                  {/* 普通商品分组 */}
                  <Select.OptGroup label={
                    <Space>
                      <ShoppingCartOutlined style={{ color: '#1890ff' }} />
                      <span>全部商品</span>
                    </Space>
                  }>
                    {(products ?? []).map((p) => (
                      <Select.Option
                        key={p.id}
                        value={p.id}
                        label={`${p.name} - ${formatPrice(p.startingPrice)}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>{p.name}</Text>
                          <Text type="secondary">{formatPrice(p.startingPrice)}</Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                </Select>
              </div>

              <div>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                  话术风格
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={scriptStyle}
                  onChange={setScriptStyle}
                  options={[
                    { value: 'enthusiastic', label: '🔥 激情型 - 热情有感染力' },
                    { value: 'professional', label: '💼 专业型 - 稳重有说服力' },
                    { value: 'friendly', label: '🤝 亲切型 - 温暖有亲和力' },
                  ]}
                />
              </div>

              <Button
                type="primary"
                block
                icon={<BulbOutlined />}
                loading={scriptLoading}
                onClick={handleGenerateScript}
                disabled={!selectedProduct && !selectedAuction}
                style={{ borderRadius: 8 }}
              >
                生成直播话术
              </Button>

              {liveScript && (
                <Button
                  block
                  icon={<CopyOutlined />}
                  onClick={handleCopyAllScript}
                  style={{ borderRadius: 8 }}
                >
                  复制完整话术
                </Button>
              )}
            </Space>
          </Card>

          {isLive && activeAuctions.length > 0 && (
            <Card
              bordered={false}
              style={{ borderRadius: 12, marginTop: 16 }}
              title={
                <Space>
                  <ThunderboltOutlined style={{ color: '#d4a017' }} />
                  <span>当前竞拍</span>
                </Space>
              }
            >
              <List
                size="small"
                dataSource={activeAuctions}
                renderItem={(auction) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <div style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong ellipsis style={{ maxWidth: '60%' }}>
                          {auction.product?.name || `竞拍 #${auction.id}`}
                        </Text>
                        <Space size={4}>
                          <Tag color="processing">进行中</Tag>
                          <Popconfirm
                            title="确认下架"
                            description={`确定要下架「${auction.product?.name || `竞拍 #${auction.id}`}」吗？`}
                            onConfirm={() => {
                              if (auction.productId) {
                                handleDelist({ id: auction.productId, name: auction.product?.name || '' } as Product);
                              }
                            }}
                            okText="确认"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              danger
                              size="small"
                              type="text"
                              icon={<MinusCircleOutlined />}
                              loading={delistingProductId === auction.productId}
                            />
                          </Popconfirm>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                        <Text style={{ color: '#d4a017', fontWeight: 700 }}>
                          {formatPrice(auction.currentPrice)}
                        </Text>
                        <Space size={4}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {auction.bidCount} 次出价
                          </Text>
                          {countdowns[auction.id] !== undefined && (
                            <Space size={2}>
                              <ClockCircleOutlined style={{ fontSize: 12, color: countdowns[auction.id] < 60 ? '#ff4d4f' : '#d4a017' }} />
                              <Text style={{ fontSize: 12, color: countdowns[auction.id] < 60 ? '#ff4d4f' : '#d4a017', fontWeight: 600 }}>
                                {formatCountdown(countdowns[auction.id])}
                              </Text>
                            </Space>
                          )}
                        </Space>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
      </Row>

      <FloatButton.Group
        trigger="click"
        icon={<AppstoreAddOutlined />}
        type="primary"
        style={{ right: 24, bottom: 80 }}
        badge={{ dot: isLive }}
      >
        <Tooltip title="快速上架商品">
          <FloatButton
            icon={<PlayCircleOutlined />}
            onClick={() => setQuickAddVisible(true)}
          />
        </Tooltip>
        <Tooltip title="AI话术助手">
          <FloatButton
            icon={<RobotOutlined />}
            onClick={() => {
              if (selectedProduct || selectedAuction) {
                handleGenerateScript();
              } else {
                setScriptDrawerVisible(true);
              }
            }}
          />
        </Tooltip>
        <Tooltip title="当前讲解商品">
          <FloatButton
            icon={<SoundOutlined />}
            onClick={() => setScriptDrawerVisible(true)}
          />
        </Tooltip>
      </FloatButton.Group>

      <Drawer
        title="快速上架商品"
        open={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        width={400}
      >
        {pendingProducts.length > 0 ? (
          <List
            dataSource={pendingProducts}
            renderItem={(product) => (
              <List.Item
                actions={[
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    loading={listingProductId === product.id}
                    onClick={() => handleQuickList(product)}
                  >
                    上架
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={product.name}
                  description={
                    <Space>
                      <Text style={{ color: '#d4a017', fontWeight: 700 }}>
                        {formatPrice(product.startingPrice)}
                      </Text>
                      {product.category && (
                        <Tag>{product.category.name}</Tag>
                      )}
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty description="暂无待上架商品" />
        )}
      </Drawer>

      <Drawer
        title={
          <Space>
            <RobotOutlined style={{ color: '#d4a017' }} />
            <span>AI 直播话术</span>
            {selectedAuction && <Tag color="red">{selectedAuction.product?.name || `竞拍 #${selectedAuction.id}`}</Tag>}
            {selectedProduct && <Tag color="gold">{selectedProduct.name}</Tag>}
          </Space>
        }
        open={scriptDrawerVisible}
        onClose={() => setScriptDrawerVisible(false)}
        width={500}
        extra={
          liveScript ? (
            <Space>
              <Button
                icon={<CopyOutlined />}
                size="small"
                onClick={handleCopyAllScript}
              >
                复制全部
              </Button>
              <Button
                icon={<ReloadOutlined />}
                size="small"
                loading={scriptLoading}
                onClick={handleGenerateScript}
              >
                重新生成
              </Button>
            </Space>
          ) : null
        }
      >
        {liveScript ? (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {SCRIPT_SECTIONS.map((section) => {
              const content = liveScript[section.key as keyof LiveScript];
              return (
                <Card
                  key={section.key}
                  size="small"
                  style={{
                    borderRadius: 8,
                    borderLeft: `3px solid ${section.color}`,
                  }}
                  styles={{ body: { padding: 12 } }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Space>
                      <span style={{ color: section.color }}>{section.icon}</span>
                      <Text strong style={{ fontSize: 13 }}>{section.label}</Text>
                    </Space>
                    <Tooltip title="复制">
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopyScript(content)}
                      />
                    </Tooltip>
                  </div>
                  <Paragraph style={{ margin: 0, fontSize: 13, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {content}
                  </Paragraph>
                </Card>
              );
            })}
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            {/* 抽屉内商品选择 */}
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                选择要生成话术的商品
              </Text>
              <Select
                style={{ width: '100%' }}
                placeholder="选择商品或竞拍中的商品"
                value={selectedAuction ? `auction_${selectedAuction.id}` : selectedProduct?.id}
                onChange={(val) => {
                  if (typeof val === 'string' && val.startsWith('auction_')) {
                    const auctionId = parseInt(val.replace('auction_', ''));
                    const auction = activeAuctions.find((a) => a.id === auctionId);
                    setSelectedAuction(auction || null);
                    setSelectedProduct(null);
                  } else {
                    const p = (products ?? []).find((item) => item.id === val);
                    setSelectedProduct(p || null);
                    setSelectedAuction(null);
                  }
                }}
                showSearch
                optionFilterProp="label"
              >
                {activeAuctions.length > 0 && (
                  <Select.OptGroup label={
                    <Space>
                      <FireOutlined style={{ color: '#ff4d4f' }} />
                      <span>🔥 竞拍中商品</span>
                      <Badge count={activeAuctions.length} style={{ backgroundColor: '#ff4d4f' }} />
                    </Space>
                  }>
                    {activeAuctions.map((auction) => (
                      <Select.Option
                        key={`auction_${auction.id}`}
                        value={`auction_${auction.id}`}
                        label={`${auction.product?.name || `竞拍 #${auction.id}`} - 当前价 ${formatPrice(auction.currentPrice)}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{auction.product?.name || `竞拍 #${auction.id}`}</div>
                            <div style={{ fontSize: 11, color: '#999' }}>
                              <Tag color="red" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>竞拍中</Tag>
                              {auction.bidCount} 次出价
                            </div>
                          </div>
                          <Text strong style={{ color: '#ff4d4f' }}>{formatPrice(auction.currentPrice)}</Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select.OptGroup>
                )}
                <Select.OptGroup label={
                  <Space>
                    <ShoppingCartOutlined style={{ color: '#1890ff' }} />
                    <span>全部商品</span>
                  </Space>
                }>
                  {(products ?? []).map((p) => (
                    <Select.Option
                      key={p.id}
                      value={p.id}
                      label={`${p.name} - ${formatPrice(p.startingPrice)}`}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                        <div>
                          <Text>{p.name}</Text>
                          {p.category && <Tag style={{ fontSize: 10, marginLeft: 6 }}>{p.category.name}</Tag>}
                        </div>
                        <Text type="secondary">{formatPrice(p.startingPrice)}</Text>
                      </div>
                    </Select.Option>
                  ))}
                </Select.OptGroup>
              </Select>
            </div>

            {/* 已选择提示 */}
            {(selectedProduct || selectedAuction) && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(212,160,23,0.08) 0%, rgba(212,160,23,0.03) 100%)',
                border: '1px solid rgba(212,160,23,0.2)',
                borderRadius: 8,
                padding: 12,
              }}>
                <Space align="start">
                  {selectedAuction ? (
                    <>
                      <FireOutlined style={{ color: '#ff4d4f', fontSize: 18, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ display: 'block' }}>{selectedAuction.product?.name || `竞拍 #${selectedAuction.id}`}</Text>
                        <Space size={8} style={{ marginTop: 4 }}>
                          <Tag color="red" style={{ margin: 0 }}>竞拍中</Tag>
                          <Text style={{ color: '#d4a017', fontSize: 13, fontWeight: 600 }}>当前价: {formatPrice(selectedAuction.currentPrice)}</Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>{selectedAuction.bidCount}次出价</Text>
                        </Space>
                      </div>
                    </>
                  ) : (
                    <>
                      <ShoppingCartOutlined style={{ color: '#1890ff', fontSize: 18, marginTop: 2 }} />
                      <div style={{ flex: 1 }}>
                        <Text strong style={{ display: 'block' }}>{selectedProduct!.name}</Text>
                        <Text style={{ color: '#d4a017', fontSize: 13, fontWeight: 600, display: 'block', marginTop: 4 }}>
                          起拍价: {formatPrice(selectedProduct!.startingPrice)}
                        </Text>
                      </div>
                    </>
                  )}
                </Space>
              </div>
            )}

            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              imageStyle={{ height: 80 }}
              description={
                <span style={{ fontSize: 13, color: '#999' }}>
                  选择商品后，AI将为你生成完整的直播话术
                  <br />
                  <span style={{ fontSize: 12 }}>支持开场白、商品介绍、引导出价等5大模块</span>
                </span>
              }
            >
              <Button
                type="primary"
                size="large"
                icon={<BulbOutlined />}
                onClick={handleGenerateScript}
                disabled={!selectedProduct && !selectedAuction}
                loading={scriptLoading}
                style={{ borderRadius: 8, minWidth: 160, height: 44, fontSize: 15 }}
              >
                生成直播话术
              </Button>
            </Empty>

            {/* 快捷风格选择 */}
            <div style={{
              background: '#fafafa',
              borderRadius: 8,
              padding: 12,
              border: '1px solid #f0f0f0',
            }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                话术风格偏好
              </Text>
              <Select
                style={{ width: '100%' }}
                value={scriptStyle}
                onChange={setScriptStyle}
                size="small"
                options={[
                  { value: 'enthusiastic', label: '🔥 激情型 - 热情有感染力' },
                  { value: 'professional', label: '💼 专业型 - 稳重有说服力' },
                  { value: 'friendly', label: '🤝 亲切型 - 温暖有亲和力' },
                ]}
              />
            </div>
          </Space>
        )}
      </Drawer>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LiveRoomPage;
