import { config } from '../config';
import { logger } from '../utils/logger';
import { redisUtils } from '../config/redis';
import { aiService } from './ai.service';
import { Auction } from '../models/Auction';
import { Product } from '../models/Product';
import {
  GenerateDescriptionRequest,
  GenerateDescriptionResponse,
  BroadcastSuggestionRequest,
  BroadcastSuggestionResponse,
  BroadcastSuggestion,
  BroadcastTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  DescriptionStyleConfig,
  BroadcastStyleConfig,
  AIAssistantConfig,
  AIAssistantCacheKeys,
  AIAssistantError,
  AIAssistantErrorCode,
  SuggestPricingRequest,
  SuggestPricingResponse,
  LiveScriptRequest,
  LiveScriptResponse,
} from '../dto/ai-assistant.dto';

/**
 * AI辅助服务
 * 提供商品描述生成和直播话术建议功能
 */
export class AIAssistantService {
  private static instance: AIAssistantService;
  private config: AIAssistantConfig;
  private descriptionStyles: Map<string, DescriptionStyleConfig>;
  private broadcastStyles: Map<string, BroadcastStyleConfig>;
  private templates: Map<string, BroadcastTemplate>;

  private constructor() {
    this.config = {
      maxDescriptionLength: 1000,
      maxSuggestionsCount: 10,
      defaultDescriptionStyle: 'professional',
      defaultBroadcastStyle: 'exciting',
      cacheEnabled: true,
      cacheTTL: 300000, // 5分钟
    };

    this.descriptionStyles = new Map();
    this.broadcastStyles = new Map();
    this.templates = new Map();

    this.initializeStyles();
    this.initializeDefaultTemplates();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): AIAssistantService {
    if (!AIAssistantService.instance) {
      AIAssistantService.instance = new AIAssistantService();
    }
    return AIAssistantService.instance;
  }

  /**
   * 初始化描述风格配置
   */
  private initializeStyles(): void {
    // 商品描述风格
    this.descriptionStyles.set('professional', {
      style: 'professional',
      name: '专业型',
      description: '专业、严谨、注重细节的商品描述',
      promptTemplate: `你是一位专业的商品描述撰写专家。请根据以下商品信息，生成专业、严谨、注重细节的商品描述。

商品名称：{productName}
商品类型：{productType}
商品特点：{features}

要求：
1. 语言专业、严谨
2. 突出商品的核心价值和特点
3. 使用行业术语，体现专业性
4. 结构清晰，逻辑性强
5. 字数控制在500-800字

请直接输出商品描述，不要添加任何解释。`,
      examples: [
        '这款高端机械腕表采用瑞士ETA2892机芯，配备蓝宝石水晶镜面，316L精钢表壳，防水深度达100米。表盘采用太阳纹打磨工艺，搭配夜光指针，确保在任何光线条件下都能清晰读时。',
        '本款紫砂壶选用宜兴原矿紫砂泥，由资深工匠手工制作而成。壶身线条流畅，壶嘴出水顺畅，壶盖密封性好。适合冲泡普洱、铁观音等各类茶叶，能充分激发茶香。',
      ],
    });

    this.descriptionStyles.set('lively', {
      style: 'lively',
      name: '活泼型',
      description: '生动、有趣、富有感染力的商品描述',
      promptTemplate: `你是一位创意十足的商品描述撰写专家。请根据以下商品信息，生成生动、有趣、富有感染力的商品描述。

商品名称：{productName}
商品类型：{productType}
商品特点：{features}

要求：
1. 语言生动、活泼，富有感染力
2. 使用形象的比喻和修辞手法
3. 突出商品的独特卖点和使用场景
4. 让读者产生购买欲望
5. 字数控制在500-800字

请直接输出商品描述，不要添加任何解释。`,
      examples: [
        '想象一下，当你戴上这款耳机，整个世界都安静了！就像给耳朵装上了一扇隔音窗，外面的喧嚣瞬间消失。而音乐，就像清泉一样流淌进你的心田，每一个音符都清晰可辨。',
        '这不仅仅是一个杯子，它是你早晨的仪式感！当你端起它，热气袅袅升起，咖啡的香气扑鼻而来。握在手里，温暖从指尖传到心底，新的一天，从这一杯开始！',
      ],
    });

    this.descriptionStyles.set('luxury', {
      style: 'luxury',
      name: '奢华型',
      description: '高端、奢华、彰显品位的商品描述',
      promptTemplate: `你是一位高端品牌商品描述撰写专家。请根据以下商品信息，生成高端、奢华、彰显品位的商品描述。

商品名称：{productName}
商品类型：{productType}
商品特点：{features}

要求：
1. 语言高端、奢华，彰显品位
2. 强调稀缺性、独特性和收藏价值
3. 使用优雅、精致的词汇
4. 营造尊贵、专属的氛围
5. 字数控制在500-800字

请直接输出商品描述，不要添加任何解释。`,
      examples: [
        '这件珍品源自百年工坊的匠心传承，每一处细节都凝聚着大师级工匠的心血。稀有的材质、精湛的工艺、独特的设计，共同铸就了这件值得世代珍藏的艺术瑰宝。拥有它，不仅是拥有了一件物品，更是拥有了一段传奇。',
        '尊贵的您，值得拥有这份专属的奢华。这款限量版手袋，全球仅发售100只，每一只都拥有独立编号。顶级鳄鱼皮材质，搭配18K金扣饰，尽显您的不凡品位与尊贵身份。',
      ],
    });

    // 直播话术风格
    this.broadcastStyles.set('exciting', {
      style: 'exciting',
      name: '激情型',
      description: '充满激情、营造紧张氛围的话术风格',
      tone: '热情、激动、有感染力',
      examples: [
        '各位家人们，现在开始出价啦！起拍价只要100元，机会难得，不要错过！',
        '哇！已经有人出价到500元了！还有没有人出更高的价格？',
        '最后30秒！倒计时开始！3...2...1...恭喜这位家人拍得宝贝！',
      ],
    });

    this.broadcastStyles.set('professional', {
      style: 'professional',
      name: '专业型',
      description: '专业、稳重、值得信赖的话术风格',
      tone: '专业、稳重、有说服力',
      examples: [
        '各位观众，现在开始本次竞拍。这件商品的市场价值是XX元，起拍价设置为XX元，非常有诚意。',
        '目前的最高出价是XX元，还有几位观众在观望。如果您对这件商品感兴趣，现在是出价的好时机。',
        '竞拍即将结束，感谢各位的参与。最终成交价是XX元，恭喜这位买家。',
      ],
    });

    this.broadcastStyles.set('friendly', {
      style: 'friendly',
      name: '亲切型',
      description: '亲切、温暖、拉近距离的话术风格',
      tone: '亲切、温暖、有亲和力',
      examples: [
        '嗨，家人们好呀！今天给大家带来一件特别的宝贝，我先给大家介绍一下~',
        '哎呀，这位家人出价好快呀！还有没有其他家人想试试的？不着急，慢慢来~',
        '好啦，竞拍结束啦！恭喜这位家人，我会尽快安排发货的，大家下次见~',
      ],
    });
  }

