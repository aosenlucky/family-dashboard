<template>
    <div class="pt-28 pb-20 min-h-screen bg-transparent">
        <!-- 头部标题 -->
        <header class="px-4 text-center mb-6 relative z-10">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">岁月挂绳上的光影</h1>
            <p class="text-gray-500 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">
                听，风吹过的时候，记忆在轻轻作响。
            </p>
        </header>

        <!-- 模块 1：经幡与铃铛 (横向滚动挂绳) -->
        <section class="relative w-full mb-8 z-10">
            <!-- 贯穿全屏的挂绳 (细线) -->
            <div class="absolute top-[3.25rem] left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-gray-300/60 to-transparent z-0"></div>
            
            <div class="flex overflow-x-auto no-scrollbar px-6 md:px-12 py-4 gap-8 md:gap-12 relative z-10 snap-x">
                <div v-for="(group, idx) in groupedPhotos" :key="group.name" 
                     class="flex flex-col items-center shrink-0 snap-center relative group cursor-pointer"
                     @click="selectGroup(group)">
                    
                    <!-- 夹子/连接点 -->
                    <div class="w-2 h-4 bg-gray-300/80 rounded-sm mb-1 z-20 shadow-sm border border-white/50"></div>
                    
                    <!-- 旗子 (城市标签) -->
                    <div class="glass-card px-4 py-2 rounded-2xl shadow-sm border flex items-center space-x-2 transition-all duration-300 z-20"
                         :class="activeGroupName === group.name ? 'bg-apple-blue text-white border-blue-400 shadow-blue-500/30 shadow-lg scale-105' : 'bg-white/80 border-white text-gray-700 hover:bg-white group-hover:scale-105'">
                        <span class="text-lg">{{ group.icon }}</span>
                        <span class="text-sm font-medium whitespace-nowrap">{{ group.name }}</span>
                        <span class="text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full" :class="activeGroupName === group.name ? 'text-white' : 'text-gray-400'">{{ group.photos.length }}</span>
                    </div>

                    <!-- 挂铃铛的细线 -->
                    <div class="w-[1.5px] h-6 bg-gradient-to-b from-gray-300 to-gray-200/50 z-10"></div>

                    <!-- 铃铛 (浓缩的照片头像) -->
                    <div class="flex flex-col -space-y-3 z-20 transition-transform duration-500 group-hover:-translate-y-1">
                        <!-- 最多展示3个铃铛 -->
                        <div v-for="(photo, pIdx) in group.photos.slice(0, 3)" :key="pIdx" 
                             class="w-10 h-10 rounded-full border-2 border-white shadow-md overflow-hidden bg-gray-100 relative"
                             :style="{ zIndex: 10 - pIdx }">
                            <img :src="getThumbUrl(photo.url)" class="w-full h-full object-cover">
                        </div>
                        <!-- 如果超过3张，显示一个更多的小铃铛 -->
                        <div v-if="group.photos.length > 3" class="w-6 h-6 rounded-full border-2 border-white shadow-sm bg-white/90 backdrop-blur-sm flex items-center justify-center text-[8px] font-bold text-gray-500 mx-auto" style="z-index: 0;">
                            +{{ group.photos.length - 3 }}
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 滑动提示 (仅在移动端显示) -->
            <div v-if="groupedPhotos.length > 3" class="md:hidden text-center mt-2 opacity-50">
                <span class="text-[10px] bg-white/50 px-2 py-1 rounded-full"><i class="ph ph-arrows-left-right align-middle"></i> 滑动查看更多地点</span>
            </div>
        </section>

        <!-- 模块 2：照片瀑布流 -->
        <section class="max-w-6xl mx-auto px-4 mb-20 relative z-10">
            <!-- 优雅的标题区 -->
            <div class="flex items-center justify-between mb-6 border-b border-gray-200/50 pb-3" v-if="activeGroup">
                <h2 class="text-xl font-semibold flex items-center text-gray-800">
                    <span class="text-2xl mr-2">{{ activeGroup.icon }}</span> {{ activeGroup.name }} 的记忆
                </h2>
                <span class="text-xs bg-white/60 px-3 py-1 rounded-full text-gray-500 shadow-sm border border-white">
                    共 {{ activeGroup.photos.length }} 幕光影
                </span>
            </div>

            <!-- 照片网格 -->
            <transition name="fade" mode="out-in">
                <div :key="activeGroupName" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    <div v-for="(photo, idx) in activeGroup?.photos" :key="idx" 
                         @click="previewPhoto(photo)" 
                         class="photo-card glass-card p-2 md:p-3 rounded-2xl relative group cursor-pointer bg-white/50 hover:bg-white transition-colors duration-300">
                        <div class="aspect-square md:aspect-[4/5] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-100/50 shadow-inner flex items-center justify-center">
                            
                            <!-- 骨架屏呼吸灯 -->
                            <div class="absolute inset-0 flex items-center justify-center bg-gray-100/80 animate-pulse z-0">
                                <i class="ph ph-image text-gray-300 text-3xl"></i>
                            </div>
                            
                            <!-- 图片本体 -->
                            <img :src="getThumbUrl(photo.url)" 
                                 :data-orig="photo.url"
                                 onload="this.classList.remove('opacity-0'); this.previousElementSibling.style.display='none';"
                                 onerror="if(this.src!==this.dataset.orig) { this.src=this.dataset.orig; } else { this.previousElementSibling.innerHTML='<i class=\'ph ph-warning-circle text-red-300 text-3xl\'></i>'; this.previousElementSibling.classList.remove('animate-pulse'); }"
                                 class="w-full h-full object-cover transition-transform duration-700 opacity-0 group-hover:scale-110 relative z-10">
                        </div>
                        <p class="text-xs font-medium text-gray-600 mt-3 truncate px-1 text-center">{{ photo.desc }}</p>
                    </div>
                </div>
            </transition>
            
            <!-- 空状态 -->
            <div v-if="!activeGroup || activeGroup.photos.length === 0" class="text-center py-20 text-gray-400 bg-white/40 rounded-3xl border border-dashed border-white shadow-sm mt-4">
                <i class="ph-fill ph-camera text-4xl mb-3 text-gray-300"></i>
                <p class="text-sm">没有找到照片记录</p>
            </div>
        </section>

        <!-- ================= 全屏沉浸预览大图 ================= -->
        <transition name="fade">
            <div v-if="currentPreview" class="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md">
                <div class="flex justify-between items-center p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-black/70 to-transparent">
                    <p class="text-white/90 text-sm font-medium"><i class="ph ph-info mr-1"></i> {{ currentPreview.desc }}</p>
                    <div class="flex space-x-4">
                        <button @click="downloadPhoto(currentPreview.url)" class="text-white hover:text-blue-400 flex items-center text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-md border border-white/20 transition"><i class="ph ph-download-simple mr-1"></i> 原图</button>
                        <button @click="currentPreview = null" class="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 backdrop-blur-md transition"><i class="ph ph-x text-xl"></i></button>
                    </div>
                </div>
                <div class="flex-1 flex items-center justify-center p-4">
                    <img :src="currentPreview.url" class="max-w-full max-h-full object-contain rounded-lg shadow-2xl">
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref, inject, computed, watch, onMounted } from 'vue'

