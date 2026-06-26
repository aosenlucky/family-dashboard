<template>
    <transition name="toast">
        <div v-if="toast.show" class="fixed top-24 left-1/2 transform -translate-x-1/2 z-[300] bg-gray-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 border border-gray-700 pointer-events-none">
            <i class="ph-fill ph-bell-ringing text-yellow-400 text-lg animate-pulse"></i>
            <span class="text-sm font-medium tracking-wide" v-html="toast.msg"></span>
        </div>
    </transition>

    <div v-if="!auth.isLoggedIn" class="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-xl bg-white/40">
        <div class="glass-card rounded-3xl p-8 w-80 text-center flex flex-col items-center shadow-2xl">
            <div class="w-16 h-16 rounded-full bg-rose-500/90 text-white flex items-center justify-center mb-6 shadow-md"><i class="ph-fill ph-lock-key text-3xl"></i></div>
            <h2 class="text-xl font-semibold text-gray-800 mb-2">欢迎回家</h2>
            <p class="text-xs text-gray-500 mb-6">请输入专属密码解锁家庭空间</p>
            <input v-model="auth.inputPin" type="password" placeholder="••••" maxlength="8" class="w-full text-center text-2xl tracking-widest bg-white/50 border border-white rounded-xl py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-rose-400 text-gray-800" @keyup.enter="handleLogin">
            <p v-if="auth.errorMsg" class="text-rose-500 text-xs mb-4 font-medium" v-html="auth.errorMsg"></p>
            <button @click="handleLogin" :disabled="auth.isAuthenticating" class="w-full bg-gray-800 text-white font-medium py-3 rounded-xl hover:bg-gray-700 shadow-md transition-colors disabled:bg-gray-400">
                {{ auth.isAuthenticating ? '验证中...' : '推开家门' }}
            </button>
        </div>
    </div>

    <div v-if="showWealthAuth" class="fixed inset-0 z-[250] flex items-center justify-center backdrop-blur-xl bg-gray-900/60 transition-all">
        <div class="bg-white rounded-3xl p-8 w-80 text-center flex flex-col items-center shadow-2xl relative">
            <button @click="showWealthAuth = false" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><i class="ph ph-x text-xl"></i></button>
            <div class="w-16 h-16 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-4 shadow-sm border border-blue-100"><i class="ph-fill ph-shield-check text-3xl"></i></div>
            <h2 class="text-xl font-semibold text-gray-800 mb-2">私密资产验证</h2>
            <p class="text-xs text-gray-500 mb-6">需二次验证密码以解除金额脱敏</p>
            <input v-model="wealthInputPin" type="password" placeholder="••••" maxlength="8" class="w-full text-center text-2xl tracking-widest bg-gray-50 border border-gray-200 rounded-xl py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800" @keyup.enter="verifyWealthPassword">
            <p v-if="wealthErrorMsg" class="text-rose-500 text-xs mb-4 font-medium">{{ wealthErrorMsg }}</p>
            <button @click="verifyWealthPassword" class="w-full bg-blue-600 text-white font-medium py-3 rounded-xl hover:bg-blue-700 shadow-md transition-colors">验证解锁</button>
        </div>
    </div>

    <div v-if="auth.isLoggedIn">
        <nav class="fixed top-0 w-full z-50 glass-nav border-b border-white/50 shadow-sm">
            <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative flex items-center justify-between h-14">
                <div class="flex items-center space-x-2 text-apple-text font-medium text-sm z-10">
                    <i class="ph-fill ph-heart text-xl text-rose-500"></i><span class="hidden sm:inline">Aosen & 小悦</span>
                </div>
                
                <div class="absolute left-1/2 transform -translate-x-1/2 flex items-center bg-white/40 p-1 rounded-full border border-white/60 shadow-sm z-10">
                    <router-link to="/life" active-class="bg-white shadow-sm text-gray-800" class="px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-all">生活</router-link>
                    <router-link to="/wealth" active-class="bg-white shadow-sm text-gray-800" class="px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-all">理财</router-link>
                    <router-link to="/gallery" active-class="bg-white shadow-sm text-gray-800" class="px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-all">画廊</router-link>
                    <router-link to="/travel" active-class="bg-white shadow-sm text-gray-800" class="px-3 sm:px-4 py-1 rounded-full text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-all">旅行</router-link>
                </div>

                <div class="flex items-center justify-end space-x-2 sm:space-x-4 text-xs font-medium text-apple-text z-10">
                    <span v-if="syncStatus" class="hidden lg:flex items-center text-[10px] text-apple-blue bg-blue-50 px-2 py-1 rounded-full border border-blue-100 transition-all">
                        <i class="ph ph-cloud-arrows mr-1" :class="{'animate-pulse': isSyncing}"></i> {{ syncStatus }}
                    </span>
                    <button v-if="route.path === '/wealth'" @click="toggleMask" class="flex items-center text-gray-600 hover:text-apple-blue bg-white/50 px-2 py-1.5 rounded-full border border-white shadow-sm transition-colors">
                        <i class="ph text-lg md:mr-1" :class="isMasked ? 'ph-eye-closed' : 'ph-eye'"></i>
                        <span class="hidden md:inline">{{ isMasked ? '显示金额' : '隐藏金额' }}</span>
                    </button>
                    <button @click="showConfig = true" class="flex items-center bg-gray-800 text-white hover:bg-gray-700 px-2 sm:px-3 py-1.5 rounded-full shadow-sm transition-colors">
                        <i class="ph ph-gear md:mr-1"></i> <span class="hidden md:inline">配置</span>
                    </button>
                </div>
            </div>
        </nav>

        <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
                <component :is="Component" />
            </transition>
        </router-view>

        <footer class="border-t border-white/40 backdrop-blur-sm pb-12 pt-8 mt-10">
            <div class="max-w-6xl mx-auto px-4 flex flex-col items-center text-xs text-gray-500">
                <p>Aosen & 小悦的家庭空间。Vite 云端驱动 & 本地加密。</p>
            </div>
        </footer>

        <ConfigPanel v-if="showConfig" @close="showConfig = false" />
    </div>