  /**
   * 初始化默认话术模板
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: BroadcastTemplate[] = [
      {
        id: 'template_001',
        name: '开场白模板',
        category: 'opening',
        content: '各位家人们好！欢迎来到今天的直播间！我是你们的主播{主播名称}。今天给大家带来一件非常特别的宝贝——{商品名称}！这件商品的特点是{商品特点}，市场价可是{市场价}元哦！',
        variables: ['主播名称', '商品名称', '商品特点', '市场价'],
        description: '直播间开场白，介绍主播和商品',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_002',
        name: '出价引导模板',
        category: 'bidding',
        content: '好的，现在开始出价！起拍价只要{起拍价}元，每次加价{加价幅度}元。家人们，机会难得，不要犹豫！想要的家人请出价！',
        variables: ['起拍价', '加价幅度'],
        description: '引导用户开始出价',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_003',
        name: '价格播报模板',
        category: 'bidding',
        content: '现在最高价已经到了{当前价格}元！还有没有家人想出更高的价格？这件宝贝可是非常稀有的，错过就没有了！',
        variables: ['当前价格'],
        description: '播报当前最高价格',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_004',
        name: '倒计时提醒模板',
        category: 'countdown',
        content: '注意啦！竞拍还剩最后{剩余时间}秒！想要的家人抓紧时间出价！倒计时开始：{倒计时数字}...',
        variables: ['剩余时间', '倒计时数字'],
        description: '竞拍倒计时提醒',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_005',
        name: '延时通知模板',
        category: 'countdown',
        content: '哇！又有家人出价了！竞拍时间自动延长{延时秒数}秒！现在最高价是{当前价格}元，还有机会！',
        variables: ['延时秒数', '当前价格'],
        description: '竞拍延时时的通知',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_006',
        name: '竞拍结束模板',
        category: 'closing',
        content: '恭喜{获胜者昵称}以{成交价格}元的价格拍得{商品名称}！感谢所有参与的家人们！我们下一场直播再见！',
        variables: ['获胜者昵称', '成交价格', '商品名称'],
        description: '竞拍结束时的祝贺',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'template_007',
        name: '互动引导模板',
        category: 'interaction',
        content: '家人们，觉得这件商品怎么样？喜欢的扣1，想要的扣2！有什么问题也可以在评论区问我哦~',
        variables: [],
        description: '引导观众互动',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  /**
   * 生成商品描述
   */
  async generateDescription(request: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse> {
    try {
      // 验证请求
      this.validateDescriptionRequest(request);

      // 检查缓存
      if (this.config.cacheEnabled) {
        const cached = await this.getCachedDescription(request);
        if (cached) {
          return cached;
        }
      }

      // 获取风格配置
      const style = request.style || this.config.defaultDescriptionStyle;
      const styleConfig = this.descriptionStyles.get(style);
      if (!styleConfig) {
        throw new AIAssistantError(
          AIAssistantErrorCode.INVALID_REQUEST,
          `不支持的描述风格: ${style}`
        );
      }

      // 构建提示词
      const prompt = this.buildDescriptionPrompt(request, styleConfig);

      // 调用AI服务生成描述
      const aiResponse = await aiService.processRequest({
        prompt,
        temperature: 0.7,
        maxTokens: request.maxLength || this.config.maxDescriptionLength,
      });

      if (!aiResponse.success || !aiResponse.data) {
        throw new AIAssistantError(
          AIAssistantErrorCode.GENERATION_FAILED,
          '商品描述生成失败',
          aiResponse.error
        );
      }

      // 处理生成的描述
      const description = this.processGeneratedDescription(aiResponse.data.content);

      // 构建响应
      const response: GenerateDescriptionResponse = {
        success: true,
        data: {
          description,
          style,
          wordCount: description.length,
          suggestions: this.generateDescriptionSuggestions(request, style),
        },
      };

      // 缓存结果
      if (this.config.cacheEnabled) {
        await this.cacheDescription(request, response);
      }

      return response;
    } catch (error) {
      logger.error('Generate description failed:', error);
      
      if (error instanceof AIAssistantError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: AIAssistantErrorCode.GENERATION_FAILED,
          message: '商品描述生成失败，请稍后重试',
        },
      };
    }
  }

