<template>
    <div class="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                <h3 class="text-lg font-semibold flex items-center"><i class="ph ph-gear-six mr-2"></i> 家庭空间配置台</h3>
                <button @click="$emit('close')" class="text-gray-400 hover:text-gray-800"><i class="ph ph-x text-xl"></i></button>
            </div>
            
            <div class="flex overflow-x-auto no-scrollbar border-b border-gray-200 px-6 bg-gray-50/50 shrink-0">
                <button @click="configTab = 'life'" :class="configTab === 'life' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500'" class="px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap shrink-0">日常与相册</button>
                <button @click="configTab = 'assets'" :class="configTab === 'assets' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500'" class="px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap shrink-0">资产与股市</button>
                <button @click="configTab = 'loans'" :class="configTab === 'loans' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500'" class="px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap shrink-0">负债与转账</button>
            </div>

            <div class="flex-1 overflow-y-auto modal-scroll p-4 md:p-6 bg-gray-50 relative">
                
                <!-- ================= TAB 1: 日常记录与相册 ================= -->
                <div v-if="configTab === 'life'" class="space-y-6">
                    
                    <!-- 光影相册管理 -->
                    <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('photos')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph-fill ph-camera mr-2 text-purple-500"></i> 光影相册管理
                                <i class="ph ml-2 text-gray-400 transition-transform" :class="activeSections.photos ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addPhoto" class="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition">新增外部链接</button>
                        </div>
                        
                        <div v-show="activeSections.photos" class="mt-4 space-y-6">
                            <!-- 直传控制台 -->
                            <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-3 md:p-4">
                                <h5 class="text-xs font-semibold text-apple-blue mb-3 flex items-center"><i class="ph-bold ph-cloud-arrow-up mr-1"></i> 本地原图直传 (自动入库 OBS)</h5>
                                
                                <div v-if="!uploadFile" @click="$refs.fileInput.click()" class="border-2 border-dashed border-blue-200 bg-white rounded-xl p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition">
                                    <i class="ph-duotone ph-upload-simple text-4xl text-blue-300 mb-2"></i>
                                    <p class="text-sm text-gray-600 font-medium text-center">点击上传高清原图</p>
                                    <p class="text-[10px] text-gray-400 mt-1 text-center">支持无损直连华为云</p>
                                    <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileSelect" />
                                </div>

                                <div v-else class="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                    <div class="w-full md:w-32 aspect-square rounded-lg overflow-hidden bg-gray-100 relative shrink-0 border border-gray-200">
                                        <img :src="uploadPreview" class="w-full h-full object-cover" />
                                        <button @click="cancelUpload" class="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 backdrop-blur-sm"><i class="ph ph-x text-xs"></i></button>
                                    </div>
                                    <div class="flex-1 space-y-3 min-w-0">
                                        <input v-model="uploadMeta.desc" type="text" placeholder="写一句照片描述吧..." class="w-full border-b border-gray-200 px-1 py-1 text-sm focus:border-blue-400 outline-none bg-transparent min-w-0" />
                                        <div class="flex flex-col md:flex-row gap-3">
                                            <div class="flex-1 min-w-0">
                                                <span class="text-[10px] text-gray-400 block mb-0.5">拍摄地点</span>
                                                <input v-model="uploadMeta.city" type="text" placeholder="如: 三亚" class="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 outline-none" />
                                            </div>
                                            <div class="flex-1 min-w-0">
                                                <span class="text-[10px] text-gray-400 block mb-0.5">照片类型</span>
                                                <input v-model="uploadMeta.type" list="photo-types" type="text" placeholder="选择或自定义" class="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 outline-none" />
                                            </div>
                                        </div>
                                        <button @click="submitDirectUpload" :disabled="isUploading" class="w-full bg-apple-blue text-white font-medium py-2 rounded-lg hover:bg-blue-600 shadow-sm transition disabled:bg-gray-400 flex justify-center items-center text-sm">
                                            <i v-if="isUploading" class="ph ph-spinner animate-spin mr-2"></i>
                                            {{ isUploading ? '正在极速直传华为云...' : '一键归档至画廊' }}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- 照片类型管理面板 -->
                            <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 md:p-4">
                                <h5 class="text-xs font-semibold text-gray-700 mb-2 flex items-center"><i class="ph-bold ph-tag mr-1 text-purple-500"></i> 照片类型标签库</h5>
                                <div class="flex flex-wrap gap-2 mb-3">
                                    <span v-for="(type, idx) in familyData.photoTypes" :key="idx" class="text-xs bg-white border border-gray-200 text-gray-700 pl-3 pr-1 py-1 rounded-full shadow-sm flex items-center group transition-all hover:border-red-200">
                                        {{ type }}
                                        <button @click.stop="removePhotoType(idx)" class="ml-2 w-5 h-5 rounded-full bg-red-50 flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm" title="删除该标签">
                                            <i class="ph-bold ph-x text-[10px]"></i>
                                        </button>
                                    </span>
                                </div>
                                <div class="flex gap-2 w-full">
                                    <input v-model="newPhotoType" @keyup.enter="addPhotoType" type="text" placeholder="添加新类型 (如: 家庭合影)" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-0 focus:ring-1 focus:ring-blue-400 outline-none" />
                                    <button @click.stop="addPhotoType" class="bg-white border border-gray-200 shadow-sm px-4 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-apple-blue transition shrink-0">新增</button>
                                </div>
                            </div>

                            <datalist id="photo-types">
                                <option v-for="type in familyData.photoTypes" :key="type" :value="type"></option>
                            </datalist>

                            <!-- 历史图库管理 -->
                            <div class="space-y-3 max-h-[350px] overflow-y-auto modal-scroll pr-2">
                                <div v-for="(photo, idx) in familyData.photos" :key="idx" class="flex flex-row gap-3 md:gap-4 bg-gray-50 p-3 pr-10 rounded-lg border border-gray-200 relative transition-colors hover:bg-white hover:shadow-sm">
                                    <button @click="familyData.photos.splice(idx,1)" class="text-gray-400 absolute right-2 top-2 p-1.5 hover:bg-red-50 hover:text-red-500 rounded transition z-20">
                                        <i class="ph ph-trash text-base"></i>
                                    </button>
                                    
                                    <div class="w-16 h-16 md:w-20 md:h-20 shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-300 shadow-inner flex items-center justify-center relative mt-1">
                                        <img v-if="photo.url" :src="getThumbUrl(photo.url)" class="w-full h-full object-cover relative z-10" onerror="this.src='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&q=80'" />
                                        <i v-else class="ph-duotone ph-image text-gray-400 text-2xl"></i>
                                    </div>
                                    
                                    <div class="flex-1 flex flex-col justify-center space-y-2 min-w-0">
                                        <div class="flex flex-col md:flex-row gap-2 w-full mt-2 md:mt-0">
                                            <input v-model="photo.url" type="text" placeholder="图片URL" class="w-full md:flex-1 border rounded px-2 py-1 text-xs text-gray-500 bg-gray-100 min-w-0" readonly />
                                            <input v-model="photo.desc" type="text" placeholder="描述" class="w-full md:w-1/3 border rounded px-2 py-1 text-xs min-w-0" />
                                        </div>
                                        <div class="flex flex-col md:flex-row gap-2 w-full">
                                            <div class="flex items-center w-full md:flex-1 min-w-0"><span class="text-[10px] text-gray-500 w-8 shrink-0">地点</span><input v-model="photo.tempCity" type="text" class="flex-1 border rounded px-2 py-1 text-xs min-w-0" /></div>
                                            <div class="flex items-center w-full md:flex-1 min-w-0"><span class="text-[10px] text-gray-500 w-8 shrink-0">类型</span><input v-model="photo.type" list="photo-types" type="text" class="flex-1 border rounded px-2 py-1 text-xs bg-white min-w-0" /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 🌟 终极版精神岛屿 (全自动读书笔记) -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 transition-all duration-300">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('reading')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph-fill ph-book-open-text mr-2 text-indigo-500"></i> 精神岛屿 (全自动读书笔记)
                                <i class="ph ml-2 text-gray-400 transition-transform" :class="activeSections.reading ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                        </div>
                        
                        <div v-show="activeSections.reading" class="mt-4 space-y-4">
                            <p class="text-[10px] text-gray-500 leading-relaxed bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-100 flex items-start">
                                <i class="ph-fill ph-lightbulb text-indigo-400 mr-1.5 mt-0.5 text-base"></i>
                                <span><b>使用姿势：</b>在微信读书 APP 中点击「导出 -> 复制到剪贴板」，然后将划线笔记粘贴在下方。<br />DeepSeek 将帮您生成深度笔记，并且<b>系统会自动联网抓取本书的高清封面</b>！</span>
                            </p>
                            
                            <div class="space-y-3">
                                <div>
                                    <label class="text-[10px] text-gray-600 font-medium block mb-1">DeepSeek API Key</label>
                                    <input v-model="familyData.llmApiKey" type="password" placeholder="sk-..." class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-indigo-400 outline-none" />
                                </div>
                                
                                <div>
                                    <label class="text-[10px] text-gray-600 font-medium block mb-1 flex justify-between">
                                        <span>从微信读书复制的原始笔记文本</span>
                                        <button @click="clearRawNote" class="text-gray-400 hover:text-red-500">清空</button>
                                    </label>
                                    <textarea v-model="rawWeReadNote" rows="6" placeholder="《被讨厌的勇气》&#10;岸见一郎 古贺史健&#10;10个笔记&#10;&#10;◆ 引言&#10;>> 哲人：不，这并非无情..." class="w-full border border-gray-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-indigo-400 outline-none resize-y"></textarea>
                                </div>
                                
                                <button @click="generateMagicNote" :disabled="isGeneratingNote || !rawWeReadNote || !familyData.llmApiKey" class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium py-2.5 rounded-lg hover:from-indigo-600 hover:to-purple-600 shadow-md transition disabled:from-gray-300 disabled:to-gray-400 flex justify-center items-center text-sm disabled:cursor-not-allowed">
                                    <i v-if="isGeneratingNote" class="ph ph-spinner animate-spin mr-2"></i>
                                    <i v-else class="ph-fill ph-magic-wand mr-2"></i>
                                    {{ isGeneratingNote ? 'DeepSeek 研读中并自动抓取封面...' : 'AI 一键生成精神岛屿卡片' }}
                                </button>
                            </div>

                            <!-- 已生成的书架管理 -->
                            <div class="mt-6 pt-4 border-t border-gray-100">
                                <h5 class="text-xs font-semibold text-gray-700 mb-3">当前岛屿藏书</h5>
                                <div class="space-y-3 max-h-[350px] overflow-y-auto modal-scroll pr-2">
                                    <div v-for="(book, idx) in familyData.books" :key="idx" class="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-200 relative group transition hover:shadow-sm">
                                        <div class="flex justify-between items-start mb-2">
                                            <div class="flex items-center gap-3 overflow-hidden">
                                                <div class="w-10 h-14 bg-indigo-100 rounded flex items-center justify-center shrink-0 border border-indigo-200/50 overflow-hidden shadow-inner">
                                                    <img :src="book.cover" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300'" />
                                                </div>
                                                <div class="flex flex-col min-w-0 flex-1">
                                                    <span class="text-xs font-medium text-gray-800 line-clamp-2 leading-tight break-words">{{ book.title }}</span>
                                                    <span class="text-[10px] text-gray-500 line-clamp-2 leading-tight break-words mt-0.5">{{ book.author }}</span>
                                                </div>
                                            </div>
                                            <button @click="familyData.books.splice(idx,1)" class="text-gray-400 hover:text-red-500 p-1 shrink-0 ml-2"><i class="ph ph-trash text-lg"></i></button>
                                        </div>
                                        <!-- 允许随时修改已有书籍的封面 -->
                                        <div class="mt-1 flex items-center text-[10px]">
                                            <span class="text-gray-400 w-12 shrink-0">修改封面:</span>
                                            <input v-model="book.cover" type="text" placeholder="图片链接" class="flex-1 border border-gray-200 rounded px-2 py-1 bg-white text-gray-500 outline-none focus:border-indigo-300" />
                                        </div>
                                    </div>
                                    <div v-if="!familyData.books || familyData.books.length === 0" class="text-center py-4 text-[10px] text-gray-400">
                                        还没有藏书，快去粘贴第一本吧！
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 习惯花园 -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('habits')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-potted-plant mr-2 text-green-500"></i> 习惯花园配置
                                <i class="ph ml-2 text-gray-400" :class="activeSections.habits ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addHabit" class="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded">种下新种子</button>
                        </div>
                        <div v-show="activeSections.habits" class="mt-4 space-y-4 max-h-[350px] overflow-y-auto modal-scroll pr-2">
                            <div v-for="(habit, idx) in familyData.habits" :key="idx" class="bg-gray-50 p-3 rounded-xl border border-gray-200 relative">
                                <button @click="familyData.habits.splice(idx,1)" class="text-red-500 absolute right-2 top-2"><i class="ph ph-x"></i></button>
                                <input v-model="habit.name" type="text" placeholder="习惯名称" class="w-[85%] border rounded px-2 py-1 text-xs mb-3" />
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm"><span class="w-10 text-center text-gray-500 bg-gray-100 py-1">目标1</span><input v-model.number="habit.stage1Days" type="number" class="w-10 border-x px-1 text-center py-1" /><input v-model="habit.stage1Reward" type="text" class="flex-1 px-2 py-1" placeholder="阶段奖励" /></div>
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm"><span class="w-10 text-center text-gray-500 bg-gray-100 py-1">目标2</span><input v-model.number="habit.stage2Days" type="number" class="w-10 border-x px-1 text-center py-1" /><input v-model="habit.stage2Reward" type="text" class="flex-1 px-2 py-1" placeholder="阶段奖励" /></div>
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm md:col-span-2"><span class="w-10 text-center text-rose-500 bg-rose-50 py-1">终极</span><input v-model.number="habit.stage3Days" type="number" class="w-10 border-x px-1 text-center py-1" /><input v-model="habit.stage3Reward" type="text" class="flex-1 px-2 py-1" placeholder="终极奖励" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 心愿单与纪念日 -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('goals')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-star mr-2 text-yellow-500"></i> 心愿单与纪念日
                                <i class="ph ml-2 text-gray-400" :class="activeSections.goals ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <div class="flex gap-2">
                                <button @click.stop="addGoal" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加心愿</button>
                                <button @click.stop="addDate" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加日子</button>
                            </div>
                        </div>
                        <div v-show="activeSections.goals" class="mt-4 max-h-[400px] overflow-y-auto modal-scroll pr-2">
                            <div class="space-y-3 mb-6 border-b pb-6 border-gray-100">
                                <div v-for="(goal, idx) in familyData.goals" :key="idx" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                    <input v-model="goal.name" type="text" placeholder="心愿名称" class="w-full md:flex-1 border rounded px-2 py-1 text-xs" />
                                    <input v-model.number="goal.target" type="number" placeholder="目标额" class="w-[45%] md:w-24 border rounded px-2 py-1 text-xs" />
                                    <input v-model.number="goal.current" type="number" placeholder="已攒额" class="w-[45%] md:w-24 border rounded px-2 py-1 text-xs text-apple-blue" />
                                    <button @click="familyData.goals.splice(idx,1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <div v-for="(date, idx) in familyData.dates" :key="idx" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                    <input v-model="date.name" type="text" placeholder="名字" class="w-full md:flex-1 border rounded px-2 py-1 text-xs" />
                                    <input v-model="date.date" type="text" placeholder="YYYY-MM-DD" class="w-[50%] md:w-28 border rounded px-2 py-1 text-xs" />
                                    <select v-model="date.type" class="w-[40%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="birthday">生日</option><option value="anniversary">纪念日</option></select>
                                    <button @click="familyData.dates.splice(idx,1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 2: 资产与股市 ================= -->
                <div v-if="configTab === 'assets'" class="space-y-6">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('stocks')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-trend-up mr-2 text-rose-500"></i> A股/美股配置
                                <i class="ph ml-2 text-gray-400" :class="activeSections.stocks ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addStock" class="text-[10px] bg-gray-100 px-2 py-1 rounded">新增股票</button>
                        </div>
                        <div v-show="activeSections.stocks" class="mt-4">
                            <div class="flex items-center gap-4 mb-4 text-xs bg-gray-50 p-2 rounded-lg">
                                <span class="text-gray-500">美元汇率设定:</span><input v-model.number="familyData.usdRate" type="number" step="0.01" class="border rounded px-2 py-1 w-16" />
                            </div>
                            <div class="space-y-3 max-h-[350px] overflow-y-auto modal-scroll pr-2">
                                <div v-for="(stock, idx) in familyData.stocks" :key="idx" class="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 relative pr-6">
                                    <input v-model="stock.name" type="text" placeholder="名称" class="w-20 border rounded px-1 py-1 text-xs" />
                                    <input v-model="stock.symbol" type="text" placeholder="如:BABA" class="w-24 border rounded px-1 py-1 text-xs uppercase" />
                                    <select v-model="stock.market" class="w-16 border rounded px-1 py-1 text-xs bg-white"><option value="US">美股</option><option value="CN">A股</option></select>
                                    <select v-model="stock.owner" class="w-16 border rounded px-1 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select>
                                    <div class="flex items-center text-[10px] text-gray-500 w-[45%] md:w-auto mt-1 md:mt-0"><span class="w-8">成本:</span><input v-model.number="stock.costPrice" type="number" step="0.01" class="w-16 border rounded px-1 py-1 text-xs" /></div>
                                    <div class="flex items-center text-[10px] text-gray-500 w-[45%] md:w-auto mt-1 md:mt-0"><span class="w-8">股数:</span><input v-model.number="stock.shares" type="number" class="w-16 border rounded px-1 py-1 text-xs" /></div>
                                    <div class="flex items-center text-[10px] text-blue-500 w-full md:w-auto mt-1 md:mt-0"><span class="w-16">手动现价:</span><input v-model.number="stock.currentPrice" type="number" step="0.01" class="w-16 border rounded border-blue-200 bg-blue-50 px-1 py-1 text-xs font-bold" /></div>
                                    <button @click="familyData.stocks.splice(idx,1)" class="text-red-500 absolute right-1 top-2"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('assets')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-house mr-2 text-blue-500"></i> 固定与基金等资产录入
                                <i class="ph ml-2 text-gray-400" :class="activeSections.assets ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addRegularAsset" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加资产</button>
                        </div>
                        <div v-show="activeSections.assets" class="mt-4 space-y-2 max-h-[300px] overflow-y-auto modal-scroll pr-2">
                            <div v-for="(asset, idx) in familyData.assets" :key="asset.id" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                <input v-model="asset.name" type="text" placeholder="资产名称" class="w-full md:flex-1 border rounded px-2 py-1 text-xs" />
                                <select v-model="asset.owner" class="w-[30%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select>
                                <select v-model="asset.type" class="w-[30%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="house">房产</option><option value="fund">基金/理财</option><option value="cash">存款</option><option value="other">其他</option></select>
                                <input v-model.number="asset.value" type="number" placeholder="当前估值(元)" class="w-[35%] md:w-28 border rounded px-2 py-1 text-xs font-medium text-green-600" />
                                <button @click="familyData.assets.splice(idx, 1)" class="text-red-500 absolute right-0 top-1"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('equity')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-aperture mr-2 text-red-500"></i> 家族股权 (HW)
                                <i class="ph ml-2 text-gray-400" :class="activeSections.equity ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addEquityMember" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加持股人</button>
                        </div>
                        <div v-show="activeSections.equity" class="mt-4">
                            <div class="flex items-center gap-4 mb-4 text-xs bg-gray-50 p-2 rounded-lg">
                                <div class="flex items-center"><span class="text-gray-500 mr-2">每股价格:</span><input v-model.number="familyData.equity.pricePerShare" type="number" step="0.01" class="border rounded px-2 py-1 w-16" /></div>
                                <div class="flex items-center"><span class="text-gray-500 mr-2">预测分红(元/股):</span><input v-model.number="familyData.equity.dividendRate" type="number" step="0.01" class="border rounded px-2 py-1 w-16 text-rose-500 font-bold" /></div>
                            </div>
                            <div class="space-y-2 max-h-[300px] overflow-y-auto modal-scroll pr-2">
                                <div v-for="(member, idx) in familyData.equity.members" :key="idx" class="flex items-center space-x-2 relative pr-6">
                                    <input v-model="member.name" type="text" placeholder="持股人" class="w-1/3 border rounded-md px-2 py-1.5 text-xs" />
                                    <input v-model.number="member.principal" type="number" placeholder="投资本金(元)" class="flex-1 border rounded-md px-2 py-1.5 text-xs text-green-600" />
                                    <button @click="familyData.equity.members.splice(idx, 1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 3: 负债与转账 ================= -->
                <div v-if="configTab === 'loans'" class="space-y-6">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('loans')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-notebook mr-1 text-apple-blue"></i> 贷款明细
                                <i class="ph ml-2 text-gray-400" :class="activeSections.loans ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addLoan" class="text-[10px] bg-gray-100 px-2 py-1 rounded">新增贷款</button>
                        </div>
                        <div v-show="activeSections.loans" class="mt-4 space-y-3 max-h-[400px] overflow-y-auto modal-scroll pr-2">
                            <div v-for="(loan, idx) in familyData.loans" :key="loan.id" class="p-3 bg-gray-50 rounded-xl border border-gray-200 relative">
                                <button @click="familyData.loans.splice(idx, 1)" class="absolute right-2 top-2 text-red-500 text-xs"><i class="ph ph-trash"></i></button>
                                <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                    <div><label class="text-[10px] text-gray-500">归属</label><select v-model="loan.owner" class="w-full border rounded px-1.5 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select></div>
                                    <div><label class="text-[10px] text-gray-500">名称</label><input v-model="loan.bank" type="text" class="w-full border rounded px-1.5 py-1 text-xs" /></div>
                                    <div><label class="text-[10px] text-gray-500">类型</label><select v-model="loan.type" class="w-full border rounded px-1.5 py-1 text-xs bg-white"><option value="房贷">房贷(精准推演)</option><option value="消费贷">消费贷(简易)</option></select></div>
                                    <div><label class="text-[10px] text-gray-500">还款日</label><input v-model.number="loan.day" type="number" class="w-full border rounded px-1.5 py-1 text-xs" /></div>
                                    <div><label class="text-[10px] text-gray-500">年化%</label><input v-model.number="loan.rate" type="number" step="0.01" class="w-full border rounded px-1.5 py-1 text-xs" /></div>
                                </div>
                                <div v-if="loan.type === '房贷'" class="grid grid-cols-1 md:grid-cols-3 gap-2 border-t pt-2 mt-2 border-gray-200">
                                    <div><label class="text-[10px] text-blue-500">数据快照年月</label><input v-model="loan.baseDate" type="text" placeholder="2026-05" class="w-full border border-blue-200 rounded px-1.5 py-1 text-xs" /></div>
                                    <div><label class="text-[10px] text-blue-500">快照真实本金</label><input v-model.number="loan.baseLeft" type="number" class="w-full border border-blue-200 rounded px-1.5 py-1 text-xs" /></div>
                                    <div><label class="text-[10px] text-blue-600 font-bold">固定总月供</label><input v-model.number="loan.baseMonthly" type="number" class="w-full border border-blue-400 bg-blue-50 rounded px-1.5 py-1 text-xs text-blue-800 font-semibold" /></div>
                                </div>
                                <div v-else class="grid grid-cols-2 gap-2 border-t pt-2 mt-2 border-gray-200">
                                    <div><label class="text-[10px] text-orange-500">剩余本金</label><input v-model.number="loan.left" type="number" class="w-full border border-orange-200 rounded px-1.5 py-1 text-xs" /></div>
                                    <div><label class="text-[10px] text-orange-500">每月设定还款</label><input v-model.number="loan.monthly" type="number" class="w-full border border-orange-200 rounded px-1.5 py-1 text-xs" /></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex items-center gap-4 mb-4 border-b pb-4"><div class="w-1/2"><label class="text-xs text-gray-500">主发薪卡</label><input v-model="familyData.salaryBank" type="text" class="w-full border rounded px-2 py-1 text-xs" /></div><div class="w-1/2"><label class="text-xs text-gray-500">发薪日</label><input v-model.number="familyData.salaryDay" type="number" class="w-full border rounded px-2 py-1 text-xs" /></div></div>
                        <div class="flex justify-between items-center cursor-pointer select-none" @click="toggle('transfers')">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center">
                                <i class="ph ph-git-branch mr-1 text-purple-500"></i> 自动转账拓扑线
                                <i class="ph ml-2 text-gray-400" :class="activeSections.transfers ? 'ph-caret-up' : 'ph-caret-down'"></i>
                            </h4>
                            <button @click.stop="addTransfer" class="text-[10px] bg-gray-100 px-2 py-1 rounded">添加路线</button>
                        </div>
                        <div v-show="activeSections.transfers" class="mt-4 space-y-2 max-h-[300px] overflow-y-auto modal-scroll pr-2">
                            <div v-for="(transfer, idx) in familyData.transfers" :key="idx" class="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 relative pr-6">
                                <input v-model="transfer.from" type="text" placeholder="转出" class="w-[70px] border rounded px-1 py-1 text-xs" /><i class="ph ph-arrow-right text-gray-400"></i>
                                <input v-model="transfer.to" type="text" placeholder="转入" class="w-[70px] border rounded px-1 py-1 text-xs" />
                                <input v-model.number="transfer.amount" type="number" placeholder="金额" class="w-20 border rounded px-1 py-1 text-xs text-blue-600 font-medium" />
                                <div class="flex items-center text-xs text-gray-500 w-16"><input v-model.number="transfer.day" type="number" placeholder="日" class="w-8 border rounded px-1 py-1 text-center mr-1" />日</div>
                                <input v-model="transfer.expire" type="text" placeholder="到期日" class="w-24 border rounded px-1 py-1 text-[10px]" />
                                <button @click="familyData.transfers.splice(idx,1)" class="text-red-500 absolute right-1"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 底部按钮 -->
            <div class="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-white shrink-0">
                <button @click="logout" class="text-sm text-red-500 hover:text-red-700 transition-colors"><i class="ph ph-lock mr-1"></i>锁定家门</button>
                <div class="space-x-3 flex items-center">
                    <button @click="$emit('close')" class="px-4 py-2 text-sm text-gray-600">取消</button>
                    <button @click="saveAndClose" class="px-6 py-2 text-sm bg-gray-800 text-white rounded-full hover:bg-gray-700 shadow-md transition-colors">保存刷新</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, inject } from 'vue'

