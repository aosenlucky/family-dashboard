<template>
    <div class="pt-28 pb-20">
        <header class="px-4 text-center relative z-10 mb-8">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">记录爱与财富的生长</h1>
            <div v-if="isMasked" class="absolute top-32 left-1/2 transform -translate-x-1/2 flex flex-col items-center z-50">
                <i class="ph ph-lock-key text-4xl text-gray-400 mb-2 animate-bounce"></i>
                <span class="text-xs text-gray-500 bg-white/80 px-4 py-1.5 rounded-full border border-gray-200 shadow-sm">点击右上角「显示金额」解密</span>
            </div>
        </header>

        <div :class="isMasked ? 'blur-md opacity-60 pointer-events-none select-none transition-all duration-500' : 'transition-all duration-500'">
            <section class="max-w-6xl mx-auto px-4 mb-12">
                <div class="glass-card rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-lg border-2 border-white/80 relative overflow-hidden">
                    <p class="text-sm text-gray-500 mb-2 font-medium flex items-center z-10"><i class="ph-fill ph-chart-line-up mr-2 text-rose-500"></i> 家庭实时净资产</p>
                    <p class="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-800 z-10 mb-6 px-2 drop-shadow-sm">{{ formatCurrency(netWorth) }}</p>
                    
                    <div class="flex flex-col sm:flex-row w-full max-w-2xl justify-between items-center text-sm bg-white/60 p-4 rounded-2xl z-10 border border-white shadow-sm gap-4 sm:gap-0">
                        <div class="text-center w-full sm:w-1/3"><p class="text-xs text-gray-500 mb-1">总资产</p><p class="font-semibold text-gray-800">{{ formatCurrency(totalAssets) }}</p></div>
                        <div class="hidden sm:block w-px h-8 bg-gray-300/50"></div>
                        <div class="text-center w-full sm:w-1/3"><p class="text-xs text-gray-500 mb-1">总负债</p><p class="font-semibold text-rose-500">{{ formatCurrency(totalDebt) }}</p></div>
                        <div class="hidden sm:block w-px h-8 bg-gray-300/50"></div>
                        <div class="text-center w-full sm:w-1/3"><p class="text-xs text-gray-500 mb-1">资产负债率</p><p class="font-semibold text-gray-700">{{ isMasked ? '***' : debtRatio }}%</p></div>
                    </div>
                </div>
            </section>

            <!-- 1. 股市模块 (红绿渐变背景 + 盈亏计算) -->
            <section class="max-w-6xl mx-auto px-4 mb-12">
                <div class="glass-card rounded-3xl p-6 shadow-sm border border-white/60">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-semibold flex items-center text-gray-800"><i class="ph-fill ph-trend-up mr-2 text-rose-500"></i> 投资与股市雷达</h3>
                        <span class="text-[10px] text-gray-500">美元汇率: {{ familyData.usdRate }}</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div v-for="stock in familyData.stocks" :key="stock.symbol" class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm relative overflow-hidden">
                            <!-- 红绿渐变背景 -->
                            <div class="absolute right-0 top-0 bottom-0 w-1/2 bg-gradient-to-l opacity-10 pointer-events-none" :class="getStockProfit(stock) >= 0 ? 'from-rose-500' : 'from-green-500'"></div>
                            <div class="flex justify-between items-start mb-3 relative z-10">
                                <div><h4 class="font-semibold text-gray-800 flex items-center">{{ stock.name }}</h4><p class="text-[10px] text-gray-500 mt-1"><span :class="getOwnerTagClass(stock.owner)" class="border px-1.5 py-0.5 rounded">{{ stock.owner }}</span></p></div>
                                <div class="text-right"><p class="text-sm font-bold text-gray-800">{{ isMasked ? '***' : stock.currentPrice }}</p><p class="text-[10px] text-gray-500 mt-0.5">持仓: {{ isMasked ? '***' : stock.shares }} 股</p></div>
                            </div>
                            <!-- 盈亏展示 -->
                            <div class="flex justify-between items-center text-xs border-t border-gray-200/50 pt-2 relative z-10">
                                <span class="text-gray-500">持仓盈亏</span>
                                <div class="font-semibold" :class="getStockProfit(stock) >= 0 ? 'text-rose-500' : 'text-green-500'">
                                    {{ getStockProfit(stock) >= 0 ? '+' : '' }}{{ formatCurrency(getStockProfit(stock)) }}
                                    <span class="text-[10px] ml-1">({{ isMasked ? '***' : getStockProfitPercent(stock) }}%)</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="max-w-6xl mx-auto px-4 mb-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- 基础资产 -->
                <div class="glass-card rounded-3xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-house mr-2 text-blue-500"></i> 固定与流动资产</h3>
                    <div class="space-y-3 max-h-[300px] overflow-y-auto pr-2 modal-scroll">
                        <div v-for="asset in regularAssets" :key="asset.id" class="flex justify-between items-center text-sm border-b border-gray-200/30 pb-2">
                            <span class="text-gray-600 flex items-center"><span class="text-[9px] border px-1.5 py-0.5 rounded mr-2" :class="getOwnerTagClass(asset.owner)">{{ asset.owner }}</span>{{ asset.name }}</span>
                            <span class="font-medium text-gray-800">{{ formatCurrency(asset.value) }}</span>
                        </div>
                        <div class="flex justify-between items-center text-sm pt-2">
                            <span class="text-gray-600 font-medium flex items-center"><i class="ph-fill ph-aperture text-red-500 mr-2"></i> HW 股权总本金</span>
                            <span class="font-medium text-gray-800">{{ formatCurrency(totalEquityPrincipal) }}</span>
                        </div>
                    </div>
                </div>

                <!-- 2. 家族股权大盘 (包含税前/税后/总股数计算) -->
                <div class="glass-card rounded-3xl p-6 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl transform translate-x-4 -translate-y-4"></div>
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-aperture mr-2 text-red-500"></i> HW 家族股权大盘</h3>
                    
                    <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-600 mb-4 bg-white/50 p-3 rounded-xl border border-white shadow-sm">
                        <div class="w-full sm:w-auto"><span class="text-gray-400">每股价格:</span> <span class="font-medium text-gray-800">{{ isMasked ? '***' : familyData.equity.pricePerShare }} 元</span></div>
                        <div class="w-full sm:w-auto"><span class="text-gray-400">预测分红:</span> <span class="font-bold text-rose-500">{{ isMasked ? '***' : familyData.equity.dividendRate }} 元/股</span></div>
                        <div class="w-full sm:w-auto"><span class="text-gray-400">年收益率:</span> <span class="font-bold text-green-600">{{ isMasked ? '***' : equityYieldRate }}%</span></div>
                        <div class="w-full h-px bg-gray-200/50 my-0.5"></div>
                        <div class="w-full sm:w-auto"><span class="text-gray-400">总股本:</span> <span class="font-medium text-gray-800">{{ formatCurrencyInt(totalEquityPrincipal) }}</span></div>
                        <div class="w-full sm:w-auto"><span class="text-gray-400">总股数:</span> <span class="font-medium text-gray-800">{{ isMasked ? '***' : formatCurrencyIntNoSymbol(totalEquityShares) }} 股</span></div>
                    </div>
                    
                    <div class="space-y-2 max-h-[200px] overflow-y-auto modal-scroll pr-2">
                        <div v-for="member in familyData.equity.members" :key="member.name" class="flex justify-between items-center bg-white/40 px-3 py-2.5 rounded-xl text-sm border border-white/50 shadow-sm transition hover:shadow-md">
                            <div class="flex flex-col w-1/3"><span class="text-gray-800 font-medium text-sm">{{ member.name }}</span><span class="text-[10px] text-gray-500 mt-0.5">本金: {{ formatCurrencyInt(member.principal) }}</span></div>
                            <div class="w-1/4 text-center"><span class="text-gray-500 text-[10px] bg-gray-100/50 px-2 py-1 rounded">{{ isMasked ? '***' : formatCurrencyIntNoSymbol(member.principal / familyData.equity.pricePerShare) }} 股</span></div>
                            <div class="flex flex-col items-end w-5/12">
                                <span class="font-bold text-green-600 text-sm" title="扣除20%税率">+{{ formatCurrencyInt((member.principal / familyData.equity.pricePerShare) * familyData.equity.dividendRate * 0.8) }} <span class="text-[9px] font-normal text-green-600 border border-green-200 bg-green-50 px-1 rounded ml-1">税后</span></span>
                                <span class="text-[9px] text-gray-400 mt-0.5">税前: {{ formatCurrencyInt((member.principal / familyData.equity.pricePerShare) * familyData.equity.dividendRate) }}</span>
                            </div>
                        </div>
                    </div>
                    <!-- 整体统计 -->
                    <div class="mt-4 pt-3 border-t border-gray-300/50 flex justify-between items-center">
                        <span class="text-sm font-semibold text-gray-800">家族年预期 <span class="text-green-600">税后</span> 总分红</span>
                        <span class="text-xl font-bold text-green-600">{{ formatCurrencyInt(totalDividendsPostTax) }}</span>
                    </div>
                </div>
            </section>

            <!-- 3. 贷款明细 (支持本金/利息分解引擎) -->
            <section class="max-w-6xl mx-auto px-4 mb-16">
                <h2 class="text-xl font-semibold mb-6 flex items-center"><i class="ph ph-notebook mr-2 text-apple-subtext"></i> 贷款月供分解</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div v-for="loan in processedLoans" :key="loan.id" class="glass-card rounded-2xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                        <div v-if="loan.isAutoCalc" class="absolute -right-6 top-4 bg-blue-500/10 text-blue-600 text-[10px] py-0.5 px-8 transform rotate-45 flex items-center font-medium backdrop-blur-sm shadow-sm"><i class="ph-fill ph-magic-wand mr-1"></i> 精准引擎</div>
                        <div class="flex items-center space-x-3 mb-4">
                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm" :class="loan.type === '房贷' ? 'bg-blue-500/90' : 'bg-orange-500/90'"><i :class="loan.type === '房贷' ? 'ph ph-house' : 'ph ph-credit-card'"></i></div>
                            <div><p class="text-sm font-semibold text-gray-800 flex items-center"><span class="text-[9px] border px-1.5 py-0.5 rounded mr-2" :class="getOwnerTagClass(loan.owner)">{{ loan.owner }}</span>{{ loan.bank }} <span class="text-[10px] text-gray-500 font-normal ml-1">({{ loan.type }})</span></p><p class="text-[10px] text-gray-500 mt-1">每月 {{ loan.day || '未定' }} 日 · 利率 {{ loan.rate }}%</p></div>
                        </div>
                        <div class="bg-white/50 p-4 rounded-xl border border-white shadow-sm">
                            <div class="flex justify-between items-center text-sm border-b border-gray-200/50 pb-2 mb-2"><span class="text-gray-600 font-medium">剩余本金</span><span class="font-bold text-gray-800">{{ formatCurrency(loan.left) }}</span></div>
                            <div class="flex justify-between items-center text-sm"><span class="text-gray-600 font-medium">本月需还总额</span><span class="font-bold text-rose-500">{{ formatCurrency(loan.monthly) }}</span></div>
                            <!-- 补全的分解显示 -->
                            <div class="bg-white/60 rounded-lg p-2 flex justify-between text-xs text-gray-500 mt-3 border border-gray-100">
                                <span>还本金: {{ formatCurrency(loan.nextPrincipal) }}</span>
                                <span class="text-orange-500">还利息: {{ formatCurrency(loan.nextInterest) }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- 4. 拓扑图 (已加回标题与百分百覆盖标识) -->
            <section id="flow" class="max-w-6xl mx-auto px-4 mb-20">
                <div class="flex justify-between items-end mb-4">
                    <h2 class="text-xl font-semibold flex items-center"><i class="ph ph-git-branch mr-2 text-apple-subtext"></i> 资金自动化航线</h2>
                    <span class="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded-full flex items-center"><i class="ph-fill ph-check-circle mr-1"></i> 100% 自动化覆盖</span>
                </div>
                <div class="glass-card rounded-3xl p-6 md:p-10 overflow-x-auto border-white/60 flow-scroll relative shadow-inner">
                    <div class="min-w-[800px] flex flex-col items-center justify-start pb-4">
                        <FlowNode :node="flowTree" :rootSalaryDay="familyData.salaryDay" />
                    </div>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup>
import { inject, computed } from 'vue'
import FlowNode from '../components/FlowNode.vue'

const familyData = inject('familyData')
const isMasked = inject('isMasked')
const formatCurrency = inject('formatCurrency')
const formatCurrencyInt = inject('formatCurrencyInt')
const formatCurrencyIntNoSymbol = inject('formatCurrencyIntNoSymbol')
const getOwnerTagClass = inject('getOwnerTagClass')

// 股票与收益计算方法
const getStockProfit = (stock) => { return (stock.currentPrice - stock.costPrice) * stock.shares; }
const getStockProfitPercent = (stock) => { return stock.costPrice > 0 ? ((stock.currentPrice - stock.costPrice) / stock.costPrice * 100).toFixed(2) : 0; }

// 资产筛选
const regularAssets = computed(() => familyData.value.assets.filter(a => a.type !== 'stock'))

// 贷款分解计算 (支持推演剩余本金与下月利息)
const processedLoans = computed(() => {
    const now = new Date(); const currentYear = now.getFullYear(); const currentMonth = now.getMonth(); const currentDate = now.getDate();
    return familyData.value.loans.map(loan => {
        let pLoan = { ...loan };
        const r = (loan.rate / 100) / 12;
        if (loan.isAutoCalc && loan.baseDate) {
            const [baseY, baseM] = loan.baseDate.split('-').map(Number);
            let elapsed = (currentYear - baseY) * 12 + (currentMonth - (baseM - 1));
            if (currentDate < loan.day) elapsed -= 1; 
            if (elapsed < 0) elapsed = 0;
            let currentLeft = loan.baseLeft;
            let fixedMonthly = loan.baseMonthly || 0;
            for(let i = 0; i < elapsed; i++) { currentLeft -= (fixedMonthly - currentLeft * r); }
            pLoan.left = currentLeft; pLoan.monthly = fixedMonthly;
            pLoan.nextInterest = currentLeft * r;
            pLoan.nextPrincipal = fixedMonthly - pLoan.nextInterest;
        } else if (loan.type === '消费贷') {
            pLoan.nextInterest = pLoan.left * r; 
            pLoan.nextPrincipal = pLoan.monthly - pLoan.nextInterest;
        }
        return pLoan;
    });
})

// 股权大盘计算
const totalEquityPrincipal = computed(() => familyData.value.equity.members.reduce((sum, m) => sum + Number(m.principal), 0))
const totalEquityShares = computed(() => totalEquityPrincipal.value / familyData.value.equity.pricePerShare)
const equityYieldRate = computed(() => ((familyData.value.equity.dividendRate / familyData.value.equity.pricePerShare) * 100).toFixed(2))
const totalDividends = computed(() => familyData.value.equity.members.reduce((sum, m) => sum + ((m.principal / familyData.value.equity.pricePerShare) * familyData.value.equity.dividendRate), 0))
const totalDividendsPostTax = computed(() => totalDividends.value * 0.8)

// 综合资产大盘计算
const totalStockValue = computed(() => familyData.value.stocks.reduce((sum, s) => {
    let val = s.currentPrice * s.shares;
    if(s.market === 'US') val = val * familyData.value.usdRate;
    return sum + val;
}, 0))
const totalAssets = computed(() => familyData.value.assets.reduce((sum, a) => sum + Number(a.value), 0) + totalEquityPrincipal.value + totalStockValue.value)
const totalDebt = computed(() => processedLoans.value.reduce((sum, loan) => sum + Number(loan.left || 0), 0))
const netWorth = computed(() => totalAssets.value - totalDebt.value)
const debtRatio = computed(() => totalAssets.value > 0 ? Math.round((totalDebt.value / totalAssets.value) * 100) : 0)

// 自动生成资金流转图树状结构
const flowTree = computed(() => {
    const buildTree = (bankName) => {
        return { name: bankName, isRoot: bankName === familyData.value.salaryBank, loans: processedLoans.value.filter(l => l.bank === bankName), children: familyData.value.transfers.filter(t => t.from === bankName).map(t => ({ transfer: t, ...buildTree(t.to) })) };
    }
    return buildTree(familyData.value.salaryBank);
})
</script>
