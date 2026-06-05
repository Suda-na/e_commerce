// ==================== User & Auth Types ====================

export type UserRole = 'merchant' | 'user';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  avatar?: string;
  email?: string | null;
  phone?: string | null;
  status?: number;
  loginCount?: number;
  receiverName?: string | null;
  receiverPhone?: string | null;
  province?: string | null;
  city?: string | null;
  district?: string | null;
  detailAddress?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  role: UserRole;
  avatar?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ==================== Product Types ====================

export type ProductStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface Product {
  id: number;
  merchantId: number;
  name: string;
  description?: string;
  images: string[];
  startingPrice: number;
  priceIncrement: number;
  duration: number;
  capPrice?: number;
  delayTime: number;
  status: ProductStatus;
  categoryId?: number;
  tags?: string[];
  stock: number;
  stockWarning: number;
  sku?: string;
  weight?: number;
  specifications?: Record<string, string>;
  category?: {
    id: number;
    name: string;
    icon?: string | null;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  images?: string[];
  startingPrice: number;
  priceIncrement: number;
  duration: number;
  capPrice?: number;
  delayTime?: number;
  categoryId?: number;
  tags?: string[];
  stock?: number;
  stockWarning?: number;
  sku?: string;
  weight?: number;
  specifications?: Record<string, string>;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

// ==================== Category Types ====================

export interface Category {
  id: number;
  name: string;
  icon?: string | null;
  sortOrder: number;
  productCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCategoryRequest {
  name: string;
  icon?: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  icon?: string;
  sortOrder?: number;
}

// ==================== Auction Types ====================

export type AuctionStatus = 'pending' | 'active' | 'completed' | 'cancelled';

export interface Auction {
  id: number;
  productId: number;
  product?: Product;
  startTime?: string;
  endTime?: string;
  currentPrice: number;
  winnerId?: number;
  winner?: User;
  status: AuctionStatus;
  bidCount: number;
  onlineCount: number;
  participantCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAuctionRequest {
  productId: number;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  avatar?: string;
  amount: number;
  rank: number;
}

// ==================== Bid Types ====================

export interface Bid {
  id: number;
  auctionId: number;
  userId: number;
  user?: User;
  amount: number;
  createdAt?: string;
}

export interface PlaceBidRequest {
  auctionId: number;
  amount: number;
}

// ==================== Order Types ====================

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'refunding' | 'refunded' | 'cancelled';

export interface Order {
  id: number;
  auctionId: number;
  auction?: Auction;
  userId: number;
  merchantId: number;
  user?: User;
  amount: number;
  status: OrderStatus;
  trackingNumber?: string;
  shippingCompany?: string;
  shippingAddress?: string;
  receiverName?: string;
  receiverPhone?: string;
  remark?: string;
  merchantRemark?: string;
  refundReason?: string;
  refundRejectedReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== AI Assistant Types ====================

export type DescriptionStyle = 'professional' | 'lively' | 'luxury';

export interface GenerateDescriptionRequest {
  productName: string;
  productType?: string;
  features?: string[];
  style?: DescriptionStyle;
  targetAudience?: string;
  additionalInfo?: string;
}

export interface GenerateDescriptionResponse {
  description: string;
  style: DescriptionStyle;
  cached: boolean;
}

export interface BroadcastSuggestion {
  id: string;
  type: 'opening' | 'bidding' | 'countdown' | 'closing' | 'interaction' | 'custom';
  content: string;
  timing: string;
  priority: 'high' | 'medium' | 'low';
  tags: string[];
}

export interface BroadcastSuggestionRequest {
  auctionId: number;
  context?: string;
}

export interface BroadcastSuggestionResponse {
  suggestions: BroadcastSuggestion[];
  auctionStatus: AuctionStatus;
  currentPrice?: number;
  bidCount?: number;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  content: string;
  category: string;
  variables: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemplateRequest {
  name: string;
  content: string;
  category: string;
}

export interface UpdateTemplateRequest {
  name?: string;
  content?: string;
  category?: string;
  isActive?: boolean;
}

export interface SuggestPricingRequest {
  productName: string;
  productType?: string;
  images?: string[];
  targetAudience?: string;
}

export interface SuggestedPricing {
  suggestedStartingPrice: number;
  suggestedPriceIncrement: number;
  reasoning: string;
  confidence: number;
  marketData: {
    averagePrice: number;
    priceRange: [number, number];
    competitorCount: number;
  };
}

export type LiveScriptStyle = 'enthusiastic' | 'professional' | 'friendly';

export interface LiveScriptRequest {
  productName: string;
  productFeatures?: string[];
  auctionInfo?: {
    startingPrice: number;
    timeRemaining?: number;
    currentBidCount?: number;
    currentPrice?: number;
  };
  style?: LiveScriptStyle;
}

export interface LiveScript {
  opening: string;
  productIntro: string;
  biddingGuide: string;
  urgencyTactics: string;
  closing: string;
}

export interface LiveRoomStats {
  onlineCount: number;
  totalViews: number;
  totalBids: number;
  totalRevenue: number;
  activeAuctions: number;
  recentBids: Array<{
    id: number;
    username: string;
    amount: number;
    productName: string;
    time: string;
  }>;
}

export interface AnalyticsOverview {
  totalProducts: number;
  activeAuctions: number;
  conversionRate: number;
  avgSellingPrice: number;
  revenueGrowth: number;
}

export interface TopProduct {
  productId: number;
  name: string;
  views: number;
  bids: number;
  finalPrice: number;
  revenue: number;
}

export interface PriceDistribution {
  range: string;
  count: number;
  percentage: number;
}

export interface HourlyTraffic {
  hour: number;
  views: number;
  bids: number;
}

export interface CategoryPerformance {
  category: string;
  productCount: number;
  totalRevenue: number;
  avgConversionRate: number;
}

export interface AnalyticsDashboard {
  overview: AnalyticsOverview;
  topProducts: TopProduct[];
  priceDistribution: PriceDistribution[];
  hourlyTraffic: HourlyTraffic[];
  categoryPerformance: CategoryPerformance[];
}

// ==================== User AI Types (用户端AI出价顾问) ====================

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';
export type BidStrategyType = 'conservative' | 'moderate' | 'aggressive' | 'snipe';
export type BiddingPattern = 'steady' | 'aggressive' | 'erratic';
export type TimingAction = 'bid_now' | 'wait' | 'snipe';
export type PriceTrend = 'rising' | 'stable' | 'declining';
export type RiskLevelType = 'low' | 'medium' | 'high';
export type Momentum = 'accelerating' | 'steady' | 'decelerating';
export type CompetitionLevel = 'intense' | 'moderate' | 'light';
export type Volatility = 'high' | 'medium' | 'low';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';

export interface BidStrategy {
  type: BidStrategyType;
  description: string;
  expectedOutcome: string;
  winProbability: number;
}

export interface RiskAssessment {
  level: RiskLevelType;
  factors: string[];
  mitigation: string;
}

export interface TopBidder {
  userId: number;
  username: string;
  bidCount: number;
  averageBid: number;
  lastBidTime: string;
  pattern: string;
}

export interface CompetitorAnalysis {
  totalCompetitors: number;
  activeCompetitors: number;
  averageBidAmount: number;
  biddingPattern: BiddingPattern;
  topBidders: TopBidder[];
  predictedBehavior: string;
}

export interface OptimalTiming {
  recommendedAction: TimingAction;
  waitDuration?: number;
  reason: string;
  nextOptimalWindow?: string;
}

export interface PricePrediction {
  predictedFinalPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  confidence: number;
  trend: PriceTrend;
  factors: string[];
}

export interface BidSuggestionResponse {
  auctionId: number;
  currentPrice: number;
  suggestedBid: number;
  minBid: number;
  maxBid: number;
  confidence: number;
  reasoning: string;
  strategy: BidStrategy;
  riskAssessment: RiskAssessment;
  competitorAnalysis: CompetitorAnalysis;
  optimalTiming: OptimalTiming;
  pricePrediction: PricePrediction;
}

export interface PricePoint {
  timestamp: string;
  price: number;
  bidderCount: number;
  volume: number;
}

export interface AuctionStatistics {
  totalBids: number;
  uniqueBidders: number;
  averageBidAmount: number;
  highestBid: number;
  lowestBid: number;
  priceIncrease: {
    absolute: number;
    percentage: number;
  };
  biddingFrequency: {
    bidsPerMinute: number;
    peakTime: string;
    averageInterval: number;
  };
}

export interface TrendInsights {
  momentum: Momentum;
  competition: CompetitionLevel;
  priceVolatility: Volatility;
  timeRemaining: number;
  urgency: Urgency;
  pattern: string;
  keyEvents: Array<{
    time: string;
    event: string;
    impact: 'high' | 'medium' | 'low';
    description: string;
  }>;
}

export interface TrendAnalysisResponse {
  auctionId: number;
  currentStatus: string;
  priceHistory: PricePoint[];
  statistics: AuctionStatistics;
  trends: TrendInsights;
  prediction: PricePrediction;
  recommendations: string[];
}

export interface SmartAlert {
  type: string;
  priority: 'high' | 'medium' | 'low';
  message: string;
  action: string;
  suggestedAmount?: number;
  details?: string;
  predictedPrice?: number;
  riskFactors?: string[];
}

export interface SmartAlertsResponse {
  auctionId: number;
  alerts: SmartAlert[];
  suggestion: {
    suggestedBid: number;
    confidence: number;
    optimalTiming: OptimalTiming;
  };
}

// ==================== AI Analytics Types (AI数据洞察) ====================

export interface AIDailyReport {
  date: string;
  summary: string;
  highlights: string[];
  suggestions: string[];
  metrics: {
    totalRevenue: number;
    revenueChange: number;
    totalOrders: number;
    orderChange: number;
    avgConversionRate: number;
    topCategory: string;
  };
}

export interface FunnelStep {
  step: string;
  label: string;
  count: number;
  rate: number;
  dropoffRate: number;
}

export interface AuctionFunnel {
  steps: FunnelStep[];
  overallConversionRate: number;
  bottleneck: string;
  suggestion: string;
}

export interface PricingSuggestion {
  productId: number;
  productName: string;
  currentStartingPrice: number;
  suggestedStartingPrice: number;
  currentIncrement: number;
  suggestedIncrement: number;
  reason: string;
  confidence: number;
  historicalData: {
    avgBids: number;
    avgFinalPrice: number;
    completionRate: number;
  };
}

// ==================== API Response Types ====================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ==================== WebSocket Event Types ====================

export interface SocketEvents {
  // Client -> Server
  join_auction: (auctionId: number) => void;
  leave_auction: (auctionId: number) => void;
  place_bid: (data: PlaceBidRequest) => void;

  // Server -> Client
  auction_status: (data: { auctionId: number; status: AuctionStatus }) => void;
  new_bid: (data: { auctionId: number; bid: Bid; currentPrice: number }) => void;
  leaderboard_update: (data: { auctionId: number; leaderboard: LeaderboardEntry[] }) => void;
  auction_update: (data: { auctionId: number; currentPrice: number; bidCount: number; onlineCount: number }) => void;
  time_extended: (data: { auctionId: number; newEndTime: string; extensionSeconds: number; message?: string }) => void;
  auction_ended: (data: { auctionId: number; winnerId?: number; finalPrice?: number }) => void;
  outbid: (data: { auctionId: number; newPrice: number; newBidder: string }) => void;
  user_joined: (data: { auctionId: number; userId: number; username: string }) => void;
  user_left: (data: { auctionId: number; userId: number; username: string }) => void;
  bid_error: (data: { auctionId: number; message: string }) => void;
  bid_success: (data: { auctionId: number; bid: Bid }) => void;
}

// ==================== UI State Types ====================

export interface AppState {
  auth: AuthState;
  products: ProductState;
  auctions: AuctionState;
  orders: OrderState;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  loading: boolean;
  error: string | null;
  detailLoading: boolean;
  detailError: string | null;
  total: number;
  categories: Category[];
  selectedCategoryId: number | null;
}

export interface AuctionState {
  auctions: Auction[];
  currentAuction: Auction | null;
  leaderboard: LeaderboardEntry[];
  onlineCount: number;
  participantCount: number;
  loading: boolean;
  error: string | null;
  total: number;
}

export interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
  total: number;
}