</template>

<script setup>
import { ref, provide, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ConfigPanel from './components/ConfigPanel.vue'

const route = useRoute()

const defaultData = {
    wealthPassword: '1026',
    salaryBank: '工商银行', salaryDay: 15, usdRate: 7.25,
    loans: [ { id: 1, owner: '共同', type: '房贷', bank: '中信银行', isAutoCalc: true, baseLeft: 1786921.68, baseMonthly: 8891, baseDate: '2026-04', rate: 3.2, day: 20, monthly: 0, left: 0 } ],
    transfers: [], assets: [ { id: 1, owner: '共同', type: 'house', name: '房产估值', value: 7000000 } ], stocks: [],
    equity: { pricePerShare: 7.85, dividendRate: 1.06, members: [ {name: 'Aosen&小悦', principal: 1242097.6} ] },
    photoTypes: ['自然风景', '城市建筑', '浪漫旅行', '人物写真', '美食探店', '日常记录', '可爱萌宠'],
    photos: [],
    goals: [ { name: '欧洲10周年纪念游', target: 100000, current: 0 } ],
    dates: [ { name: '小悦生日', date: '1996-09-01', type: 'birthday' } ],
    todos: [ { id: 1, text: '周末一起去买菜', completed: false } ],
    milestones: [ { id: 1, date: '2026-06-01', title: '期待新生命的到来', desc: '建立档案的第一天。', icon: 'ph-baby' } ],
    habits: [ { id: 1, name: '每天阅读 30 分钟', growthValue: 5, lastWatered: '', stage1Days: 7, stage1Reward: '电影之夜', stage2Days: 21, stage2Reward: '新玩具', stage3Days: 100, stage3Reward: '迪士尼' } ],
    // 💡 新增：大模型秘钥与书籍数据库
    llmApiKey: '', books: []
}

const auth = ref({ isLoggedIn: false, inputPin: '', errorMsg: '', isAuthenticating: false })
const familyData = ref(JSON.parse(JSON.stringify(defaultData)))
const isMasked = ref(true)
const showConfig = ref(false)
const isSyncing = ref(false)
const syncStatus = ref('')
const isFetchingStocks = ref(false)

const wealthPassword = ref('')
const showWealthAuth = ref(false)
const wealthInputPin = ref('')
const wealthErrorMsg = ref('')
const toast = ref({ msg: '', show: false, timer: null })

// ==== 全局方法 Provide ====
const showNotification = (msg) => {
    toast.value.msg = msg; toast.value.show = true;
    if(toast.value.timer) clearTimeout(toast.value.timer);
    toast.value.timer = setTimeout(() => { toast.value.show = false; }, 3000);
}

const triggerPushNotification = async (title, content) => {
    const token = sessionStorage.getItem('family_auth_token');
    if (!auth.value.isLoggedIn || token === 'local_dummy_token' || token === '0000') return; 
    try {
        const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify({ action: 'notify', title, content }) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
            console.error('Push Failed', data);
            showNotification('提醒推送失败，请检查 PushPlus 环境变量');
        }
    } catch(e) { console.error('Push Failed', e); showNotification('提醒推送失败，请稍后再试'); }
}

