<template>
    <div class="pt-28 pb-20 min-h-screen">
        <header class="px-4 text-center mb-12">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">记录生活的点滴</h1>
            <p class="text-gray-500 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">协作，期待，与成长。</p>
        </header>
        
        <section class="max-w-6xl mx-auto px-4 mb-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <div class="space-y-6 md:space-y-8">
                <!-- 习惯花园 -->
                <div class="glass-card rounded-3xl p-6 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl transform translate-x-8 -translate-y-8 pointer-events-none"></div>
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800 relative z-10"><i class="ph-fill ph-potted-plant mr-2 text-green-500"></i> 习惯花园 <span class="ml-2 text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-normal">雨露培育</span></h3>
                    <div class="space-y-4">
                        <div v-for="habit in familyData.habits" :key="habit.id" class="bg-white/60 p-4 rounded-2xl border border-white shadow-sm relative overflow-hidden transition-all duration-500 hover:shadow-md">
                            <div class="absolute -right-2 -bottom-4 opacity-10 pointer-events-none transition-all duration-700 transform" :class="isWateredToday(habit) ? 'scale-105' : 'scale-100'"><i :class="getHabitIcon(habit.growthValue)" class="text-8xl text-green-500"></i></div>
                            <div class="flex justify-between items-start relative z-10">
                                <div><h4 class="font-medium text-gray-800">{{ habit.name }}</h4><p class="text-[10px] text-gray-500 mt-1">已培育 <span class="text-green-600 font-bold text-xs mx-0.5">{{ habit.growthValue }}</span> 滴雨露</p></div>
                                <button @click="waterHabit(habit)" :disabled="isWateredToday(habit)" class="w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm focus:outline-none" :class="isWateredToday(habit) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white hover:scale-110 hover:shadow-md'"><i class="ph-fill ph-drop text-xl" :class="{'animate-pulse': !isWateredToday(habit)}"></i></button>
                            </div>
                            <div class="mt-4 relative z-10" v-if="getNextReward(habit)">
                                <div class="flex justify-between text-[10px] text-gray-400 mb-1.5"><span>通往下一阶段果实</span><span class="text-rose-500 font-medium">🎁 {{ getNextReward(habit).name }} (目标: {{ getNextReward(habit).days }}滴)</span></div>
                                <div class="w-full bg-gray-200/60 rounded-full h-1.5 overflow-hidden backdrop-blur-sm shadow-inner"><div class="bg-gradient-to-r from-green-400 to-green-600 h-full rounded-full transition-all duration-1000 ease-out" :style="{ width: getHabitProgress(habit) + '%' }"></div></div>
                            </div>
                            <div class="mt-4 text-[10px] text-green-600 font-medium relative z-10 bg-green-50/80 px-2 py-1.5 rounded-lg inline-block border border-green-100" v-else>🌟 所有的奖励果实都已结出，这颗树已成长为参天大树！</div>
                        </div>
                    </div>
                </div>

                <!-- 待办清单 -->
                <div class="glass-card rounded-3xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-check-square-offset mr-2 text-blue-500"></i> 家庭待办协作</h3>
                    <div class="flex gap-2 mb-5">
                        <input v-model="newTodoText" @keyup.enter="addTodo" type="text" placeholder="添加待办事项 (回车保存)" class="flex-1 border border-white/60 bg-white/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition">
                        <button @click="addTodo" class="bg-apple-blue hover:bg-blue-600 text-white rounded-xl px-4 py-2 text-sm shadow-md transition"><i class="ph ph-plus font-bold"></i></button>
                    </div>
                    <div class="space-y-2 max-h-[250px] overflow-y-auto modal-scroll pr-2">
                        <div v-for="todo in sortedTodos" :key="todo.id" class="flex items-center justify-between bg-white/60 p-3 rounded-xl border border-white shadow-sm transition-all hover:bg-white/80" :class="{'opacity-60': todo.completed}">
                            <div class="flex items-center space-x-3 overflow-hidden"><input type="checkbox" :checked="todo.completed" @change="toggleTodo(todo)" class="apple-checkbox shrink-0"><span class="text-sm text-gray-800 truncate transition-all duration-300" :class="{'line-through text-gray-400': todo.completed}">{{ todo.text }}</span></div>
                            <button @click="deleteTodo(todo.id)" class="text-gray-400 hover:text-red-500 px-2 shrink-0"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>
                
                <!-- 心愿单 -->
                <div class="glass-card rounded-3xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-star mr-2 text-yellow-500"></i> 梦想小金库</h3>
                    <div class="space-y-5">
                        <div v-for="goal in familyData.goals" :key="goal.name" class="bg-white/60 p-4 rounded-2xl border border-white shadow-sm">
                            <div class="flex justify-between items-end mb-2">
                                <div><h4 class="font-medium text-gray-800">{{ goal.name }}</h4><p class="text-[10px] text-gray-500 mt-0.5">目标: {{ formatCurrencyInt(goal.target) }}</p></div>
                                <div class="text-right"><p class="text-sm font-bold text-apple-blue">{{ formatCurrencyInt(goal.current) }}</p><p class="text-[10px] text-gray-500 mt-0.5">{{ Math.round((goal.current/goal.target)*100) }}% 已完成</p></div>
                            </div>
                            <div class="w-full bg-gray-200/60 rounded-full h-2 overflow-hidden backdrop-blur-sm"><div class="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-1000" :style="{ width: Math.min(100, (goal.current/goal.target)*100) + '%' }"></div></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="space-y-6 md:space-y-8">
                <!-- 宝宝时光轴 -->
                <div class="glass-card rounded-3xl p-6">
                    <h3 class="text-lg font-semibold mb-6 flex items-center text-gray-800"><i class="ph-fill ph-baby mr-2 text-rose-400"></i> 宝宝成长时光轴</h3>
                    <div class="relative border-l-2 border-rose-100 ml-4 space-y-8 pb-4">
                        <div v-for="(milestone, idx) in sortedMilestones" :key="milestone.id" class="relative pl-6 group">
                            <div class="absolute -left-[13px] top-0.5 w-6 h-6 bg-white border-[3px] border-rose-300 rounded-full flex justify-center items-center group-hover:border-rose-500 transition-colors shadow-sm"><i class="ph-fill text-[10px] text-rose-400 group-hover:text-rose-600" :class="milestone.icon || 'ph-star'"></i></div>
                            <div class="bg-white/60 p-4 rounded-2xl border border-white shadow-sm hover:shadow-md transition">
                                <span class="text-[10px] font-semibold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">{{ milestone.date }}</span>
                                <h4 class="font-medium text-gray-800 mt-2">{{ milestone.title }}</h4><p class="text-xs text-gray-500 mt-1 leading-relaxed">{{ milestone.desc }}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 纪念日 -->
                <div class="glass-card rounded-3xl p-6">
                    <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-calendar-heart mr-2 text-rose-400"></i> 家庭温馨日历</h3>
                    <div class="space-y-3 max-h-[250px] overflow-y-auto modal-scroll pr-2">
                        <div v-for="date in processedDates" :key="date.name" class="flex items-center justify-between bg-white/60 px-4 py-3 rounded-2xl border border-white shadow-sm hover:shadow-md transition">
                            <div class="flex items-center space-x-3">
                                <div class="w-10 h-10 rounded-full flex items-center justify-center shadow-sm" :class="date.daysLeft === 0 ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-500'"><i class="ph-fill" :class="date.type === 'birthday' ? 'ph-cake' : 'ph-confetti'"></i></div>
                                <div><p class="text-sm font-medium text-gray-800">{{ date.name }}</p><p class="text-[10px] text-gray-500">{{ date.nextDateStr }} {{ date.isMarriage ? `· ${date.yearsPassed}周年` : `· ${date.yearsPassed}岁` }}</p></div>
                            </div>
                            <div class="text-right"><span v-if="date.daysLeft === 0" class="text-sm font-bold text-rose-500 animate-pulse">就是今天!</span><span v-else class="text-sm font-bold text-gray-700">{{ date.daysLeft }} <span class="text-xs font-normal text-gray-500">天后</span></span></div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
