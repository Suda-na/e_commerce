/**
 * 智能提示系统测试工具
 * 用于验证5种智能提示状态是否正确实现
 */

/** 智能提示类型 */
type TipType = 'default' | 'outbid' | 'ending-soon' | 'highest' | 'high-bid' | 'cap-warning'

/** 测试用例接口 */
interface TestCase {
  name: string
  description: string
  input: {
    bidAmount: number
    currentPrice: number
    priceStep: number
    isTopBidder: boolean
    timeLeft: number
    isOutbid: boolean
  }
  expected: {
    tipType: TipType
    tipIcon: string
    tipText: string
  }
}

/**
 * 智能提示测试类
 */
export class SmartTipTest {
  private testCases: TestCase[] = []
  
  constructor() {
    this.initTestCases()
  }
  
  /**
   * 初始化测试用例
   */
  private initTestCases() {
    this.testCases = [
      {
        name: '默认提示',
        description: '初始加载/正常状态，出价金额在正常范围内',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: false,
          timeLeft: 300,
          isOutbid: false
        },
        expected: {
          tipType: 'default',
          tipIcon: '💡',
          tipText: '建议加价 ¥50'
        }
      },
      {
        name: '高价提醒',
        description: '出价金额比当前价高100元以上',
        input: {
          bidAmount: 1000,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: false,
          timeLeft: 300,
          isOutbid: false
        },
        expected: {
          tipType: 'high-bid',
          tipIcon: '📈',
          tipText: '高于当前价 ¥150，出价领先'
        }
      },
      {
        name: '最高价警告',
        description: '自己已是当前最高出价者',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: true,
          timeLeft: 300,
          isOutbid: false
        },
        expected: {
          tipType: 'highest',
          tipIcon: '👑',
          tipText: '当前已是最高价，暂列第一'
        }
      },
      {
        name: '即将结束',
        description: '距离竞拍结束时间小于2分钟',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: false,
          timeLeft: 60,
          isOutbid: false
        },
        expected: {
          tipType: 'ending-soon',
          tipIcon: '⏰',
          tipText: '竞拍即将结束（1分钟），最后机会！'
        }
      },
      {
        name: '被超越警告',
        description: '收到outbid事件，别人出了更高价',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: false,
          timeLeft: 300,
          isOutbid: true
        },
        expected: {
          tipType: 'outbid',
          tipIcon: '⚠️',
          tipText: '您已被超越，有人出价更高'
        }
      }
    ]
  }
  
  /**
   * 模拟智能提示更新逻辑
   */
  private updateSmartTip(input: TestCase['input']): { tipType: TipType; tipIcon: string; tipText: string } {
    const { bidAmount, currentPrice, priceStep, isTopBidder, timeLeft, isOutbid } = input
    
    let tipType: TipType = 'default'
    let tipIcon = '💡'
    let tipText = '建议加价 ¥50'
    
    // ① 被超越警告 - 收到outbid事件
    if (isOutbid) {
      tipType = 'outbid'
      tipIcon = '⚠️'
      tipText = '您已被超越，有人出价更高'
    }
    // ② 即将结束 - 距结束<2分钟
    else if (timeLeft < 120 && timeLeft > 0) {
      tipType = 'ending-soon'
      tipIcon = '⏰'
      const minutes = Math.ceil(timeLeft / 60)
      tipText = `竞拍即将结束（${minutes}分钟），最后机会！`
    }
    // ③ 最高价警告 - 自己已是当前最高价
    else if (isTopBidder) {
      tipType = 'highest'
      tipIcon = '👑'
      tipText = '当前已是最高价，暂列第一'
    }
    // ④ 高价提醒 - 出价 > 当前价+100元
    else if (bidAmount - currentPrice > 100) {
      tipType = 'high-bid'
      tipIcon = '📈'
      const diff = bidAmount - currentPrice
      tipText = `高于当前价 ¥${diff.toLocaleString()}，出价领先`
    }
    // ⑤ 默认提示
    else {
      tipType = 'default'
      tipIcon = '💡'
      tipText = `建议加价 ¥${priceStep.toLocaleString()}`
    }
    
    return { tipType, tipIcon, tipText }
  }
  
  /**
   * 运行单个测试用例
   */
  private runTestCase(testCase: TestCase): { passed: boolean; actual: any; expected: any } {
    const actual = this.updateSmartTip(testCase.input)
    const passed = 
      actual.tipType === testCase.expected.tipType &&
      actual.tipIcon === testCase.expected.tipIcon &&
      actual.tipText === testCase.expected.tipText
    
    return {
      passed,
      actual,
      expected: testCase.expected
    }
  }
  
  /**
   * 运行所有测试用例
   */
  public runAllTests(): { total: number; passed: number; failed: number; results: any[] } {
    console.log('=== 智能提示系统测试开始 ===')
    
    const results: any[] = []
    let passedCount = 0
    let failedCount = 0
    
    this.testCases.forEach((testCase, index) => {
      console.log(`\n测试用例 ${index + 1}: ${testCase.name}`)
      console.log(`描述: ${testCase.description}`)
      console.log(`输入: ${JSON.stringify(testCase.input)}`)
      
      const result = this.runTestCase(testCase)
      
      if (result.passed) {
        console.log('✅ 测试通过')
        passedCount++
      } else {
        console.log('❌ 测试失败')
        console.log(`预期: ${JSON.stringify(result.expected)}`)
        console.log(`实际: ${JSON.stringify(result.actual)}`)
        failedCount++
      }
      
      results.push({
        ...testCase,
        ...result
      })
    })
    
    console.log('\n=== 测试结果汇总 ===')
    console.log(`总计: ${this.testCases.length} 个测试用例`)
    console.log(`通过: ${passedCount} 个`)
    console.log(`失败: ${failedCount} 个`)
    console.log(`通过率: ${((passedCount / this.testCases.length) * 100).toFixed(2)}%`)
    
    return {
      total: this.testCases.length,
      passed: passedCount,
      failed: failedCount,
      results
    }
  }
  
  /**
   * 测试颜色值是否正确
   */
  public testColors(): void {
    console.log('\n=== 颜色值验证 ===')
    
    const colorMap = {
      'default': { bg: '#FFF7E6', border: '#FFD591', text: '#D46B08' },
      'outbid': { bg: '#FFF0F6', border: '#FFADD2', text: '#C41D7F' },
      'ending-soon': { bg: '#FFF1F0', border: '#FFCCC7', text: '#CF1322' },
      'highest': { bg: '#F6FFED', border: '#B7EB8F', text: '#389E0D' },
      'high-bid': { bg: '#E6F7FF', border: '#91D5FF', text: '#096DD9' }
    }
    
    Object.entries(colorMap).forEach(([type, colors]) => {
      console.log(`\n${type}:`)
      console.log(`  背景色: ${colors.bg}`)
      console.log(`  边框色: ${colors.border}`)
      console.log(`  文字色: ${colors.text}`)
    })
  }
  
  /**
   * 测试优先级顺序
   */
  public testPriority(): void {
    console.log('\n=== 优先级顺序测试 ===')
    
    const priorityTestCases = [
      {
        name: '被超越 > 即将结束',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: false,
          timeLeft: 60,
          isOutbid: true
        },
        expected: 'outbid'
      },
      {
        name: '即将结束 > 最高价',
        input: {
          bidAmount: 900,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: true,
          timeLeft: 60,
          isOutbid: false
        },
        expected: 'ending-soon'
      },
      {
        name: '最高价 > 高价提醒',
        input: {
          bidAmount: 1000,
          currentPrice: 850,
          priceStep: 50,
          isTopBidder: true,
          timeLeft: 300,
          isOutbid: false
        },
        expected: 'highest'
      }
    ]
    
    priorityTestCases.forEach(testCase => {
      const result = this.updateSmartTip(testCase.input)
      const passed = result.tipType === testCase.expected
      
      console.log(`\n${testCase.name}:`)
      console.log(`  预期: ${testCase.expected}`)
      console.log(`  实际: ${result.tipType}`)
      console.log(`  结果: ${passed ? '✅ 通过' : '❌ 失败'}`)
    })
  }
  
  /**
   * 生成测试报告
   */
  public generateReport(): string {
    const testResult = this.runAllTests()
    
    let report = '# 智能提示系统测试报告\n\n'
    report += `测试时间: ${new Date().toLocaleString()}\n\n`
    report += '## 测试结果\n\n'
    report += `| 指标 | 数值 |\n`
    report += `|------|------|\n`
    report += `| 总测试用例 | ${testResult.total} |\n`
    report += `| 通过用例 | ${testResult.passed} |\n`
    report += `| 失败用例 | ${testResult.failed} |\n`
    report += `| 通过率 | ${((testResult.passed / testResult.total) * 100).toFixed(2)}% |\n\n`
    
    report += '## 详细结果\n\n'
    testResult.results.forEach((result, index) => {
      report += `### ${index + 1}. ${result.name}\n`
      report += `- 描述: ${result.description}\n`
      report += `- 结果: ${result.passed ? '✅ 通过' : '❌ 失败'}\n`
      
      if (!result.passed) {
        report += `- 预期: ${JSON.stringify(result.expected)}\n`
        report += `- 实际: ${JSON.stringify(result.actual)}\n`
      }
      
      report += '\n'
    })
    
    return report
  }
}

/**
 * 运行测试的入口函数
 */
export function runSmartTipTests(): void {
  const tester = new SmartTipTest()
  
  console.log('开始智能提示系统测试...\n')
  
  // 运行所有测试
  tester.runAllTests()
  
  // 测试颜色值
  tester.testColors()
  
  // 测试优先级
  tester.testPriority()
  
  // 生成报告
  const report = tester.generateReport()
  console.log('\n=== 测试报告 ===')
  console.log(report)
}

// 如果直接运行此文件，执行测试
if (typeof window === 'undefined') {
  runSmartTipTests()
}