const saveConfig = async () => {
    localStorage.setItem('cashflow_family_v11', JSON.stringify(familyData.value));
    const token = sessionStorage.getItem('family_auth_token');
    if (token) {
        isSyncing.value = true; syncStatus.value = '正在保存至云端...';
        try {
            const res = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': token }, body: JSON.stringify(familyData.value) });
            if(res.ok) syncStatus.value = '保存成功！';
            else syncStatus.value = '权限验证失败';
        } catch(e) { syncStatus.value = '已存本地'; } 
        finally { setTimeout(() => syncStatus.value = '', 3000); isSyncing.value = false; }
    }
}

const formatCurrency = (value) => isMasked.value ? '¥ ***' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
const formatCurrencyInt = (value) => isMasked.value ? '¥ ***' : new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 0 }).format(value);
const formatCurrencyIntNoSymbol = (value) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value);
const getOwnerTagClass = (owner) => owner === 'Aosen' ? 'bg-blue-50 text-blue-600 border-blue-200' : (owner === '小悦' ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-purple-50 text-purple-600 border-purple-200');

provide('familyData', familyData)
provide('isMasked', isMasked)
provide('showNotification', showNotification)
provide('triggerPushNotification', triggerPushNotification)
provide('saveConfig', saveConfig)
provide('formatCurrency', formatCurrency)
provide('formatCurrencyInt', formatCurrencyInt)
provide('formatCurrencyIntNoSymbol', formatCurrencyIntNoSymbol)
provide('getOwnerTagClass', getOwnerTagClass)
provide('fetchStocks', () => fetchStocks())
provide('isFetchingStocks', isFetchingStocks)

const applyData = (data) => {
    const fd = familyData.value;
    fd.wealthPassword = data.wealthPassword || defaultData.wealthPassword; wealthPassword.value = fd.wealthPassword;
    fd.salaryBank = data.salaryBank || defaultData.salaryBank; fd.salaryDay = data.salaryDay || defaultData.salaryDay;
    fd.usdRate = data.usdRate || defaultData.usdRate;
    fd.loans = data.loans && data.loans.length > 0 ? data.loans.map(l => ({...l, owner: l.owner || '共同'})) : defaultData.loans; 
    fd.transfers = data.transfers && data.transfers.length > 0 ? data.transfers : defaultData.transfers;
    fd.goals = data.goals && data.goals.length > 0 ? data.goals : defaultData.goals; 
    fd.dates = data.dates && data.dates.length > 0 ? data.dates : defaultData.dates;
    fd.photoTypes = data.photoTypes && data.photoTypes.length > 0 ? data.photoTypes : defaultData.photoTypes;
    fd.photos = data.photos && data.photos.length > 0 ? data.photos : defaultData.photos;
    fd.stocks = data.stocks && data.stocks.length > 0 ? data.stocks : defaultData.stocks;
    fd.todos = data.todos && data.todos.length > 0 ? data.todos : defaultData.todos;
    fd.milestones = data.milestones && data.milestones.length > 0 ? data.milestones : defaultData.milestones;
    fd.habits = data.habits && data.habits.length > 0 ? data.habits : defaultData.habits;
    fd.assets = data.assets && data.assets.length > 0 ? data.assets.map(a => ({...a, owner: a.owner || '共同'})) : defaultData.assets; 
    fd.equity = data.equity && data.equity.members && data.equity.members.length > 0 ? data.equity : defaultData.equity; 
    // 💡 注入新增的大模型秘钥与书籍数据
    fd.llmApiKey = data.llmApiKey || '';
    fd.books = data.books || [];
}

const loadConfig = async () => {
    const saved = localStorage.getItem('cashflow_family_v11');
    applyData(saved ? JSON.parse(saved) : defaultData);
    const token = sessionStorage.getItem('family_auth_token');
    if (token) {
        isSyncing.value = true; syncStatus.value = '云端同步中...';
        try {
            const res = await fetch('/api/sync', { headers: { 'Authorization': token } });
            if (res.ok) {
                const json = await res.json(); const recordData = json.record ? json.record : json;
                if (recordData && Object.keys(recordData).length > 0) { applyData(recordData); localStorage.setItem('cashflow_family_v11', JSON.stringify(recordData)); syncStatus.value = '已与云端对齐';
                } else { await saveConfig(); }
            } else if (res.status === 401) { auth.value.isLoggedIn = false; sessionStorage.removeItem('family_auth_token'); }
        } catch (err) { syncStatus.value = '离线模式'; } 
        finally { setTimeout(() => syncStatus.value = '', 3000); isSyncing.value = false; }
    }
}

// 腾讯财经 API
const fetchStocks = async () => {
    isFetchingStocks.value = true;
    for (let stock of familyData.value.stocks) {
        try {
            let symbol = stock.symbol.toLowerCase().trim();
            let query = '';

            if (stock.market === 'CN') {
                if (/^\d{6}$/.test(symbol)) { symbol = symbol.startsWith('6') ? `sh${symbol}` : `sz${symbol}`; }
                query = symbol;
            } else if (stock.market === 'US') {
                query = `us${symbol.toUpperCase()}`;
            }

            await new Promise((resolve) => {
                const script = document.createElement('script'); 
                script.src = `https://qt.gtimg.cn/q=${query}&_t=${Date.now()}`; 
                window[`v_${query}`] = "";
                
                script.onload = () => {
                    const res = window[`v_${query}`];
                    if (res && res.length > 10) { 
                        const parts = res.split('~'); 
                        if (parts.length > 3) {
                            const price = parseFloat(parts[3]);
                            if (!isNaN(price) && price > 0) { stock.currentPrice = price; }
                        }
                    }
                    document.body.removeChild(script); 
                    resolve();
                };
                script.onerror = () => { document.body.removeChild(script); resolve(); };
                document.body.appendChild(script);
            });
        } catch(e) { console.error(`抓取 ${stock.name} 失败:`, e); }
    }
    setTimeout(() => { isFetchingStocks.value = false; }, 800);
}

const handleLogin = async () => {
    if (!auth.value.inputPin) { auth.value.errorMsg = '请输入密码'; return; }
    auth.value.isAuthenticating = true; auth.value.errorMsg = '';
    try {
        const res = await fetch('/api/sync', { headers: { 'Authorization': auth.value.inputPin } });
        if (res.ok) {
            sessionStorage.setItem('family_auth_token', auth.value.inputPin); auth.value.isLoggedIn = true; 
            const json = await res.json(); const recordData = json.record ? json.record : json;
            if(recordData && Object.keys(recordData).length > 0) { applyData(recordData); localStorage.setItem('cashflow_family_v11', JSON.stringify(recordData)); }
            fetchStocks();
        } else { auth.value.errorMsg = '密码错误 🔒'; }
    } catch(e) {
        if (auth.value.inputPin === '0000') {
            sessionStorage.setItem('family_auth_token', 'local_dummy_token'); auth.value.isLoggedIn = true;
            loadConfig(); fetchStocks(); showNotification('👋 欢迎来到本地预览模式！');
        } else { auth.value.errorMsg = '网络或密码错误'; }
    } finally { auth.value.isAuthenticating = false; }
}

const toggleMask = () => {
    if (isMasked.value) { showWealthAuth.value = true; wealthErrorMsg.value = ''; wealthInputPin.value = ''; } 
    else { isMasked.value = true; }
}
const verifyWealthPassword = () => {
    if (wealthInputPin.value === wealthPassword.value) { isMasked.value = false; showWealthAuth.value = false; showNotification('✅ 隐私财务数据已解密');
    } else { wealthErrorMsg.value = '密码错误 🔒'; }
}

onMounted(() => {
    if (sessionStorage.getItem('family_auth_token')) auth.value.isLoggedIn = true;
    loadConfig(); if (auth.value.isLoggedIn) fetchStocks();
})
</script>