import { inject, computed, ref } from 'vue'

const familyData = inject('familyData')
const saveConfig = inject('saveConfig')
const showNotification = inject('showNotification')
const triggerPushNotification = inject('triggerPushNotification')
const formatCurrencyInt = inject('formatCurrencyInt')

const newTodoText = ref('')

const sortedTodos = computed(() => [...familyData.value.todos].sort((a, b) => (a.completed === b.completed) ? 0 : a.completed ? 1 : -1))
const sortedMilestones = computed(() => [...familyData.value.milestones].sort((a, b) => new Date(b.date) - new Date(a.date)))

const processedDates = computed(() => {
    const today = new Date(); today.setHours(0,0,0,0); const currentYear = today.getFullYear();
    return familyData.value.dates.map(item => {
        const [y, m, d] = item.date.split('-').map(Number);
        let nextDate = new Date(currentYear, m - 1, d);
        let yearsPassed = currentYear - y;
        if (nextDate.getTime() < today.getTime()) { nextDate.setFullYear(currentYear + 1); yearsPassed += 1; }
        const daysLeft = Math.ceil(Math.abs(nextDate - today) / (1000 * 60 * 60 * 24));
        return { ...item, daysLeft, nextDateStr: `${nextDate.getMonth()+1}月${nextDate.getDate()}日`, yearsPassed, isMarriage: item.type === 'anniversary' };
    }).sort((a, b) => a.daysLeft - b.daysLeft);
})