const emit = defineEmits(['close'])
const familyData = inject('familyData')
const saveConfig = inject('saveConfig')
const showNotification = inject('showNotification')

const configTab = ref('life')

const activeSections = ref({
    photos: true,
    habits: true,
    goals: true,
    stocks: true,
    assets: true,
    equity: true,
    loans: true,
    transfers: true,
    reading: true
});
const toggle = (sec) => { activeSections.value[sec] = !activeSections.value[sec]; };

// 🌟 纯前端 AI 魔法生成引擎 🌟
const rawWeReadNote = ref('')
const isGeneratingNote = ref(false)
const clearRawNote = () => { rawWeReadNote.value = ''; }

// 💡 核心新增：利用 Google Books API 自动检索全球图书封面
const searchBookCover = async (title, author) => {
    try {
        const query = encodeURIComponent(`${title} ${author}`);
        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
        const data = await res.json();
        if (data.items && data.items.length > 0) {
            const volumeInfo = data.items[0].volumeInfo;
            if (volumeInfo.imageLinks && volumeInfo.imageLinks.thumbnail) {
                return volumeInfo.imageLinks.thumbnail.replace('http:', 'https:');
            }
        }
    } catch (e) {
        console.warn("自动获取封面失败", e);
    }
    return "https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=300";
}

