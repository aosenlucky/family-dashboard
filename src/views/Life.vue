    <section class="max-w-6xl mx-auto px-4 mb-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        <div class="space-y-6 md:space-y-8">
            <!-- STREAMING_CHUNK:Rendering Habit Garden... -->
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

            <!-- STREAMING_CHUNK:Rendering Todo List... -->
            <!-- 待办清单 -->
            <div class="glass-card rounded-3xl p-6">
                <h3 class="text-lg font-semibold mb-4 flex items-center text-gray-800"><i class="ph-fill ph-check-square-offset mr-2 text-blue-500"></i> 家庭待办协作</h3>
                <div class="flex gap-2 mb-5">
                    <input v-model="newTodoText" @keyup.enter="addTodo" type="text" placeholder="添加待办事项 (回车保存)" class="flex-1 border border-white/60 bg-white/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition">
                    <button @click="addTodo" class="bg-apple-blue hover:bg-blue-600 text-white rounded-xl px-4 py-2 text-sm shadow-md transition"><i class="ph ph-plus font-bold"></i></button>
                </div>
                <div class="space-y-2 max-h-[250px] overflow-y-auto modal-scroll pr-2">
                    <div v-for="todo in sortedTodos" :key="todo.id" class="flex items-start justify-between bg-white/60 p-3 rounded-xl border border-white shadow-sm transition-all hover:bg-white/80" :class="{'opacity-60': todo.completed}">
                        <div class="flex items-start space-x-3 flex-1 min-w-0 pr-2">
                            <input type="checkbox" :checked="todo.completed" @change="toggleTodo(todo)" class="apple-checkbox shrink-0 mt-0.5">
                            <span class="text-sm text-gray-800 break-words whitespace-normal transition-all duration-300 leading-relaxed" :class="{'line-through text-gray-400': todo.completed}">{{ todo.text }}</span>
                        </div>
                        <button @click="deleteTodo(todo.id)" class="text-gray-400 hover:text-red-500 p-1 shrink-0 mt-0.5"><i class="ph ph-trash"></i></button>
                    </div>
                </div>
            </div>
            
            <!-- STREAMING_CHUNK:Rendering Mental Island Reading Zone... -->
            <!-- 🌟 新增：精神岛屿（书籍展示区） -->
            <div class="glass-card rounded-3xl p-6 relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl transform translate-x-8 -translate-y-8 pointer-events-none"></div>
                <h3 class="text-lg font-semibold mb-6 flex items-center text-gray-800 relative z-10"><i class="ph-fill ph-books mr-2 text-indigo-500"></i> 精神岛屿 <span class="ml-2 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 border border-indigo-100 rounded-full font-normal">大模型提炼</span></h3>
                
                <div v-if="familyData.books && familyData.books.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- 点击书籍卡片触发 openBookNote 方法弹窗 -->
                    <div v-for="book in familyData.books.slice(0,6)" :key="book.bookId" @click="openBookNote(book)" class="bg-white/60 p-3 rounded-2xl border border-white shadow-sm hover:shadow-md transition cursor-pointer flex gap-3 group relative overflow-hidden">
                        <!-- 封面 -->
                        <div class="w-16 h-[88px] bg-gray-200 rounded-lg overflow-hidden shrink-0 shadow-inner">
                            <img :src="book.cover" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onerror="this.src='https://via.placeholder.com/150/e2e8f0/94a3b8?text=Book'">
                        </div>
                        <div class="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            <div>
                                <!-- 💡 核心修复：使用 line-clamp-2 完美支持换行且防溢出，替代之前的 truncate -->
                                <h4 class="font-medium text-gray-800 text-sm line-clamp-2 leading-snug break-words" :title="book.title">{{ book.title }}</h4>
                                <p class="text-[10px] text-gray-500 line-clamp-2 mt-1 leading-snug break-words" :title="book.author">{{ book.author }}</p>
                            </div>
                            <div class="mt-2">
                                <!-- 有AI笔记则展示徽章 -->
                                <div v-if="book.aiNote" class="mt-2 text-[9px] text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded inline-flex items-center"><i class="ph-fill ph-magic-wand mr-1"></i> 已生成深度笔记</div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div v-else class="text-center py-8 text-gray-500 bg-white/30 rounded-2xl border border-dashed border-white">
                    <i class="ph-duotone ph-book-open text-3xl text-indigo-300 mb-2"></i>
                    <p class="text-xs">岛屿上还没有藏书</p>
                    <p class="text-[10px] mt-1 text-gray-400">去配置台中粘贴微信读书笔记来生成吧</p>
                </div>
            </div>
        </div>

        <!-- STREAMING_CHUNK:Rendering Goals and Milestones... -->
        <div class="space-y-6 md:space-y-8">
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

            <!-- STREAMING_CHUNK:Rendering Anniversaries... -->
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

    <!-- STREAMING_CHUNK:Rendering AI Reading Note Modal... -->
    <!-- 🌟 新增：沉浸式读书笔记阅读器弹窗 -->
    <transition name="fade">
        <div v-if="activeBook" class="fixed inset-0 z-[400] flex items-center justify-center p-4 sm:p-6">
            <!-- 点击背景遮罩关闭弹窗 -->
            <div class="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" @click="activeBook = null"></div>
            
            <div class="bg-[#F8F5F0] w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl relative z-10 flex flex-col overflow-hidden border border-white/60">
                <!-- 顶栏 -->
                <div class="flex justify-between items-center px-6 py-4 bg-white/40 border-b border-gray-200/50 backdrop-blur-md shrink-0">
                    <div class="flex items-center space-x-3">
                        <i class="ph-duotone ph-book-open-text text-xl text-indigo-500"></i>
                        <span class="text-sm font-semibold text-gray-800">深度读书笔记</span>
                    </div>
                    <button @click="activeBook = null" class="w-8 h-8 rounded-full bg-gray-200/50 flex justify-center items-center text-gray-500 hover:bg-gray-200 transition"><i class="ph ph-x"></i></button>
                </div>
                
                <div class="flex-1 overflow-y-auto modal-scroll px-6 py-8 relative">
                    <div class="flex flex-col md:flex-row gap-6 mb-8 border-b border-gray-200/60 pb-8">
                        <div class="w-24 h-32 bg-gray-200 rounded-lg shadow-md overflow-hidden shrink-0"><img :src="activeBook.cover" class="w-full h-full object-cover"></div>
                        <div>
                            <h2 class="text-2xl font-bold text-gray-900 mb-1 tracking-tight break-words">{{ activeBook.title }}</h2>
                            <p class="text-sm text-gray-500 mb-4">{{ activeBook.author }}</p>
                        </div>
                    </div>

                    <!-- 💡 核心：调用 renderMarkdown 方法渲染 DeepSeek 生成的深度结构化文本 -->
                    <article class="prose prose-sm md:prose-base prose-slate max-w-none prose-headings:text-gray-800 prose-p:text-gray-700 prose-a:text-indigo-600 prose-strong:text-indigo-800">
                        <div v-if="activeBook.aiNote" v-html="renderMarkdown(activeBook.aiNote)"></div>
                        <div v-else class="text-center py-10 bg-white/50 rounded-2xl border border-dashed border-gray-300">
                            <i class="ph-duotone ph-magic-wand text-4xl text-gray-300 mb-2"></i>
                            <p class="text-sm text-gray-500">笔记生成好像出错了，去配置台重新生成一下吧！</p>
                        </div>
                    </article>
                </div>
            </div>
        </div>
    </transition>

</div>