const familyData = inject('familyData')

const activeGroupName = ref('')
const currentPreview = ref(null)

// 💡 智能城市与图标推断引擎
const getCityIcon = (cityName) => {
    const iconMap = {
        '北京': '🏛️', '上海': '🏙️', '广州': '🗼', '深圳': '🚀', '三亚': '🏖️', '成都': '🐼', 
        '重庆': '🌶️', '杭州': '🛶', '西安': '🍲', '巴黎': '🗼', '伦敦': '🎡', '东京': '🌸',
        '未分类': '✨', '温馨家园': '🏡'
    };
    for (let key in iconMap) {
        if (cityName.includes(key)) return iconMap[key];
    }
    return '📍'; // 默认图标
}

// 💡 核心：自动将照片聚类成“经幡”组
const groupedPhotos = computed(() => {
    const groups = {};
    const photos = familyData.value.photos || [];

    photos.forEach(p => {
        // 优先使用 ConfigPanel 填写的城市，如果没有，尝试从描述中智能提取常见城市名
        let city = p.tempCity || p.city;
        if (!city) {
            const commonCities = ['北京', '上海', '广州', '深圳', '成都', '重庆', '杭州', '三亚', '西安', '巴黎', '伦敦', '东京'];
            const found = commonCities.find(c => p.desc && p.desc.includes(c));
            city = found || '温馨家园'; // 兜底分类
        }
        
        if (!groups[city]) {
            groups[city] = { name: city, photos: [], icon: getCityIcon(city) };
        }
        groups[city].photos.push(p);
    });

    // 转换为数组并排序（让“温馨家园”等兜底分类排在最后）
    return Object.values(groups).sort((a, b) => {
        if (a.name === '温馨家园') return 1;
        if (b.name === '温馨家园') return -1;
        return b.photos.length - a.photos.length;
    });
});

// 当前选中的组对象
const activeGroup = computed(() => {
    return groupedPhotos.value.find(g => g.name === activeGroupName.value) || groupedPhotos.value[0];
});

// 监听数据加载，默认选中第一个旗子
watch(groupedPhotos, (newVal) => {
    if (newVal.length > 0 && !activeGroupName.value) {
        activeGroupName.value = newVal[0].name;
    }
}, { immediate: true })

onMounted(() => {
    if (groupedPhotos.value.length > 0) {
        activeGroupName.value = groupedPhotos.value[0].name;
    }
});

const selectGroup = (group) => {
    activeGroupName.value = group.name;
}

// 缩略图生成器 (保持原有的优雅降级逻辑)
const getThumbUrl = (url) => {
    if (!url) return '';
    return url.includes('myhuaweicloud.com') ? url + '?x-image-process=image/resize,w_800/quality,q_80' : url;
}

const previewPhoto = (photo) => { currentPreview.value = photo; }
const downloadPhoto = (url) => {
    const a = document.createElement('a'); a.href = url; a.download = `Aosen_Family_${Date.now()}.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
</script>

<style scoped>
/* 隐藏横向滚动条，保持界面整洁 */
.no-scrollbar::-webkit-scrollbar {
    display: none;
}
.no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
</style>