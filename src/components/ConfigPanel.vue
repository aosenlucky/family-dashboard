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
                    
                    <!-- 💡 核心模块：原图直传与相册管理 -->
                    <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph-fill ph-camera mr-2 text-purple-500"></i> 光影相册管理</h4>
                            <button @click="addPhoto" class="text-[10px] bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition">新增外部链接</button>
                        </div>
                        
                        <!-- 🌟 智能直传控制台 -->
                        <div class="bg-blue-50/50 border border-blue-100 rounded-xl p-3 md:p-4 mb-6">
                            <h5 class="text-xs font-semibold text-apple-blue mb-3 flex items-center"><i class="ph-bold ph-cloud-arrow-up mr-1"></i> 本地原图直传 (自动入库 OBS)</h5>
                            
                            <!-- 拖拽上传区 -->
                            <div v-if="!uploadFile" @click="$refs.fileInput.click()" class="border-2 border-dashed border-blue-200 bg-white rounded-xl p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition">
                                <i class="ph-duotone ph-upload-simple text-4xl text-blue-300 mb-2"></i>
                                <p class="text-sm text-gray-600 font-medium text-center">点击上传高清原图</p>
                                <p class="text-[10px] text-gray-400 mt-1 text-center">支持无损直连华为云</p>
                                <input type="file" ref="fileInput" class="hidden" accept="image/*" @change="handleFileSelect">
                            </div>

                            <!-- 预览与元数据填写区 -->
                            <div v-else class="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                <div class="w-full md:w-32 aspect-square rounded-lg overflow-hidden bg-gray-100 relative shrink-0 border border-gray-200">
                                    <img :src="uploadPreview" class="w-full h-full object-cover">
                                    <button @click="cancelUpload" class="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 backdrop-blur-sm"><i class="ph ph-x text-xs"></i></button>
                                </div>
                                <div class="flex-1 space-y-3 min-w-0">
                                    <div>
                                        <input v-model="uploadMeta.desc" type="text" placeholder="写一句照片描述吧..." class="w-full border-b border-gray-200 px-1 py-1 text-sm focus:border-blue-400 outline-none bg-transparent min-w-0">
                                    </div>
                                    <!-- 💡 修复移动端布局：将原来的 flex 改成 flex-col md:flex-row，防止手机端挤爆边界 -->
                                    <div class="flex flex-col md:flex-row gap-3">
                                        <div class="flex-1 min-w-0">
                                            <span class="text-[10px] text-gray-400 block mb-0.5">拍摄地点</span>
                                            <input v-model="uploadMeta.city" type="text" placeholder="如: 三亚" class="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 outline-none">
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <span class="text-[10px] text-gray-400 block mb-0.5">照片类型</span>
                                            <input v-model="uploadMeta.type" list="photo-types" type="text" placeholder="选择或自定义" class="w-full border rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-400 outline-none">
                                        </div>
                                    </div>
                                    <button @click="submitDirectUpload" :disabled="isUploading" class="w-full bg-apple-blue text-white font-medium py-2 rounded-lg hover:bg-blue-600 shadow-sm transition disabled:bg-gray-400 flex justify-center items-center text-sm">
                                        <i v-if="isUploading" class="ph ph-spinner animate-spin mr-2"></i>
                                        {{ isUploading ? '正在极速直传华为云...' : '一键归档至画廊' }}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 💡 新增：动态照片类型管理面板 -->
                        <div class="bg-gray-50 border border-gray-100 rounded-xl p-3 md:p-4 mb-6">
                            <h5 class="text-xs font-semibold text-gray-700 mb-2 flex items-center"><i class="ph-bold ph-tag mr-1 text-purple-500"></i> 照片类型标签库</h5>
                            <div class="flex flex-wrap gap-2 mb-3">
                                <!-- 💡 修复删除按钮不显示：去掉了 hidden group-hover:inline-block，改为手机电脑全平台一直显示 -->
                                <span v-for="(type, idx) in familyData.photoTypes" :key="idx" class="text-[10px] bg-white border border-gray-200 text-gray-600 px-2.5 py-1 rounded-full shadow-sm flex items-center">
                                    {{ type }}
                                    <i @click="removePhotoType(idx)" class="ph-bold ph-x ml-1.5 text-gray-400 hover:text-red-500 cursor-pointer transition-colors" title="删除该标签"></i>
                                </span>
                            </div>
                            <div class="flex gap-2 w-full">
                                <input v-model="newPhotoType" @keyup.enter="addPhotoType" type="text" placeholder="添加新类型 (如: 家庭合影)" class="border border-gray-200 rounded-lg px-2 py-1.5 text-xs flex-1 min-w-0 focus:ring-1 focus:ring-blue-400 outline-none">
                                <button @click="addPhotoType" class="bg-white border border-gray-200 shadow-sm px-4 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:text-apple-blue transition shrink-0">新增</button>
                            </div>
                        </div>

                        <!-- 动态预设类别 -->
                        <datalist id="photo-types">
                            <option v-for="type in familyData.photoTypes" :key="type" :value="type"></option>
                        </datalist>

                        <!-- 历史图库管理 -->
                        <div class="space-y-3">
                            <div v-for="(photo, idx) in familyData.photos" :key="idx" class="flex flex-col md:flex-row gap-3 md:gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200 relative transition-colors hover:bg-white hover:shadow-sm">
                                <button @click="familyData.photos.splice(idx,1)" class="text-red-500 absolute right-2 top-2 hover:text-red-700 transition z-10"><i class="ph ph-x text-sm"></i></button>
                                
                                <div class="w-full md:w-20 h-24 md:h-20 shrink-0 rounded-lg overflow-hidden bg-gray-200 border border-gray-300 shadow-inner flex items-center justify-center relative">
                                    <img v-if="photo.url" :src="getThumbUrl(photo.url)" class="w-full h-full object-cover relative z-10" onerror="this.src='https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200&q=80'">
                                    <i v-else class="ph-duotone ph-image text-gray-400 text-2xl"></i>
                                </div>
                                
                                <div class="flex-1 flex flex-col justify-center space-y-2 md:pr-6 min-w-0">
                                    <div class="flex flex-col md:flex-row gap-2 w-full mt-2 md:mt-0">
                                        <input v-model="photo.url" type="text" placeholder="图片URL" class="w-full md:flex-1 border rounded px-2 py-1.5 text-xs text-gray-500 bg-gray-100 min-w-0" readonly>
                                        <input v-model="photo.desc" type="text" placeholder="描述" class="w-full md:w-1/3 border rounded px-2 py-1.5 text-xs min-w-0">
                                    </div>
                                    <div class="flex flex-col md:flex-row gap-2 w-full">
                                        <div class="flex items-center w-full md:flex-1 min-w-0"><span class="text-[10px] text-gray-500 w-8 shrink-0">地点</span><input v-model="photo.tempCity" type="text" class="flex-1 border rounded px-2 py-1.5 text-xs min-w-0"></div>
                                        <div class="flex items-center w-full md:flex-1 min-w-0"><span class="text-[10px] text-gray-500 w-8 shrink-0">类型</span><input v-model="photo.type" list="photo-types" type="text" class="flex-1 border rounded px-2 py-1.5 text-xs bg-white min-w-0"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 习惯花园 -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-potted-plant mr-2 text-green-500"></i> 习惯花园配置</h4><button @click="addHabit" class="text-[10px] bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded">种下新种子</button></div>
                        <div class="space-y-4">
                            <div v-for="(habit, idx) in familyData.habits" :key="idx" class="bg-gray-50 p-3 rounded-xl border border-gray-200 relative">
                                <button @click="familyData.habits.splice(idx,1)" class="text-red-500 absolute right-2 top-2"><i class="ph ph-x"></i></button>
                                <input v-model="habit.name" type="text" placeholder="习惯名称" class="w-[85%] border rounded px-2 py-1 text-xs mb-3">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm"><span class="w-10 text-center text-gray-500 bg-gray-100 py-1">目标1</span><input v-model.number="habit.stage1Days" type="number" class="w-10 border-x px-1 text-center py-1"><input v-model="habit.stage1Reward" type="text" class="flex-1 px-2 py-1" placeholder="阶段奖励"></div>
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm"><span class="w-10 text-center text-gray-500 bg-gray-100 py-1">目标2</span><input v-model.number="habit.stage2Days" type="number" class="w-10 border-x px-1 text-center py-1"><input v-model="habit.stage2Reward" type="text" class="flex-1 px-2 py-1" placeholder="阶段奖励"></div>
                                    <div class="flex items-center text-[10px] bg-white border rounded px-1 overflow-hidden shadow-sm md:col-span-2"><span class="w-10 text-center text-rose-500 bg-rose-50 py-1">终极</span><input v-model.number="habit.stage3Days" type="number" class="w-10 border-x px-1 text-center py-1"><input v-model="habit.stage3Reward" type="text" class="flex-1 px-2 py-1" placeholder="终极奖励"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 心愿单与纪念日 -->
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-star mr-2 text-yellow-500"></i> 心愿单</h4><button @click="addGoal" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加心愿</button></div>
                        <div class="space-y-3 mb-6 border-b pb-6 border-gray-100">
                            <div v-for="(goal, idx) in familyData.goals" :key="idx" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                <input v-model="goal.name" type="text" placeholder="心愿名称" class="w-full md:flex-1 border rounded px-2 py-1 text-xs">
                                <input v-model.number="goal.target" type="number" placeholder="目标额" class="w-[45%] md:w-24 border rounded px-2 py-1 text-xs">
                                <input v-model.number="goal.current" type="number" placeholder="已攒额" class="w-[45%] md:w-24 border rounded px-2 py-1 text-xs text-apple-blue">
                                <button @click="familyData.goals.splice(idx,1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-calendar-heart mr-2 text-rose-400"></i> 纪念日</h4><button @click="addDate" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加日子</button></div>
                        <div class="space-y-3">
                            <div v-for="(date, idx) in familyData.dates" :key="idx" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                <input v-model="date.name" type="text" placeholder="名字" class="w-full md:flex-1 border rounded px-2 py-1 text-xs">
                                <input v-model="date.date" type="text" placeholder="YYYY-MM-DD" class="w-[50%] md:w-28 border rounded px-2 py-1 text-xs">
                                <select v-model="date.type" class="w-[40%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="birthday">生日</option><option value="anniversary">纪念日</option></select>
                                <button @click="familyData.dates.splice(idx,1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 2: 资产与股市 ================= -->
                <div v-if="configTab === 'assets'" class="space-y-6">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4">
                            <h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-trend-up mr-2 text-rose-500"></i> A股/美股配置</h4>
                            <button @click="addStock" class="text-[10px] bg-gray-100 px-2 py-1 rounded">新增股票</button>
                        </div>
                        <div class="flex items-center gap-4 mb-4 text-xs bg-gray-50 p-2 rounded-lg">
                            <span class="text-gray-500">美元汇率设定:</span><input v-model.number="familyData.usdRate" type="number" step="0.01" class="border rounded px-2 py-1 w-16">
                        </div>
                        <div class="space-y-3">
                            <div v-for="(stock, idx) in familyData.stocks" :key="idx" class="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 relative pr-6">
                                <input v-model="stock.name" type="text" placeholder="名称" class="w-20 border rounded px-1 py-1 text-xs">
                                <input v-model="stock.symbol" type="text" placeholder="如:BABA / 002230" class="w-28 border rounded px-1 py-1 text-xs uppercase" title="美股填代码，A股可直接填数字">
                                <select v-model="stock.market" class="w-16 border rounded px-1 py-1 text-xs bg-white"><option value="US">美股</option><option value="CN">A股</option></select>
                                <select v-model="stock.owner" class="w-16 border rounded px-1 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select>
                                <div class="flex items-center text-[10px] text-gray-500 w-[45%] md:w-auto mt-1 md:mt-0"><span class="w-8">成本:</span><input v-model.number="stock.costPrice" type="number" step="0.01" class="w-16 border rounded px-1 py-1 text-xs"></div>
                                <div class="flex items-center text-[10px] text-gray-500 w-[45%] md:w-auto mt-1 md:mt-0"><span class="w-8">股数:</span><input v-model.number="stock.shares" type="number" class="w-16 border rounded px-1 py-1 text-xs"></div>
                                <div class="flex items-center text-[10px] text-blue-500 w-full md:w-auto mt-1 md:mt-0"><span class="w-16">手动现价:</span><input v-model.number="stock.currentPrice" type="number" step="0.01" class="w-16 border rounded border-blue-200 bg-blue-50 px-1 py-1 text-xs font-bold" title="抓取失败时使用此价格"></div>
                                <button @click="familyData.stocks.splice(idx,1)" class="text-red-500 absolute right-1 top-2"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-house mr-2 text-blue-500"></i> 固定与基金等资产录入</h4><button @click="addRegularAsset" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加资产</button></div>
                        <div class="space-y-2">
                            <div v-for="(asset, idx) in familyData.assets" :key="asset.id" class="flex flex-wrap md:flex-nowrap gap-2 items-center relative pr-6">
                                <input v-model="asset.name" type="text" placeholder="资产名称" class="w-full md:flex-1 border rounded px-2 py-1 text-xs">
                                <select v-model="asset.owner" class="w-[30%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select>
                                <select v-model="asset.type" class="w-[30%] md:w-20 border rounded px-1 py-1 text-xs bg-white"><option value="house">房产</option><option value="fund">基金/理财</option><option value="cash">存款</option><option value="other">其他</option></select>
                                <input v-model.number="asset.value" type="number" placeholder="当前估值(元)" class="w-[35%] md:w-28 border rounded px-2 py-1 text-xs font-medium text-green-600">
                                <button @click="familyData.assets.splice(idx, 1)" class="text-red-500 absolute right-0 top-1"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-aperture mr-2 text-red-500"></i> 家族股权 (HW)</h4><button @click="addEquityMember" class="text-[10px] bg-gray-100 px-2 py-1 rounded">加持股人</button></div>
                        <div class="flex items-center gap-4 mb-4 text-xs bg-gray-50 p-2 rounded-lg">
                            <div class="flex items-center"><span class="text-gray-500 mr-2">每股价格:</span><input v-model.number="familyData.equity.pricePerShare" type="number" step="0.01" class="border rounded px-2 py-1 w-16"></div>
                            <div class="flex items-center"><span class="text-gray-500 mr-2">预测分红(元/股):</span><input v-model.number="familyData.equity.dividendRate" type="number" step="0.01" class="border rounded px-2 py-1 w-16 text-rose-500 font-bold"></div>
                        </div>
                        <div class="space-y-2">
                            <div v-for="(member, idx) in familyData.equity.members" :key="idx" class="flex items-center space-x-2 relative pr-6">
                                <input v-model="member.name" type="text" placeholder="持股人" class="w-1/3 border rounded-md px-2 py-1.5 text-xs">
                                <input v-model.number="member.principal" type="number" placeholder="投资本金(元)" class="flex-1 border rounded-md px-2 py-1.5 text-xs text-green-600">
                                <button @click="familyData.equity.members.splice(idx, 1)" class="text-red-500 absolute right-0"><i class="ph ph-x"></i></button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ================= TAB 3: 负债与转账 ================= -->
                <div v-if="configTab === 'loans'" class="space-y-6">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-notebook mr-1 text-apple-blue"></i> 贷款明细</h4><button @click="addLoan" class="text-[10px] bg-gray-100 px-2 py-1 rounded">新增贷款</button></div>
                        <div class="space-y-3">
                            <div v-for="(loan, idx) in familyData.loans" :key="loan.id" class="p-3 bg-gray-50 rounded-xl border border-gray-200 relative">
                                <button @click="familyData.loans.splice(idx, 1)" class="absolute right-2 top-2 text-red-500 text-xs"><i class="ph ph-trash"></i></button>
                                <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
                                    <div><label class="text-[10px] text-gray-500">归属</label><select v-model="loan.owner" class="w-full border rounded px-1.5 py-1 text-xs bg-white"><option value="共同">共同</option><option value="Aosen">Aosen</option><option value="小悦">小悦</option></select></div>
                                    <div><label class="text-[10px] text-gray-500">名称</label><input v-model="loan.bank" type="text" class="w-full border rounded px-1.5 py-1 text-xs"></div>
                                    <div><label class="text-[10px] text-gray-500">类型</label><select v-model="loan.type" class="w-full border rounded px-1.5 py-1 text-xs bg-white"><option value="房贷">房贷(精准推演)</option><option value="消费贷">消费贷(简易)</option></select></div>
                                    <div><label class="text-[10px] text-gray-500">还款日</label><input v-model.number="loan.day" type="number" class="w-full border rounded px-1.5 py-1 text-xs"></div>
                                    <div><label class="text-[10px] text-gray-500">年化%</label><input v-model.number="loan.rate" type="number" step="0.01" class="w-full border rounded px-1.5 py-1 text-xs"></div>
                                </div>
                                <div v-if="loan.type === '房贷'" class="grid grid-cols-1 md:grid-cols-3 gap-2 border-t pt-2 mt-2 border-gray-200">
                                    <div><label class="text-[10px] text-blue-500">数据快照年月</label><input v-model="loan.baseDate" type="text" placeholder="2026-05" class="w-full border border-blue-200 rounded px-1.5 py-1 text-xs"></div>
                                    <div><label class="text-[10px] text-blue-500">快照真实本金</label><input v-model.number="loan.baseLeft" type="number" class="w-full border border-blue-200 rounded px-1.5 py-1 text-xs"></div>
                                    <div><label class="text-[10px] text-blue-600 font-bold">固定总月供</label><input v-model.number="loan.baseMonthly" type="number" class="w-full border border-blue-400 bg-blue-50 rounded px-1.5 py-1 text-xs text-blue-800 font-semibold"></div>
                                </div>
                                <div v-else class="grid grid-cols-2 gap-2 border-t pt-2 mt-2 border-gray-200">
                                    <div><label class="text-[10px] text-orange-500">剩余本金</label><input v-model.number="loan.left" type="number" class="w-full border border-orange-200 rounded px-1.5 py-1 text-xs"></div>
                                    <div><label class="text-[10px] text-orange-500">每月自己设定还款</label><input v-model.number="loan.monthly" type="number" class="w-full border border-orange-200 rounded px-1.5 py-1 text-xs"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                     <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <div class="flex items-center gap-4 mb-4 border-b pb-4"><div class="w-1/2"><label class="text-xs text-gray-500">主发薪卡</label><input v-model="familyData.salaryBank" type="text" class="w-full border rounded px-2 py-1 text-xs"></div><div class="w-1/2"><label class="text-xs text-gray-500">发薪日</label><input v-model.number="familyData.salaryDay" type="number" class="w-full border rounded px-2 py-1 text-xs"></div></div>
                        <div class="flex justify-between items-center mb-4"><h4 class="text-sm font-semibold text-gray-800 flex items-center"><i class="ph ph-git-branch mr-1 text-purple-500"></i> 自动转账拓扑线</h4><button @click="addTransfer" class="text-[10px] bg-gray-100 px-2 py-1 rounded">添加路线</button></div>
                        <div class="space-y-2">
                            <div v-for="(transfer, idx) in familyData.transfers" :key="idx" class="flex flex-wrap gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 relative pr-6">
                                <input v-model="transfer.from" type="text" placeholder="转出" class="w-[70px] border rounded px-1 py-1 text-xs"><i class="ph ph-arrow-right text-gray-400"></i>
                                <input v-model="transfer.to" type="text" placeholder="转入" class="w-[70px] border rounded px-1 py-1 text-xs">
                                <input v-model.number="transfer.amount" type="number" placeholder="金额" class="w-20 border rounded px-1 py-1 text-xs text-blue-600 font-medium">
                                <div class="flex items-center text-xs text-gray-500 w-16"><input v-model.number="transfer.day" type="number" placeholder="日" class="w-8 border rounded px-1 py-1 text-center mr-1">日</div>
                                <input v-model="transfer.expire" type="text" placeholder="到期日" class="w-24 border rounded px-1 py-1 text-[10px]">
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

// === Web 原图直传引擎逻辑 ===
const fileInput = ref(null)
const uploadFile = ref(null)
const uploadPreview = ref('')
const isUploading = ref(false)
const uploadMeta = ref({ desc: '', city: '', type: '日常记录' })

// 💡 修复：照片类型管理逻辑
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