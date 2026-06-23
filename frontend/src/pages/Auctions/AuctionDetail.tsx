import React, { useEffect, useState, useRef } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Space,
  Statistic,
  Table,
  Button,
  List,
  Avatar,
  message,
  Descriptions,
  Badge,
  Divider,
  Spin,
  Empty,
  Tooltip,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  UserOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  RiseOutlined,
  CopyOutlined,
  BulbOutlined,
  SendOutlined,
  LoadingOutlined,
  WifiOutlined,
  DisconnectOutlined,
  SoundOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../utils/hooks';
import {
  fetchAuction,
  fetchLeaderboard,
  clearCurrentAuction,
  updateLeaderboard,
  updateCurrentPrice,
  updateOnlineCount,
  updateParticipantCount,
  updateAuctionStatus,
  updateEndTime,
} from '../../store/slices/auctionSlice';
import { formatPrice, formatDate, statusColors, auctionStatusLabels, formatCountdown } from '../../utils/hooks';
import { socketService } from '../../services/socket.service';
import { LeaderboardEntry, BroadcastSuggestionResponse } from '../../types';
import { aiAssistantService } from '../../services/ai-assistant.service';
import GoldDivider from '../../components/Common/GoldDivider';

const { Title, Text } = Typography;
const { TextArea } = Input;

const AuctionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { currentAuction, leaderboard, participantCount } = useAppSelector((state) => state.auctions);
  const { token } = useAppSelector((state) => state.auth);
  const [countdown, setCountdown] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 倒计时过渡动画状态
  const [countdownTransitioning, setCountdownTransitioning] = useState(false);
  const [countdownDisplaySeconds, setCountdownDisplaySeconds] = useState(0);
  const countdownTransitionRef = useRef<number | null>(null);
  const countdownTransitionStartRef = useRef(0);
  const countdownTransitionEndRef = useRef(0);

  // 延时动画状态
  const [delayAnimation, setDelayAnimation] = useState<{ show: boolean; seconds: number; progress: number }>({
    show: false,
    seconds: 0,
    progress: 0,
  });
  const delayAnimTimerRef = useRef<NodeJS.Timeout | null>(null);
  const delayStepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [socketConnected, setSocketConnected] = useState(false);
  const [recentBids, setRecentBids] = useState<any[]>([]);

  // Broadcast suggestion state
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<BroadcastSuggestionResponse | null>(null);
  const [broadcastContext, setBroadcastContext] = useState('');



  const auctionId = Number(id);

  useEffect(() => {
    if (auctionId) {
      dispatch(fetchAuction(auctionId));
      dispatch(fetchLeaderboard(auctionId));
    }

    return () => {
      dispatch(clearCurrentAuction());
      if (timerRef.current) clearInterval(timerRef.current);
      if (delayAnimTimerRef.current) clearTimeout(delayAnimTimerRef.current);
      if (delayStepTimerRef.current) clearInterval(delayStepTimerRef.current);
      if (countdownTransitionRef.current) {
        cancelAnimationFrame(countdownTransitionRef.current);
        countdownTransitionRef.current = null;
      }
    };
  }, [dispatch, auctionId]);

  // WebSocket connection for live updates
  useEffect(() => {
    if (!auctionId || !token) return;

    socketService.connect(token);
    socketService.joinAuction(auctionId);
    setSocketConnected(true);

    const handleNewBid = (data: any) => {
      if (data.auctionId === auctionId) {
        dispatch(updateCurrentPrice({ price: data.currentPrice, bidCount: data.bidCount }));
        dispatch(fetchLeaderboard(auctionId));
        if (data.bid) {
          setRecentBids((prev) => [data.bid, ...prev].slice(0, 20));
        }
        if (data.participantCount !== undefined) {
          dispatch(updateParticipantCount(data.participantCount));
        }
      }
    };

    const handleLeaderboardUpdate = (data: any) => {
      if (data.auctionId === auctionId) {
        dispatch(updateLeaderboard(data.leaderboard));
      }
    };

    const handleAuctionUpdate = (data: any) => {
      if (data.auctionId === auctionId) {
        dispatch(updateCurrentPrice({ price: data.currentPrice, bidCount: data.bidCount }));
        dispatch(updateOnlineCount(data.onlineCount));
      }
    };

    const handleOnlineCount = (data: any) => {
      if (data.auctionId === auctionId) {
        dispatch(updateOnlineCount(data.count));
      }
    };

    const handleUserJoined = (data: any) => {
      if (data.auctionId === auctionId) {
        // 后端会在 user_joined 后发送 online_count 事件
        console.log('User joined:', data.username);
      }
    };

    const handleUserLeft = (data: any) => {
      if (data.auctionId === auctionId) {
        // 后端会在 user_left 后发送 online_count 事件
        console.log('User left:', data.username);
      }
    };

    const handleAuctionEnded = (data: any) => {
      if (data.auctionId === auctionId) {
        // 立即更新 Redux 状态，避免等待 API 请求延迟
        if (currentAuction) {
          dispatch(updateCurrentPrice({
            price: data.finalPrice ?? data.currentPrice ?? currentAuction.currentPrice,
            bidCount: currentAuction.bidCount,
          }));
        }
        // 重新从后端获取完整数据
        dispatch(fetchAuction(auctionId));
        dispatch(fetchLeaderboard(auctionId));
        message.info('竞拍已结束！');
      }
    };

    const handleTimeExtended = (data: any) => {
      if (data.auctionId === auctionId) {
        // 计算旧的倒计时和新的倒计时
        const now = Date.now();
        let oldCountdown = 0;
        if (currentAuction?.endTime) {
          oldCountdown = Math.max(0, Math.floor((new Date(currentAuction.endTime).getTime() - now) / 1000));
        }
        let newCountdown = oldCountdown;
        if (data.newEndTime) {
          newCountdown = Math.max(0, Math.floor((new Date(data.newEndTime).getTime() - now) / 1000));
        }

        // 立即更新endTime，确保倒计时无延迟
        if (data.newEndTime) {
          dispatch(updateEndTime(new Date(data.newEndTime).toISOString()));
        }
        // 重新拉取完整数据以确保一致性
        dispatch(fetchAuction(auctionId));
        
        // 播放倒计时过渡动画（平滑数字递增）
        if (newCountdown > oldCountdown) {
          animateCountdownExtension(oldCountdown, newCountdown);
        }
        
        // 播放延时动画徽章
        const extensionSeconds = data.extensionSeconds || 0;
        if (extensionSeconds > 0) {
          playDelayAnimation(extensionSeconds);
        }
        message.info(`竞拍时间已延长 ${extensionSeconds} 秒！`);
      }
    };

    const handleOutbid = (data: any) => {
      if (data.auctionId === auctionId) {
        message.warning(`有人出价 ¥${data.newPrice}，当前价已更新`);
      }
    };

    const handleCapPriceReached = (data: any) => {
      if (data.auctionId === auctionId) {
        // 立即更新 Redux 状态
        if (currentAuction) {
          dispatch(updateCurrentPrice({
            price: data.finalPrice ?? data.currentPrice ?? currentAuction.currentPrice,
            bidCount: currentAuction.bidCount,
          }));
        }
        dispatch(fetchAuction(auctionId));
        dispatch(fetchLeaderboard(auctionId));
        message.success('已达到封顶价，竞拍自动成交！');
      }
    };

    socketService.on('new_bid', handleNewBid);
    socketService.on('leaderboard_update', handleLeaderboardUpdate);
    socketService.on('auction_update', handleAuctionUpdate);
    socketService.on('online_count', handleOnlineCount);
    socketService.on('user_joined', handleUserJoined);
    socketService.on('user_left', handleUserLeft);
    socketService.on('auction_ended', handleAuctionEnded);
    socketService.on('time_extended', handleTimeExtended);
    socketService.on('outbid', handleOutbid);
    socketService.on('cap_price_reached', handleCapPriceReached);

    return () => {
      socketService.leaveAuction(auctionId);
      socketService.off('new_bid', handleNewBid);
      socketService.off('leaderboard_update', handleLeaderboardUpdate);
      socketService.off('auction_update', handleAuctionUpdate);
      socketService.off('online_count', handleOnlineCount);
      socketService.off('user_joined', handleUserJoined);
      socketService.off('user_left', handleUserLeft);
      socketService.off('auction_ended', handleAuctionEnded);
      socketService.off('time_extended', handleTimeExtended);
      socketService.off('outbid', handleOutbid);
      socketService.off('cap_price_reached', handleCapPriceReached);
      setSocketConnected(false);
    };
  }, [auctionId, token, dispatch]);

  // Countdown timer
  useEffect(() => {
    if (currentAuction?.status === 'active' && currentAuction?.endTime) {
      const updateCountdown = () => {
        const end = new Date(currentAuction.endTime!).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((end - now) / 1000));
        setCountdown(diff);

        if (diff <= 0 && timerRef.current) {
          clearInterval(timerRef.current);
          // 倒计时归零，立即在本地结束竞拍，不等后端确认
          dispatch(updateAuctionStatus('completed'));
          // 同时从后端获取完整数据
          dispatch(fetchAuction(auctionId));
        }
      };

      updateCountdown();
      timerRef.current = setInterval(updateCountdown, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [currentAuction?.status, currentAuction?.endTime, auctionId, dispatch]);

  // Fetch broadcast suggestions
  const handleFetchSuggestions = async () => {
    if (!auctionId) return;
    setBroadcastLoading(true);
    try {
      const result = await aiAssistantService.getBroadcastSuggestion(auctionId, 'active', broadcastContext);
      setBroadcastResult(result);
    } catch (error) {
      message.error('获取话术建议失败，请稍后重试');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const handleCopySuggestion = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('已复制到剪贴板');
  };

  const handleCopyAllSuggestions = () => {
    if (broadcastResult?.suggestions?.length) {
      const allText = broadcastResult.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n');
      navigator.clipboard.writeText(allText);
      message.success('已复制全部话术到剪贴板');
    }
  };

  // 播放延时动画
  const playDelayAnimation = (seconds: number) => {
    if (delayAnimTimerRef.current) clearTimeout(delayAnimTimerRef.current);
    if (delayStepTimerRef.current) clearInterval(delayStepTimerRef.current);

    setDelayAnimation({ show: true, seconds, progress: 0 });

    const duration = Math.min(seconds * 100, 1500);
    const stepInterval = 50;
    const totalSteps = duration / stepInterval;
    const increment = seconds / totalSteps;
    let current = 0;

    delayStepTimerRef.current = setInterval(() => {
      current += increment;
      if (current >= seconds) {
        current = seconds;
        if (delayStepTimerRef.current) clearInterval(delayStepTimerRef.current);
      }
      setDelayAnimation((prev) => ({ ...prev, progress: Math.floor(current) }));
    }, stepInterval);

    delayAnimTimerRef.current = setTimeout(() => {
      if (delayStepTimerRef.current) clearInterval(delayStepTimerRef.current);
      setDelayAnimation({ show: false, seconds, progress: seconds });
    }, duration + 1200);
  };

  // 倒计时过渡动画（平滑数字递增）
  const animateCountdownExtension = (oldSeconds: number, newSeconds: number) => {
    if (countdownTransitionRef.current) {
      cancelAnimationFrame(countdownTransitionRef.current);
    }

    const duration = 800; // 动画时长800ms
    const startTime = performance.now();
    countdownTransitionStartRef.current = oldSeconds;
    countdownTransitionEndRef.current = newSeconds;

    setCountdownTransitioning(true);
    setCountdownDisplaySeconds(oldSeconds);

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // 使用easeOutCubic缓动函数
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentSeconds = Math.floor(oldSeconds + (newSeconds - oldSeconds) * easedProgress);

      setCountdownDisplaySeconds(currentSeconds);

      if (progress < 1) {
        countdownTransitionRef.current = requestAnimationFrame(animate);
      } else {
        // 动画结束
        setCountdownDisplaySeconds(newSeconds);
        setCountdownTransitioning(false);
        countdownTransitionRef.current = null;
      }
    };

    countdownTransitionRef.current = requestAnimationFrame(animate);
  };



  if (!currentAuction) {
    return <div>加载中...</div>;
  }

  const isActive = currentAuction.status === 'active';
  // 当前显示的倒计时秒数（考虑过渡动画）
  const displaySeconds = countdownTransitioning ? countdownDisplaySeconds : countdown;

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

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/merchant/auctions')}>
            返回
          </Button>
          <div>
            <GoldDivider />
            <Title level={4} style={{ margin: 0 }}>
              竞拍 #{currentAuction.id}
            </Title>
            <Text type="secondary">{currentAuction.product?.name}</Text>
          </div>
        </Space>
        <Space>
          <Tag
            color={statusColors[currentAuction.status]}
            style={{ borderRadius: 12, padding: '4px 16px', fontSize: 14 }}
          >
            {isActive && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#52c41a',
                  marginRight: 8,
                  animation: 'pulse 1.5s infinite',
                }}
              />
            )}
            {auctionStatusLabels[currentAuction.status]}
          </Tag>
          {isActive && (
            <Tooltip title={socketConnected ? '实时连接正常' : '实时连接断开，数据可能延迟'}>
              <Tag
                icon={socketConnected ? <WifiOutlined /> : <DisconnectOutlined />}
                color={socketConnected ? 'success' : 'error'}
                style={{ borderRadius: 12, padding: '4px 12px', fontSize: 12 }}
              >
                {socketConnected ? '实时' : '离线'}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(212,160,23,0.1) 0%, rgba(212,160,23,0.05) 100%)', border: '1px solid rgba(212,160,23,0.15)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title="当前价格"
              value={currentAuction.currentPrice || currentAuction.product?.startingPrice}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#d4a017', fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(22,119,255,0.1) 0%, rgba(22,119,255,0.05) 100%)', border: '1px solid rgba(22,119,255,0.15)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title="出价次数"
              value={currentAuction.bidCount}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: 'linear-gradient(135deg, rgba(82,196,26,0.1) 0%, rgba(82,196,26,0.05) 100%)', border: '1px solid rgba(82,196,26,0.15)' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title="竞拍人数"
              value={participantCount}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered={false} style={{ borderRadius: 12, background: displaySeconds < 60 && isActive ? 'linear-gradient(135deg, rgba(255,77,79,0.1) 0%, rgba(255,77,79,0.05) 100%)' : delayAnimation.show ? 'linear-gradient(135deg, rgba(212,160,23,0.15) 0%, rgba(212,160,23,0.05) 100%)' : 'linear-gradient(135deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.02) 100%)', border: displaySeconds < 60 && isActive ? '1px solid rgba(255,77,79,0.15)' : delayAnimation.show ? '1px solid rgba(212,160,23,0.3)' : '1px solid rgba(0,0,0,0.06)', transition: 'all 0.3s ease' }} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={isActive ? '剩余时间' : '竞拍时长'}
              value={isActive ? formatCountdown(displaySeconds) : `${currentAuction.product?.duration || 0}分钟`}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: displaySeconds < 60 && isActive ? '#ff4d4f' : delayAnimation.show ? '#d4a017' : undefined, transition: 'color 0.3s ease' }}
            />
            {delayAnimation.show && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                marginTop: 8,
                padding: '2px 12px',
                background: 'linear-gradient(135deg, #ff4d4f, #ff7875)',
                borderRadius: 20,
                animation: 'delayBadgeFadeIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}>
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>+</span>
                <span style={{ color: '#fff', fontSize: 20, fontWeight: 800, fontFamily: "'DIN Alternate', 'Roboto Condensed', Arial, sans-serif" }}>{delayAnimation.progress}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginLeft: 2 }}>s</span>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Leaderboard */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#d4a017' }} />
                <span>实时排行榜</span>
                {isActive && (
                  <Badge status="processing" text="实时更新中" />
                )}
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={leaderboardColumns}
              dataSource={leaderboard}
              rowKey="userId"
              pagination={false}
              size="small"
              locale={{ emptyText: '暂无出价记录' }}
            />
          </Card>

          {isActive && recentBids.length > 0 && (
            <Card
              title={
                <Space>
                  <SoundOutlined style={{ color: '#d4a017' }} />
                  <span>实时出价动态</span>
                  <Badge count={recentBids.length} style={{ backgroundColor: '#d4a017' }} />
                </Space>
              }
              bordered={false}
              style={{ borderRadius: 12, marginTop: 16 }}
              extra={
                <Button size="small" onClick={() => setRecentBids([])}>清空</Button>
              }
            >
              <List
                size="small"
                dataSource={recentBids}
                renderItem={(bid) => (
                  <List.Item style={{ padding: '8px 0' }}>
                    <Space>
                      <Avatar size={24} icon={<UserOutlined />} style={{ background: '#d4a017', color: '#0a0e27' }} />
                      <Text>{bid.username || `用户#${bid.userId}`}</Text>
                      <Text type="secondary">出价</Text>
                      <Text strong style={{ color: '#d4a017' }}>{formatPrice(bid.amount)}</Text>
                      {bid.createdAt && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {formatDate(bid.createdAt)}
                        </Text>
                      )}
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined style={{ color: '#d4a017' }} />
                <span>竞拍详情</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
          >
            {currentAuction.product?.images && currentAuction.product.images.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <img
                  src={currentAuction.product.images[0]}
                  alt={currentAuction.product?.name}
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 8 }}
                />
              </div>
            )}
            <Descriptions column={1} size="small">
              <Descriptions.Item label="商品名称">{currentAuction.product?.name || '-'}</Descriptions.Item>
              <Descriptions.Item label="当前价格">
                <Text strong style={{ color: '#d4a017' }}>
                  {formatPrice(currentAuction.currentPrice || 0)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="起拍价">
                {formatPrice(currentAuction.product?.startingPrice || 0)}
              </Descriptions.Item>
              <Descriptions.Item label="加价幅度">
                {formatPrice(currentAuction.product?.priceIncrement || 0)}
              </Descriptions.Item>
              {currentAuction.product?.capPrice && (
                <Descriptions.Item label="封顶价">
                  {formatPrice(currentAuction.product.capPrice)}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="竞拍时长">
                {currentAuction.product?.duration || 0}分钟
              </Descriptions.Item>
              <Descriptions.Item label="延时时间">
                {currentAuction.product?.delayTime || 10}秒
              </Descriptions.Item>
              <Descriptions.Item label="出价次数">
                {currentAuction.bidCount ?? 0}次
              </Descriptions.Item>
              <Descriptions.Item label="竞拍人数">
                {participantCount}人
              </Descriptions.Item>
              {currentAuction.product?.sku && (
                <Descriptions.Item label="SKU">
                  {currentAuction.product.sku}
                </Descriptions.Item>
              )}
              {currentAuction.product?.weight && (
                <Descriptions.Item label="重量">
                  {currentAuction.product.weight}kg
                </Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {formatDate(currentAuction.createdAt)}
              </Descriptions.Item>
              {currentAuction.startTime && (
                <Descriptions.Item label="开始时间">
                  {formatDate(currentAuction.startTime)}
                </Descriptions.Item>
              )}
              {currentAuction.endTime && (
                <Descriptions.Item label="结束时间">
                  {formatDate(currentAuction.endTime)}
                </Descriptions.Item>
              )}
              {currentAuction.winner && (
                <Descriptions.Item label="获胜者">
                  <Space>
                    <Avatar size={20} icon={<UserOutlined />} />
                    {currentAuction.winner.username}
                  </Space>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>

          {currentAuction.product?.description && (
            <Card
              title="商品描述"
              bordered={false}
              style={{ borderRadius: 12, marginTop: 16 }}
            >
              <Text style={{ whiteSpace: 'pre-wrap' }}>{currentAuction.product.description}</Text>
            </Card>
          )}

          {currentAuction.product?.specifications && Object.keys(currentAuction.product.specifications).length > 0 && (
            <Card
              title="商品规格"
              bordered={false}
              style={{ borderRadius: 12, marginTop: 16 }}
            >
              <Descriptions column={1} size="small">
                {Object.entries(currentAuction.product.specifications).map(([key, value]) => (
                  <Descriptions.Item key={key} label={key}>{String(value)}</Descriptions.Item>
                ))}
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>

      {/* AI Broadcast Suggestions */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <BulbOutlined style={{ color: '#d4a017' }} />
                <span>AI 直播话术建议</span>
                {broadcastResult?.auctionStatus && (
                  <Tag color={broadcastResult.auctionStatus === 'active' ? 'green' : 'default'}>
                    {broadcastResult.auctionStatus === 'active' ? '进行中' : broadcastResult.auctionStatus}
                  </Tag>
                )}
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 12 }}
            extra={
              <Space>
                {broadcastResult?.suggestions?.length && (
                  <Button
                    icon={<CopyOutlined />}
                    onClick={handleCopyAllSuggestions}
                    size="small"
                  >
                    复制全部
                  </Button>
                )}
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  loading={broadcastLoading}
                  onClick={handleFetchSuggestions}
                  size="small"
                >
                  获取话术
                </Button>
              </Space>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <TextArea
                placeholder="描述当前直播情况（可选），例如：刚开始介绍商品、竞拍进入白热化阶段、即将结束..."
                rows={2}
                value={broadcastContext}
                onChange={(e) => setBroadcastContext(e.target.value)}
                style={{ borderRadius: 8 }}
              />
            </div>

            {broadcastLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Spin size="large" indicator={<LoadingOutlined style={{ fontSize: 24, color: '#d4a017' }} spin />} />
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">AI 正在生成话术建议...</Text>
                </div>
              </div>
            ) : broadcastResult?.suggestions?.length ? (
              <List
                dataSource={broadcastResult.suggestions}
                renderItem={(item, index) => (
                  <List.Item
                    style={{
                      padding: '12px 16px',
                      background: index % 2 === 0 ? '#fafafa' : '#fff',
                      borderRadius: 8,
                      marginBottom: 8,
                    }}
                    actions={[
                      <Tooltip title="复制话术" key="copy">
                        <Button
                          type="text"
                          icon={<CopyOutlined />}
                          onClick={() => handleCopySuggestion(item.content)}
                        />
                      </Tooltip>,
                    ]}
                  >
                    <List.Item.Meta
                      avatar={
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #d4a017, #f0c040)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0a0e27',
                            fontWeight: 700,
                            fontSize: 14,
                          }}
                        >
                          {index + 1}
                        </div>
                      }
                      description={
                        <Text style={{ color: 'rgba(0,0,0,0.85)', fontSize: 14 }}>{item.content}</Text>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                description="点击「获取话术」按钮，AI 将根据当前竞拍状态生成直播话术建议"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}

            {broadcastResult?.currentPrice && (
              <div style={{ marginTop: 16, padding: '8px 12px', background: '#f6ffed', borderRadius: 8 }}>
                <Space>
                  <Text type="secondary">当前竞拍价：</Text>
                  <Text strong style={{ color: '#52c41a' }}>¥{broadcastResult.currentPrice}</Text>
                  {broadcastResult.bidCount !== undefined && (
                    <>
                      <Divider type="vertical" />
                      <Text type="secondary">出价次数：</Text>
                      <Text strong>{broadcastResult.bidCount}</Text>
                    </>
                  )}
                </Space>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AuctionDetailPage;