const generateMagicNote = async () => {
    const rawText = rawWeReadNote.value.trim()
    const apiKey = familyData.value.llmApiKey?.trim()
    
    if (!rawText || !apiKey) return;
    
    isGeneratingNote.value = true;
    
    const prompt = `
你是一个深度阅读与知识管理专家。下面是一段我从微信读书里导出的原始笔记文本，里面包含书籍信息和大量我划线的句子。
请你帮我完成两件事：

第一，识别出这本的书名和作者。
第二，根据书籍信息和阅读笔记，生成一份完整、深入、结构清晰的读书笔记。

## 我提供的信息
- 书籍信息与原始笔记：
<raw_notes>
${rawText.substring(0, 6000)}
</raw_notes>
- 阅读动机/目的：提炼、整合并融入批判性思考，形成可供日后快速回顾的深度知识库。

## 生成要求
请严格按照以下板块生成笔记，语言精炼且有深度，避免简单复述目录，要提炼、整合并融入批判性思考。

### 一、全书核心概括
用1-5句话概括这本书在“说什么”，点明核心命题和最终结论。如果书籍是虚构类，请概括主线情节与核心主题，对作者进行简要介绍。

### 二、全书逻辑骨架
分析全书的组织结构、论证脉络或叙事结构。作者是如何一步步展开的？各章节之间有怎样的递进或并列关系？画出清晰的知识/情节地图。

### 三、关键洞见与颠覆认知（非虚构）/ 人物弧光与象征隐喻（虚构）
- **非虚构类**：提炼书中最重要的5-10个观点、模型或数据。对每一个进行简要阐述，并指出它如何挑战或深化了既有认知。
- **虚构类**：分析主要人物的成长轨迹、关键转折，以及作品中反复出现的意象、象征手法及其背后的深意。

### 四、高光语录
摘录5-10句最击中你、最能体现本书神髓的原句，并附上你选择它的简短理由（为什么这句话重要）。

### 五、共鸣、质疑与边界
- **内在共鸣**：书中的哪些内容与你自身的经验、困惑或已有知识产生了强烈共振？
- **批判性质疑**：你是否发现作者论证的漏洞、视角的局限，或不同意其部分观点？理由是什么？
- **适用边界**：这本书的结论在什么条件下有效？在什么场景或人群中可能不适用？

### 六、关联与互文
这本书与你读过的其他书、看过的电影、学过的理论有何联系？它处于什么样的思想网络或文学传统中？请进行跨书/跨领域联结，构建你的知识网络。

### 七、行动启示与改变清单
这本书让你产生哪些具体的行为意图或思维转变？请列出3-5条可立即实践的“最小行动”或需要长期内化的心智模式。

### 八、一句话推荐
如果只能用一句话向特定人群推荐这本书，你会怎么说？（请明确推荐给“谁”，以及能解决“什么需求”）

【强制输出格式】
请严格以纯 JSON 格式输出，不要有任何多余的文字说明，不要用 \`\`\`json 包裹。
格式要求如下：
{
  "title": "提取出的书名",
  "author": "提取出的作者",
  "markdownNote": "你生成的 Markdown 格式读书笔记正文"
}
    `;

    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {"role": "system", "content": "你是一个只返回严格 JSON 格式数据的知识处理助手。"},
                    {"role": "user", "content": prompt}
                ],
                temperature: 0.6,
                response_format: { type: "json_object" } 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 请求失败: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        const contentStr = result.choices[0].message.content;
        const parsedData = JSON.parse(contentStr);

        const finalCoverUrl = await searchBookCover(parsedData.title, parsedData.author);

        if (!familyData.value.books) familyData.value.books = [];
        
        familyData.value.books.unshift({
            bookId: Date.now().toString(),
            title: parsedData.title || "未知书名",
            author: parsedData.author || "佚名",
            cover: finalCoverUrl, 
            readPercentage: 100, 
            aiNote: parsedData.markdownNote
        });

        showNotification('🎉 魔法生效！深度笔记已生成，且系统为您抓取了高清封面！');
        rawWeReadNote.value = ''; 

        await saveConfig();

    } catch (error) {
        console.error("生成笔记出错:", error);
        alert("生成失败，请检查 API Key 额度或网络连接！\n详细信息: " + error.message);
    } finally {
        isGeneratingNote.value = false;
    }
}