  /**
   * 获取直播话术建议
   */
  async getBroadcastSuggestion(request: BroadcastSuggestionRequest): Promise<BroadcastSuggestionResponse> {
    try {
      // 验证请求
      this.validateBroadcastRequest(request);

      // 检查缓存
      if (this.config.cacheEnabled) {
        const cached = await this.getCachedBroadcastSuggestion(request);
        if (cached) {
          return cached;
        }
      }

      // 根据竞拍状态生成话术
      const suggestions = await this.generateBroadcastSuggestions(request);

      // 构建响应
      const response: BroadcastSuggestionResponse = {
        success: true,
        data: {
          suggestions,
          timestamp: new Date(),
        },
      };

      // 缓存结果
      if (this.config.cacheEnabled) {
        await this.cacheBroadcastSuggestion(request, response);
      }

      return response;
    } catch (error) {
      logger.error('Get broadcast suggestion failed:', error);
      
      if (error instanceof AIAssistantError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: AIAssistantErrorCode.AI_SERVICE_ERROR,
          message: '获取直播话术建议失败，请稍后重试',
        },
      };
    }
  }

  /**
   * 生成直播话术建议
   */
  private async generateBroadcastSuggestions(request: BroadcastSuggestionRequest): Promise<BroadcastSuggestion[]> {
    const suggestions: BroadcastSuggestion[] = [];
    const style = request.style || this.config.defaultBroadcastStyle;

    // 通过auctionId从数据库查询竞拍数据，补充缺失参数
    if (request.auctionId) {
      try {
        const auction = await Auction.findByPk(request.auctionId, {
          include: [{ model: Product, as: 'product' }],
        }) as any;

        if (auction) {
          // 补充缺失参数
          if (!request.productName && auction.product?.name) {
            request.productName = auction.product.name;
          }
          if (!request.productFeatures && auction.product?.tags) {
            try {
              request.productFeatures = Array.isArray(auction.product.tags)
                ? auction.product.tags
                : JSON.parse(auction.product.tags || '[]');
            } catch {
              request.productFeatures = [];
            }
          }
          if (!request.currentPrice && auction.currentPrice) {
            request.currentPrice = auction.currentPrice;
          }
          if (!request.startingPrice && auction.startingPrice) {
            request.startingPrice = auction.startingPrice;
          }
          if (!request.capPrice && auction.capPrice) {
            request.capPrice = auction.capPrice;
          }
          if (!request.participantCount && auction.participantCount) {
            request.participantCount = auction.participantCount;
          }
          if (!request.auctionStatus && auction.status) {
            request.auctionStatus = auction.status;
          }
          // 计算剩余时间
          if (request.timeLeft === undefined && auction.endTime) {
            const remaining = Math.floor((new Date(auction.endTime).getTime() - Date.now()) / 1000);
            request.timeLeft = remaining > 0 ? remaining : 0;
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch auction data for broadcast suggestion:', err);
      }
    }

    // 根据竞拍状态生成不同的话术
    switch (request.auctionStatus) {
      case 'pending':
        suggestions.push(...await this.generatePendingSuggestions(request, style));
        break;
      case 'active':
        suggestions.push(...await this.generateActiveSuggestions(request, style));
        break;
      case 'completed':
        suggestions.push(...await this.generateCompletedSuggestions(request, style));
        break;
      case 'cancelled':
        suggestions.push(...await this.generateCancelledSuggestions(request, style));
        break;
      default:
        // 未知状态时生成通用话术
        suggestions.push(...this.generateGenericSuggestions(request, style));
        break;
    }

    // 确保至少返回一条建议
    if (suggestions.length === 0) {
      suggestions.push(...this.generateGenericSuggestions(request, style));
    }

    // 限制建议数量
    return suggestions.slice(0, this.config.maxSuggestionsCount);
  }

  /**
   * 生成待开始状态的话术建议
   */
  private async generatePendingSuggestions(
    request: BroadcastSuggestionRequest,
    style: string
  ): Promise<BroadcastSuggestion[]> {
    const suggestions: BroadcastSuggestion[] = [];
    const styleConfig = this.broadcastStyles.get(style);

    // 开场白
    suggestions.push({
      id: `suggestion_${Date.now()}_1`,
      type: 'opening',
      content: `各位家人们好！欢迎来到直播间！今天给大家带来的是${request.productName || '一件特别的宝贝'}！`,
      timing: '竞拍开始前',
      priority: 'high',
      tags: ['开场', '欢迎'],
    });

    // 商品介绍
    if (request.productFeatures && request.productFeatures.length > 0) {
      suggestions.push({
        id: `suggestion_${Date.now()}_2`,
        type: 'opening',
        content: `这件商品的特点是${request.productFeatures.join('、')}，非常值得拥有！`,
        timing: '商品介绍时',
        priority: 'high',
        tags: ['商品介绍', '特点'],
      });
    }

    // 互动引导
    suggestions.push({
      id: `suggestion_${Date.now()}_3`,
      type: 'interaction',
      content: '家人们，觉得这件商品怎么样？喜欢的扣1，想要的扣2！',
      timing: '等待竞拍开始时',
      priority: 'medium',
      tags: ['互动', '引导'],
    });

    return suggestions;
  }

  /**
   * 生成进行中状态的话术建议
   */
  private async generateActiveSuggestions(
    request: BroadcastSuggestionRequest,
    style: string
  ): Promise<BroadcastSuggestion[]> {
    const suggestions: BroadcastSuggestion[] = [];
    const productName = request.productName || '这件宝贝';
    const ts = Date.now();

    // 商品介绍和出价引导（始终生成）
    suggestions.push({
      id: `suggestion_${ts}_0`,
      type: 'bidding',
      content: `家人们，${productName}正在竞拍中！${request.startingPrice ? `起拍价${request.startingPrice}元，` : ''}想要的家人们赶紧出价哦！`,
      timing: '竞拍进行中',
      priority: 'high',
      tags: ['出价引导', '商品介绍'],
    });

    // 价格播报
    if (request.currentPrice) {
      suggestions.push({
        id: `suggestion_${ts}_1`,
        type: 'bidding',
        content: `现在最高价已经到了${request.currentPrice}元！还有没有家人想出更高的价格？`,
        timing: '出价后',
        priority: 'high',
        tags: ['价格播报', '出价引导'],
      });
    }

    // 参与人数提醒
    if (request.participantCount && request.participantCount > 0) {
      suggestions.push({
        id: `suggestion_${ts}_2`,
        type: 'bidding',
        content: `目前已经有${request.participantCount}位家人参与竞拍了！竞争很激烈哦！`,
        timing: '参与人数变化时',
        priority: 'medium',
        tags: ['参与人数', '氛围营造'],
      });
    }

    // 倒计时提醒
    if (request.timeLeft !== undefined && request.timeLeft <= 60) {
      suggestions.push({
        id: `suggestion_${ts}_3`,
        type: 'countdown',
        content: `注意啦！竞拍还剩最后${request.timeLeft}秒！想要的家人抓紧时间出价！`,
        timing: '最后1分钟',
        priority: 'high',
        tags: ['倒计时', '紧迫感'],
      });
    }

    // 封顶价提醒
    if (request.capPrice && request.currentPrice) {
      const priceGap = request.capPrice - request.currentPrice;
      if (priceGap > 0 && priceGap <= request.capPrice * 0.1) {
        suggestions.push({
          id: `suggestion_${ts}_4`,
          type: 'bidding',
          content: `距离封顶价只差${priceGap}元了！达到封顶价就自动成交哦！`,
          timing: '接近封顶价时',
          priority: 'high',
          tags: ['封顶价', '紧迫感'],
        });
      }
    }

    // 互动引导（始终生成）
    suggestions.push({
      id: `suggestion_${ts}_5`,
      type: 'interaction',
      content: `觉得${productName}好的家人们扣个"想要"！没出价的一定要试试，机会难得！`,
      timing: '竞拍进行中',
      priority: 'medium',
      tags: ['互动', '引导'],
    });

    return suggestions;
  }

  /**
   * 生成已结束状态的话术建议
   */
  private async generateCompletedSuggestions(
    request: BroadcastSuggestionRequest,
    style: string
  ): Promise<BroadcastSuggestion[]> {
    const suggestions: BroadcastSuggestion[] = [];

    // 竞拍结束祝贺
    suggestions.push({
      id: `suggestion_${Date.now()}_1`,
      type: 'closing',
      content: '恭喜这位家人拍得宝贝！感谢所有参与的家人们！',
      timing: '竞拍结束时',
      priority: 'high',
      tags: ['祝贺', '结束'],
    });

    // 下一场预告
    suggestions.push({
      id: `suggestion_${Date.now()}_2`,
      type: 'closing',
      content: '我们下一场直播再见！记得关注我们，不错过任何精彩竞拍！',
      timing: '结束前',
      priority: 'medium',
      tags: ['预告', '关注'],
    });

    return suggestions;
  }

  /**
   * 生成已取消状态的话术建议
   */
  private async generateCancelledSuggestions(
    request: BroadcastSuggestionRequest,
    style: string
  ): Promise<BroadcastSuggestion[]> {
    const suggestions: BroadcastSuggestion[] = [];

    // 取消通知
    suggestions.push({
      id: `suggestion_${Date.now()}_1`,
      type: 'closing',
      content: '非常抱歉，由于特殊原因，本次竞拍取消。感谢大家的参与，我们下次再见！',
      timing: '竞拍取消时',
      priority: 'high',
      tags: ['取消', '通知'],
    });

    return suggestions;
  }

  /**
   * 生成通用话术建议（兜底，确保不返回空数组）
   */
  private generateGenericSuggestions(
    request: BroadcastSuggestionRequest,
    style: string
  ): BroadcastSuggestion[] {
    const suggestions: BroadcastSuggestion[] = [];
    const productName = request.productName || '这件宝贝';
    const priceStr = request.currentPrice ? `当前价${request.currentPrice}元` : (request.startingPrice ? `起拍价${request.startingPrice}元` : '');
    const ts = Date.now();

    suggestions.push({
      id: `suggestion_${ts}_1`,
      type: 'opening',
      content: `家人们好！欢迎来到直播间！今天给大家带来的是${productName}，${priceStr ? priceStr + '，' : ''}品质绝对有保障！`,
      timing: '开场时',
      priority: 'high',
      tags: ['开场', '商品介绍'],
    });

    suggestions.push({
      id: `suggestion_${ts}_2`,
      type: 'bidding',
      content: `${productName}正在火热竞拍中！${priceStr ? priceStr + '，' : ''}想要的家人赶紧出价，手慢无！`,
      timing: '竞拍进行中',
      priority: 'high',
      tags: ['出价引导', '紧迫感'],
    });

    suggestions.push({
      id: `suggestion_${ts}_3`,
      type: 'interaction',
      content: `觉得${productName}好的家人们扣个"想要"！犹豫的家人也不要错过，出价试试看！`,
      timing: '互动时',
      priority: 'medium',
      tags: ['互动', '引导'],
    });

    return suggestions;
  }

  /**
   * 构建商品描述提示词
   */
  private buildDescriptionPrompt(request: GenerateDescriptionRequest, styleConfig: DescriptionStyleConfig): string {
    let prompt = styleConfig.promptTemplate;
    
    prompt = prompt.replace('{productName}', request.productName);
    prompt = prompt.replace('{productType}', request.productType);
    prompt = prompt.replace('{features}', request.features.join('、'));
    prompt = prompt.replace('{maxLength}', (request.maxLength || this.config.maxDescriptionLength).toString());

    return prompt;
  }

  /**
   * 处理生成的描述
   */
  private processGeneratedDescription(description: string): string {
    // 移除多余的空白行
    let processed = description.replace(/\n{3,}/g, '\n\n');
    
    // 移除首尾空白
    processed = processed.trim();
    
    // 限制长度
    if (processed.length > this.config.maxDescriptionLength) {
      processed = processed.substring(0, this.config.maxDescriptionLength) + '...';
    }

    return processed;
  }

  /**
   * 生成描述建议
   */
  private generateDescriptionSuggestions(request: GenerateDescriptionRequest, style: string): string[] {
    const suggestions: string[] = [];

    // 根据不同风格提供建议
    switch (style) {
      case 'professional':
        suggestions.push('可以添加更多技术参数和规格信息');
        suggestions.push('建议补充使用场景和适用人群');
        break;
      case 'lively':
        suggestions.push('可以增加更多形象的比喻和修辞');
        suggestions.push('建议添加使用体验和用户评价');
        break;
      case 'luxury':
        suggestions.push('可以强调稀缺性和收藏价值');
        suggestions.push('建议添加品牌故事和工艺细节');
        break;
    }

    return suggestions;
  }

  /**
   * 验证描述请求
   */
  private validateDescriptionRequest(request: GenerateDescriptionRequest): void {
    if (!request.productName || request.productName.trim().length === 0) {
      throw new AIAssistantError(
        AIAssistantErrorCode.INVALID_REQUEST,
        '商品名称不能为空'
      );
    }

    if (!request.productType || request.productType.trim().length === 0) {
      throw new AIAssistantError(
        AIAssistantErrorCode.INVALID_REQUEST,
        '商品类型不能为空'
      );
    }

    if (!request.features || request.features.length === 0) {
      throw new AIAssistantError(
        AIAssistantErrorCode.INVALID_REQUEST,
        '商品特点不能为空'
      );
    }
  }

  /**
   * 验证直播话术请求
   */
  private validateBroadcastRequest(request: BroadcastSuggestionRequest): void {
    if (!request.auctionId || request.auctionId <= 0) {
      throw new AIAssistantError(
        AIAssistantErrorCode.INVALID_REQUEST,
        '竞拍ID无效'
      );
    }

    if (!request.auctionStatus) {
      throw new AIAssistantError(
        AIAssistantErrorCode.INVALID_REQUEST,
        '竞拍状态不能为空'
      );
    }
  }

  /**
   * 获取缓存的商品描述
   */
  private async getCachedDescription(request: GenerateDescriptionRequest): Promise<GenerateDescriptionResponse | null> {
    try {
      const cacheKey = AIAssistantCacheKeys.productDescription(
        request.productName,
        request.style || this.config.defaultDescriptionStyle
      );
      const cached = await redisUtils.get(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for product description: ${cacheKey}`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached description:', error);
      return null;
    }
  }

  /**
   * 缓存商品描述
   */
  private async cacheDescription(request: GenerateDescriptionRequest, response: GenerateDescriptionResponse): Promise<void> {
    try {
      const cacheKey = AIAssistantCacheKeys.productDescription(
        request.productName,
        request.style || this.config.defaultDescriptionStyle
      );
      const ttl = Math.floor(this.config.cacheTTL / 1000);
      
      await redisUtils.set(cacheKey, JSON.stringify(response), ttl);
      logger.debug(`Cached product description: ${cacheKey}`);
    } catch (error) {
      logger.error('Failed to cache description:', error);
    }
  }

  /**
   * 获取缓存的直播话术建议
   */
  private async getCachedBroadcastSuggestion(request: BroadcastSuggestionRequest): Promise<BroadcastSuggestionResponse | null> {
    try {
      const cacheKey = AIAssistantCacheKeys.broadcastSuggestion(
        request.auctionId,
        request.auctionStatus
      );
      const cached = await redisUtils.get(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for broadcast suggestion: ${cacheKey}`);
        return JSON.parse(cached);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get cached broadcast suggestion:', error);
      return null;
    }
  }

  /**
   * 缓存直播话术建议
   */
  private async cacheBroadcastSuggestion(request: BroadcastSuggestionRequest, response: BroadcastSuggestionResponse): Promise<void> {
    try {
      const cacheKey = AIAssistantCacheKeys.broadcastSuggestion(
        request.auctionId,
        request.auctionStatus
      );
      const ttl = Math.floor(this.config.cacheTTL / 1000);
      
      await redisUtils.set(cacheKey, JSON.stringify(response), ttl);
      logger.debug(`Cached broadcast suggestion: ${cacheKey}`);
    } catch (error) {
      logger.error('Failed to cache broadcast suggestion:', error);
    }
  }

  /**
   * 获取所有话术模板
   */
  async getAllTemplates(): Promise<BroadcastTemplate[]> {
    try {
      // 检查缓存
      const cacheKey = AIAssistantCacheKeys.allTemplates();
      const cached = await redisUtils.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // 从内存获取
      const templates = Array.from(this.templates.values());
      
      // 缓存结果
      await redisUtils.set(cacheKey, JSON.stringify(templates), 300);
      
      return templates;
    } catch (error) {
      logger.error('Failed to get all templates:', error);
      return Array.from(this.templates.values());
    }
  }

  /**
   * 获取话术模板详情
   */
  async getTemplate(templateId: string): Promise<BroadcastTemplate | null> {
    try {
      // 检查缓存
      const cacheKey = AIAssistantCacheKeys.template(templateId);
      const cached = await redisUtils.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
      
      // 从内存获取
      const template = this.templates.get(templateId) || null;
      
      // 缓存结果
      if (template) {
        await redisUtils.set(cacheKey, JSON.stringify(template), 300);
      }
      
      return template;
    } catch (error) {
      logger.error('Failed to get template:', error);
      return this.templates.get(templateId) || null;
    }
  }

  /**
   * 创建话术模板
   */
  async createTemplate(request: CreateTemplateRequest): Promise<BroadcastTemplate> {
    try {
      // 验证请求
      if (!request.name || request.name.trim().length === 0) {
        throw new AIAssistantError(
          AIAssistantErrorCode.INVALID_REQUEST,
          '模板名称不能为空'
        );
      }

      if (!request.content || request.content.trim().length === 0) {
        throw new AIAssistantError(
          AIAssistantErrorCode.INVALID_REQUEST,
          '模板内容不能为空'
        );
      }

      // 生成模板ID
      const templateId = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 创建模板
      const template: BroadcastTemplate = {
        id: templateId,
        name: request.name,
        category: request.category,
        content: request.content,
        variables: request.variables || [],
        description: request.description || '',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 保存到内存
      this.templates.set(templateId, template);

      // 清除缓存
      await this.clearTemplateCache();

      logger.info(`Created template: ${templateId}`);
      return template;
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * 更新话术模板
   */
  async updateTemplate(templateId: string, request: UpdateTemplateRequest): Promise<BroadcastTemplate> {
    try {
      // 获取现有模板
      const existingTemplate = this.templates.get(templateId);
      if (!existingTemplate) {
        throw new AIAssistantError(
          AIAssistantErrorCode.TEMPLATE_NOT_FOUND,
          `模板不存在: ${templateId}`
        );
      }

      // 更新模板
      const updatedTemplate: BroadcastTemplate = {
        ...existingTemplate,
        ...request,
        updatedAt: new Date(),
      };

      // 保存到内存
      this.templates.set(templateId, updatedTemplate);

      // 清除缓存
      await this.clearTemplateCache();

      logger.info(`Updated template: ${templateId}`);
      return updatedTemplate;
    } catch (error) {
      logger.error('Failed to update template:', error);
      throw error;
    }
  }

  /**
   * 删除话术模板
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      // 检查模板是否存在
      if (!this.templates.has(templateId)) {
        throw new AIAssistantError(
          AIAssistantErrorCode.TEMPLATE_NOT_FOUND,
          `模板不存在: ${templateId}`
        );
      }

      // 删除模板
      this.templates.delete(templateId);

      // 清除缓存
      await this.clearTemplateCache();

      logger.info(`Deleted template: ${templateId}`);
    } catch (error) {
      logger.error('Failed to delete template:', error);
      throw error;
    }
  }

  /**
   * 清除模板缓存
   */
  private async clearTemplateCache(): Promise<void> {
    try {
      const keys = await redisUtils.keys('ai:template*');
      if (keys.length > 0) {
        await redisUtils.del(...keys);
      }
    } catch (error) {
      logger.error('Failed to clear template cache:', error);
    }
  }

  /**
   * 获取描述风格列表
   */
  getDescriptionStyles(): DescriptionStyleConfig[] {
    return Array.from(this.descriptionStyles.values());
  }

  /**
   * 获取直播话术风格列表
   */
  getBroadcastStyles(): BroadcastStyleConfig[] {
    return Array.from(this.broadcastStyles.values());
  }

  /**
   * 获取配置
   */
  getConfig(): AIAssistantConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<AIAssistantConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('AI assistant config updated:', newConfig);
  }

  /**
   * AI定价建议
   */
  async suggestPricing(request: SuggestPricingRequest): Promise<SuggestPricingResponse> {
    try {
      if (!request.productName || request.productName.trim().length === 0) {
        throw new AIAssistantError(
          AIAssistantErrorCode.INVALID_REQUEST,
          '商品名称不能为空'
        );
      }

      const productTypeStr = request.productType || '未指定';
      const targetAudienceStr = request.targetAudience || '大众消费者';

      const prompt = `你是一位专业的电商定价策略专家，擅长直播竞拍商品的定价建议。请根据以下商品信息，给出合理的竞拍定价建议。

商品名称：${request.productName}
商品类型：${productTypeStr}
目标受众：${targetAudienceStr}

请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "suggestedStartingPrice": 建议起拍价（数字，单位：元），
  "suggestedPriceIncrement": 建议加价幅度（数字，单位：元），
  "reasoning": "定价理由的详细说明",
  "confidence": 置信度（0-1之间的数字），
  "marketData": {
    "averagePrice": 市场均价（数字，单位：元），
    "priceRange": [最低价, 最高价]（两个数字的数组，单位：元），
    "competitorCount": 竞品数量（整数）
  }
}

定价建议原则：
1. 起拍价应低于市场均价的70%-80%，以吸引竞拍者参与
2. 加价幅度应为起拍价的5%-15%，确保竞价节奏合理
3. 考虑商品类型、目标受众的购买力和市场竞争情况
4. 置信度基于市场数据的充分程度`;

      const aiResponse = await aiService.processRequest({
        prompt,
        temperature: 0.6,
        maxTokens: 1000,
      });

      if (!aiResponse.success || !aiResponse.data) {
        throw new AIAssistantError(
          AIAssistantErrorCode.GENERATION_FAILED,
          '定价建议生成失败',
          aiResponse.error
        );
      }

      let pricingData: any;
      try {
        const content = aiResponse.data.content;
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          pricingData = JSON.parse(jsonMatch[0]);
        }
      } catch {
        pricingData = null;
      }

      if (!pricingData) {
        throw new AIAssistantError(
          AIAssistantErrorCode.GENERATION_FAILED,
          '定价建议解析失败'
        );
      }

      return {
        success: true,
        data: {
          suggestedStartingPrice: Number(pricingData.suggestedStartingPrice) || 0,
          suggestedPriceIncrement: Number(pricingData.suggestedPriceIncrement) || 0,
          reasoning: pricingData.reasoning || '',
          confidence: Number(pricingData.confidence) || 0.5,
          marketData: {
            averagePrice: Number(pricingData.marketData?.averagePrice) || 0,
            priceRange: pricingData.marketData?.priceRange?.map(Number) || [0, 0],
            competitorCount: Number(pricingData.marketData?.competitorCount) || 0,
          },
        },
      };
    } catch (error) {
      logger.error('Suggest pricing failed:', error);

      if (error instanceof AIAssistantError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }

      return {
        success: false,
        error: {
          code: AIAssistantErrorCode.GENERATION_FAILED,
          message: '定价建议生成失败，请稍后重试',
        },
      };
    }
  }

  /**
   * 生成高质量模板话术（AI API不可用时的降级方案）
   */
  private generateTemplateScript(request: LiveScriptRequest, style: string): {
    opening: string;
    productIntro: string;
    biddingGuide: string;
    urgencyTactics: string;
    closing: string;
  } {
    const name = request.productName;
    const featuresStr = request.productFeatures?.length
      ? request.productFeatures.join('、')
      : '高品质好物';
    const priceStr = request.auctionInfo?.startingPrice
      ? `起拍价只要${request.auctionInfo.startingPrice}元`
      : '超低价起拍';
    const bidCountStr = request.auctionInfo?.currentBidCount
      ? `目前已有${request.auctionInfo.currentBidCount}位家人参与出价`
      : '';
    const currentPriceStr = request.auctionInfo?.currentPrice
      ? `当前最高出价${request.auctionInfo.currentPrice}元`
      : '';

    const templates: Record<string, {
      opening: string;
      productIntro: string;
      biddingGuide: string;
      urgencyTactics: string;
      closing: string;
    }> = {
      enthusiastic: {
        opening: `🔥 家人们！欢迎来到今天的直播间！你们期待的${name}终于来了！今天绝对是捡漏的好机会，想要的家人扣1让我看到你们！`,
        productIntro: `家人们看过来！这款${name}，拥有${featuresStr}这些逆天配置！品质绝对过硬，到手就知道什么叫物超所值！平时根本买不到这个价格，今天直播间专属福利！`,
        biddingGuide: `${priceStr}！家人们，${bidCountStr || '机会非常难得'}，想要的一定要出价！${currentPriceStr ? `现在最高价才${request.auctionInfo?.currentPrice}元，性价比拉满！` : '起拍价真的太划算了，不出价真的会后悔！'}扣出价金额直接上！`,
        urgencyTactics: `⚠️ 注意了家人们！这件${name}数量有限，竞争非常激烈！不想错过的话赶紧出价！最后几分钟才是真正的战场，手速要快！价格随时会飙升，现在出价就是最佳时机！`,
        closing: `感谢所有家人们的热情参与！今天这场竞拍太精彩了！没有拍到的家人们不要灰心，关注主播不错过下一场好货！我们下期直播见！`,
      },
      professional: {
        opening: `各位观众朋友们好，欢迎来到本直播间。今天为大家带来的竞拍商品是${name}，这是一款在同品类中表现优异的产品，接下来我为大家详细介绍。`,
        productIntro: `关于这款${name}，它的核心亮点在于${featuresStr}。从产品用料到工艺细节，都经过了严格品控，品质值得信赖。无论是自用还是送礼，都是一个非常不错的选择。`,
        biddingGuide: `本次竞拍${priceStr}，${bidCountStr ? `目前竞争态势较为活跃，${bidCountStr}` : '起拍门槛亲民'}。${currentPriceStr ? `当前最高价为${request.auctionInfo?.currentPrice}元，市场价值远高于此。` : '以起拍价来看，具有很好的性价比空间。'}建议各位根据自身需求理性出价。`,
        urgencyTactics: `提醒各位，本场竞拍即将进入尾声。${name}的市场保有量有限，错过本次竞拍可能需要等待较长时间才有下一次机会。当前价格仍然处于合理区间，建议有需求的观众尽快出价。`,
        closing: `本场竞拍到此结束，感谢各位观众的参与和关注。如有其他商品需求，欢迎持续关注本直播间，我们会定期推出优质竞拍商品。祝各位生活愉快，再见。`,
      },
      friendly: {
        opening: `哈喽亲爱的们，欢迎来到我的直播间呀～今天给你们准备了一个超级棒的惊喜，就是这款${name}！快搬好小板凳，咱们马上开始～`,
        productIntro: `来说说这个${name}吧，它有${featuresStr}这些超棒的点！我自己用下来真的爱了，品质特别靠谱，拿在手里很有质感。你们收到一定会满意的，相信我的眼光～`,
        biddingGuide: `好啦，要开始竞拍咯～${priceStr}，价格真的很友好呢！${bidCountStr || '趁现在竞争还不激烈'}，喜欢的话大胆出价吧～${currentPriceStr ? `现在才${request.auctionInfo?.currentPrice}元，真的很划算！` : '起拍价超低，抢到就是赚到～'}`,
        urgencyTactics: `亲爱的小伙伴们注意啦～${name}真的超级抢手呢！库存就这么多，拍完就没了！如果真的很想要的话一定要抓紧哦，不然真的会被抢走啦～最后倒计时大家一定要盯紧呀！`,
        closing: `谢谢宝贝们今天的陪伴呀～每一场直播都因为有你们才这么开心！没有抢到的宝贝也不要难过，下次我还会带来更多好物给你们哒～记得点关注不迷路哦，爱你们！`,
      },
    };

    return templates[style] || templates.enthusiastic;
  }

  async generateLiveScript(request: LiveScriptRequest): Promise<LiveScriptResponse> {
    try {
      if (!request.productName || request.productName.trim().length === 0) {
        throw new AIAssistantError(
          AIAssistantErrorCode.INVALID_REQUEST,
          '商品名称不能为空'
        );
      }

      const style = request.style || 'enthusiastic';
      const styleTones: Record<string, string> = {
        enthusiastic: '热情、激动、有感染力',
        professional: '专业、稳重、有说服力',
        friendly: '亲切、温暖、有亲和力',
      };
      const tone = styleTones[style] || styleTones.enthusiastic;

      const featuresStr = request.productFeatures?.length
        ? request.productFeatures.join('、')
        : '优质商品';
      const priceStr = request.auctionInfo?.startingPrice
        ? `起拍价${request.auctionInfo.startingPrice}元`
        : '';
      const bidCountStr = request.auctionInfo?.currentBidCount
        ? `已有${request.auctionInfo.currentBidCount}次出价`
        : '';
      const timeStr = request.auctionInfo?.timeRemaining
        ? `剩余${request.auctionInfo.timeRemaining}秒`
        : '';
      const currentPriceStr = request.auctionInfo?.currentPrice
        ? `当前最高价${request.auctionInfo.currentPrice}元`
        : '';

      let scriptData: any = null;

      try {
        const prompt = `你是一位专业的直播竞拍主播话术撰写专家。请根据以下信息，生成一套完整的直播竞拍话术，风格为${tone}。

商品名称：${request.productName}
商品特点：${featuresStr}
${priceStr}
${bidCountStr}
${timeStr}
${currentPriceStr}

请严格按照以下JSON格式输出，不要添加任何其他内容：
{
  "opening": "开场白（欢迎观众、营造氛围）",
  "productIntro": "商品介绍（详细介绍商品特点和卖点）",
  "biddingGuide": "引导出价（鼓励观众出价竞拍）",
  "urgencyTactics": "制造紧迫感（营造紧张氛围、限时提醒）",
  "closing": "结束语（感谢参与、预告下一场）"
}

每段话术控制在50-150字，语言风格${tone}，适合直播场景使用。`;

        const aiResponse = await aiService.processRequest({
          prompt,
          temperature: 0.8,
          maxTokens: 1500,
        });

        if (aiResponse.success && aiResponse.data) {
          const content = aiResponse.data.content;
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              scriptData = JSON.parse(jsonMatch[0]);
              if (scriptData.opening && scriptData.productIntro && scriptData.biddingGuide) {
                logger.info('AI live script generated successfully');
              } else {
                scriptData = null;
              }
            } catch {
              scriptData = null;
            }
          }
        }
      } catch (aiError) {
        logger.warn('AI API unavailable, falling back to template script:', aiError);
        scriptData = null;
      }

      // AI不可用时使用高质量模板话术
      if (!scriptData) {
        scriptData = this.generateTemplateScript(request, style);
        logger.info('Using template live script as fallback');
      }

      return {
        success: true,
        data: {
          opening: scriptData.opening || '',
          productIntro: scriptData.productIntro || '',
          biddingGuide: scriptData.biddingGuide || '',
          urgencyTactics: scriptData.urgencyTactics || '',
          closing: scriptData.closing || '',
        },
      };
    } catch (error) {
      logger.error('Generate live script failed:', error);

      if (error instanceof AIAssistantError) {
        return {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        };
      }

      // 参数校验外的异常也降级返回模板话术
      try {
        const templateScript = this.generateTemplateScript(request, request.style || 'enthusiastic');
        return {
          success: true,
          data: templateScript,
        };
      } catch {
        return {
          success: false,
          error: {
            code: AIAssistantErrorCode.GENERATION_FAILED,
            message: '直播话术生成失败，请稍后重试',
          },
        };
      }
    }
  }
}

// 导出单例
export const aiAssistantService = AIAssistantService.getInstance();
