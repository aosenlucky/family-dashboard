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

            <section class="max-w-6xl mx-auto px-4 mb-12">
                <div class="glass-card rounded-3xl p-6 shadow-sm border border-white/60">
                    <h3 class="text-lg font-semibold flex items-center text-gray-800 mb-4"><i class="ph-fill ph-trend-up mr-2 text-rose-500"></i> 投资与股市雷达</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div v-for="stock in familyData.stocks" :key="stock.symbol" class="bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-white shadow-sm">
                            <div class="flex justify-between items-start mb-3 relative z-10">
                                <div><h4 class="font-semibold text-gray-800 flex items-center">{{ stock.name }}</h4><p class="text-[10px] text-gray-500 mt-1"><span :class="getOwnerTagClass(stock.owner)" class="border px-1.5 py-0.5 rounded">{{ stock.owner }}</span></p></div>
                                <div class="text-right"><p class="text-sm font-bold text-gray-800">{{ isMasked ? '***' : stock.currentPrice }}</p><p class="text-[10px] text-gray-500 mt-0.5">持仓: {{ isMasked ? '***' : stock.shares }}</p></div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section id="flow" class="max-w-6xl mx-auto px-4 mb-20">
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
const getOwnerTagClass = inject('getOwnerTagClass')

const processedLoans = computed(() => {
    return familyData.value.loans.map(loan => {
        let pLoan = { ...loan }; pLoan.nextInterest = pLoan.left * (loan.rate / 100) / 12; return pLoan;
    });
})

const totalEquityPrincipal = computed(() => familyData.value.equity.members.reduce((sum, m) => sum + Number(m.principal), 0))
const totalStockValue = computed(() => familyData.value.stocks.reduce((sum, s) => sum + s.currentPrice * s.shares, 0))
const totalAssets = computed(() => familyData.value.assets.reduce((sum, a) => sum + Number(a.value), 0) + totalEquityPrincipal.value + totalStockValue.value)
const totalDebt = computed(() => processedLoans.value.reduce((sum, loan) => sum + Number(loan.left || 0), 0))
const netWorth = computed(() => totalAssets.value - totalDebt.value)
const debtRatio = computed(() => totalAssets.value > 0 ? Math.round((totalDebt.value / totalAssets.value) * 100) : 0)

const flowTree = computed(() => {
    const buildTree = (bankName) => {
        return { name: bankName, isRoot: bankName === familyData.value.salaryBank, loans: processedLoans.value.filter(l => l.bank === bankName), children: familyData.value.transfers.filter(t => t.from === bankName).map(t => ({ transfer: t, ...buildTree(t.to) })) };
    }
    return buildTree(familyData.value.salaryBank);
})
</script>