const fileInput = ref(null)
const uploadFile = ref(null)
const uploadPreview = ref('')
const isUploading = ref(false)
const uploadMeta = ref({ desc: '', city: '', type: '日常记录' })

const newPhotoType = ref('')
const addPhotoType = () => {
    const type = newPhotoType.value.trim();
    if (type && !familyData.value.photoTypes.includes(type)) {
        familyData.value.photoTypes.push(type);
        newPhotoType.value = '';
    }
}
const removePhotoType = (idx) => {
    familyData.value.photoTypes.splice(idx, 1);
}

const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    uploadFile.value = file;
    uploadPreview.value = URL.createObjectURL(file);
}

const cancelUpload = () => {
    uploadFile.value = null; uploadPreview.value = '';
    uploadMeta.value = { desc: '', city: '', type: '日常记录' };
}

const submitDirectUpload = async () => {
    if (!uploadFile.value) return;
    isUploading.value = true;
    const token = sessionStorage.getItem('family_auth_token');

    try {
        const authRes = await fetch(`/api/get-upload-url?filename=${encodeURIComponent(uploadFile.value.name)}&contentType=${encodeURIComponent(uploadFile.value.type)}`, {
            headers: { 'Authorization': token }
        });
        
        if (!authRes.ok) throw new Error('通行证获取失败，请检查 Vercel 环境变量');
        const { uploadUrl, finalUrl } = await authRes.json();

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            body: uploadFile.value,
            headers: { 'Content-Type': uploadFile.value.type }
        });

        if (!uploadRes.ok) throw new Error('上传华为云失败，请检查 OBS CORS 跨域设置');

        const finalType = uploadMeta.value.type || '日常记录';
        if (!familyData.value.photoTypes.includes(finalType)) {
            familyData.value.photoTypes.push(finalType);
        }

        familyData.value.photos.unshift({
            url: finalUrl,
            desc: uploadMeta.value.desc || `上传于 ${new Date().toLocaleDateString()}`,
            tempCity: uploadMeta.value.city,
            type: finalType
        });

        showNotification('🎉 高清原图已成功上云归档！');
        cancelUpload();
        await saveConfig();

    } catch (e) {
        alert("上传失败: " + e.message);
    } finally {
        isUploading.value = false;
    }
}