const isWateredToday = (habit) => habit.lastWatered === new Date().toISOString().split('T')[0]
const waterHabit = (habit) => {
    if (isWateredToday(habit)) return;
    habit.growthValue += 1; habit.lastWatered = new Date().toISOString().split('T')[0];
    const achievedReward = [ {days: habit.stage1Days, name: habit.stage1Reward}, {days: habit.stage2Days, name: habit.stage2Reward}, {days: habit.stage3Days, name: habit.stage3Reward} ].find(r => r.days === habit.growthValue);
    if (achievedReward) {
        showNotification(`🎉 恭喜！解锁阶段奖励：<br><span class="text-yellow-300">${achievedReward.name}</span>`);
        triggerPushNotification('习惯养成里程碑！', `习惯【${habit.name}】已坚持 ${habit.growthValue} 天！<br>成功解锁：<b>${achievedReward.name}</b>`);
    } else {
        showNotification('💧 浇水成功！'); triggerPushNotification('习惯成长通知', `给习惯【${habit.name}】浇水啦！累计 ${habit.growthValue} 天。`);
    }
    saveConfig();
}
const getNextReward = (habit) => {
    if (habit.growthValue < habit.stage1Days) return { days: habit.stage1Days, name: habit.stage1Reward };
    if (habit.growthValue < habit.stage2Days) return { days: habit.stage2Days, name: habit.stage2Reward };
    if (habit.growthValue < habit.stage3Days) return { days: habit.stage3Days, name: habit.stage3Reward };
    return null; 
}
const getHabitProgress = (habit) => { const r = getNextReward(habit); return !r ? 100 : Math.min(100, (habit.growthValue / r.days) * 100); }
const getHabitIcon = (value) => { if (value < 7) return 'ph-fill ph-seedling'; if (value < 21) return 'ph-fill ph-plant'; if (value < 100) return 'ph-fill ph-tree'; return 'ph-fill ph-tree-evergreen'; }

const addTodo = () => {
    if(newTodoText.value.trim() === '') return;
    const text = newTodoText.value.trim();
    familyData.value.todos.push({ id: Date.now(), text: text, completed: false }); newTodoText.value = '';
    showNotification('📝 已记录新待办'); triggerPushNotification('📅 新增家庭待办', `新增待办事项：<br><br><b>${text}</b>`); saveConfig();
}
const toggleTodo = (todo) => {
    todo.completed = !todo.completed;
    if(todo.completed) { showNotification('✅ 滴！待办任务搞定！'); triggerPushNotification('✅ 待办完成通知', `顺利完成了一项待办：<br><br><del>${todo.text}</del>`);
    } else { triggerPushNotification('🔄 待办重新开启', `一项已完成的待办被重新标记为未完成：<br><br><b>${todo.text}</b>`); }
    saveConfig();
}
const deleteTodo = (id) => { familyData.value.todos = familyData.value.todos.filter(t => t.id !== id); saveConfig(); }
</script>