// === 各模块新增项操作 ===
const addHabit = () => { familyData.value.habits.push({ id: Date.now(), name: '', growthValue: 0, lastWatered: '', stage1Days: 7, stage1Reward: '小星星', stage2Days: 21, stage2Reward: '神秘小礼物', stage3Days: 100, stage3Reward: '实现大愿望' }) }
const addGoal = () => { familyData.value.goals.push({ name: '', target: 10000, current: 0 }) }
const addDate = () => { familyData.value.dates.push({ name: '', date: '2000-01-01', type: 'birthday' }) }
const addStock = () => { familyData.value.stocks.push({ symbol: '', name: '', market: 'CN', owner: 'Aosen', costPrice: 0, shares: 0, currentPrice: 0 }) }
const addRegularAsset = () => { familyData.value.assets.push({ id: Date.now(), owner: '共同', type: 'house', name: '', value: 0 }) }
const addEquityMember = () => { familyData.value.equity.members.push({ name: '', principal: 0 }) }
const addLoan = () => { familyData.value.loans.push({ id: Date.now(), owner: '共同', type: '消费贷', bank: '', left: 0, monthly: 0, rate: 3.0, isAutoCalc: false }) }
const addTransfer = () => { familyData.value.transfers.push({ from: '', to: '', amount: 0, day: 1, expire: '长期' }) }
const addPhoto = () => { familyData.value.photos.unshift({ url: '', desc: '', tempCity: '', type: '日常记录' }) }

const getThumbUrl = (url) => {
    if (!url) return '';
    return url.includes('myhuaweicloud.com') ? url + '?x-image-process=image/resize,w_200/quality,q_60' : url;
}

const logout = () => { sessionStorage.removeItem('family_auth_token'); window.location.reload(); }
const saveAndClose = async () => { await saveConfig(); emit('close'); }
</script>
```