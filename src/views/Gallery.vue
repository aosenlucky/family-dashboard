<template>
    <!-- 强制背景透明，配合根节点的背景图 -->
    <div class="pt-28 pb-20 min-h-screen bg-transparent relative">
        <!-- 头部标题 -->
        <header class="px-4 text-center mb-6 relative z-10">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">岁月挂绳上的光影</h1>
            <p class="text-gray-500 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">
                听，风吹过的时候，记忆在轻轻作响。
            </p>
        </header>

        <!-- 模块 1：精致经幡与铃铛 (横向自动分布挂绳) -->
        <section class="relative w-full mb-12 z-10">
            <!-- 贯穿全屏的极细高光金属线 -->
            <div class="absolute top-[3.5rem] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-gray-400/40 to-transparent shadow-sm z-0"></div>
            
            <!-- 容器：自动居中分布，超出时横向滚动 -->
            <div class="w-full overflow-x-auto no-scrollbar pb-8 pt-4">
                <div class="flex min-w-full w-fit justify-start md:justify-center px-8 gap-8 md:gap-14 relative z-10 snap-x mx-auto">
                    
                    <div v-for="(group, idx) in groupedPhotos" :key="group.name" 
                         class="flex flex-col items-center shrink-0 snap-center relative group cursor-pointer"
                         @click="selectGroup(group)">
                        
                        <!-- 质感金属夹子 -->
                        <div class="w-2 h-5 bg-gradient-to-b from-gray-300 to-gray-400 rounded-full mb-1 z-20 shadow-sm border border-white/60"></div>
                        
                        <!-- 旗子 (Apple风格玻璃药丸) -->
                        <div class="backdrop-blur-xl px-5 py-2.5 rounded-full shadow-sm border flex items-center space-x-2 transition-all duration-500 z-20"
                             :class="activeGroupName === group.name ? 'bg-white/90 border-white text-gray-800 shadow-[0_8px_20px_rgba(0,0,0,0.08)] scale-110' : 'bg-white/30 border-white/40 text-gray-600 hover:bg-white/60 hover:scale-105'">
                            <i :class="['ph-fill', group.icon, activeGroupName === group.name ? 'text-apple-blue' : 'text-gray-400', 'text-lg transition-colors']"></i>
                            <span class="text-sm font-semibold whitespace-nowrap tracking-wide">{{ group.name }}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors" :class="activeGroupName === group.name ? 'bg-blue-50 text-apple-blue' : 'bg-white/40 text-gray-500'">{{ group.photos.length }}</span>
                        </div>

                        <!-- 挂铃铛的隐约丝线 -->
                        <div class="w-[1px] h-6 bg-gradient-to-b from-gray-400/50 to-transparent z-10"></div>

                        <!-- 铃铛 (浓缩的照片头像) -->
                        <div class="flex flex-col -space-y-3 z-20 transition-transform duration-500 group-hover:-translate-y-1">
                            <div v-for="(photo, pIdx) in group.photos.slice(0, 3)" :key="pIdx" 
                                 class="w-9 h-9 rounded-full border-2 border-white shadow-sm overflow-hidden bg-gray-100 relative"
                                 :style="{ zIndex: 10 - pIdx }">
                                <img :src="getThumbUrl(photo.url)" class="w-full h-full object-cover">
                            </div>
                            <div v-if="group.photos.length > 3" class="w-5 h-5 rounded-full border-2 border-white shadow-sm bg-white/90 backdrop-blur-sm flex items-center justify-center text-[8px] font-bold text-gray-500 mx-auto" style="z-index: 0;">
                                +{{ group.photos.length - 3 }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div v-if="groupedPhotos.length > 4" class="md:hidden text-center mt-[-10px] opacity-50 relative z-10 pointer-events-none">
                <span class="text-[10px] bg-white/40 backdrop-blur-md px-3 py-1 rounded-full"><i class="ph ph-arrows-left-right align-middle"></i> 左右滑动查看</span>
            </div>
        </section>

        <!-- 模块 2：照片瀑布流 -->
        <section class="max-w-6xl mx-auto px-4 mb-20 relative z-10">
            <div class="flex items-center justify-between mb-6 border-b border-gray-200/40 pb-3" v-if="activeGroup">
                <h2 class="text-xl font-semibold flex items-center text-gray-800">
                    <i :class="['ph-fill', activeGroup.icon, 'text-2xl mr-2 text-apple-blue']"></i> {{ activeGroup.name }} 的记忆
                </h2>
                <span class="text-xs bg-white/40 backdrop-blur-md px-3 py-1 rounded-full text-gray-600 shadow-sm border border-white/50">
                    共 {{ activeGroup.photos.length }} 幕光影
                </span>
            </div>

            <transition name="fade" mode="out-in">
                <div :key="activeGroupName" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                    <div v-for="(photo, idx) in activeGroup?.photos" :key="idx" 
                         @click="previewPhoto(photo)" 
                         class="photo-card glass-card p-2 md:p-3 rounded-2xl relative group cursor-pointer bg-white/30 hover:bg-white/60 transition-colors duration-300">
                        <div class="aspect-square md:aspect-[4/5] bg-gray-100/50 rounded-xl overflow-hidden relative border border-gray-100/50 shadow-inner flex items-center justify-center">
                            
                            <!-- 💡 修复：丝滑微光骨架屏，去掉了丑陋的加载icon -->
                            <div class="absolute inset-0 bg-gradient-to-br from-white/20 via-gray-100/60 to-white/20 animate-pulse z-0 backdrop-blur-sm"></div>
                            
                            <!-- 图片本体 -->
                            <img :src="getThumbUrl(photo.url)" 
                                 :data-orig="photo.url"
                                 onload="this.classList.remove('opacity-0'); this.previousElementSibling.style.display='none';"
                                 onerror="if(this.src!==this.dataset.orig) { this.src=this.dataset.orig; } else { this.previousElementSibling.innerHTML='<div class=\'flex items-center justify-center h-full\'><i class=\'ph ph-image-broken text-gray-300 text-3xl\'></i></div>'; this.previousElementSibling.classList.remove('animate-pulse'); }"
                                 class="w-full h-full object-cover transition-transform duration-700 opacity-0 group-hover:scale-110 relative z-10">
                        </div>
                        <p class="text-xs font-medium text-gray-600 mt-3 truncate px-1 text-center">{{ photo.desc || '美好瞬间' }}</p>
                    </div>
                </div>
            </transition>
            
            <div v-if="!activeGroup || activeGroup.photos.length === 0" class="text-center py-20 text-gray-500 bg-white/30 backdrop-blur-md rounded-3xl border border-dashed border-white/60 shadow-sm mt-4">
                <i class="ph-fill ph-camera text-4xl mb-3 text-gray-400"></i>
                <p class="text-sm font-medium">还没有留下这里的脚印</p>
            </div>
        </section>

        <!-- ================= 全屏沉浸预览大图 ================= -->
        <transition name="fade">
            <div v-if="currentPreview" class="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md">
                <div class="flex justify-between items-center p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-black/70 to-transparent">
                    <p class="text-white/90 text-sm font-medium"><i class="ph ph-info mr-1"></i> {{ currentPreview.desc || '照片预览' }}</p>
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

// 💡 图标引擎：全量采用符合苹果风格的 Phosphor 极简图标
const getCityIcon = (cityName) => {
    if (!cityName) return 'ph-map-pin';
    if (cityName.includes('家')) return 'ph-house-line';
    if (cityName.includes('上海') || cityName.includes('北京') || cityName.includes('广州') || cityName.includes('深圳')) return 'ph-buildings';
    if (cityName.includes('三亚') || cityName.includes('海')) return 'ph-sun';
    if (cityName.includes('成都') || cityName.includes('重庆') || cityName.includes('西安')) return 'ph-bowl-food';
    if (cityName.includes('巴黎') || cityName.includes('伦敦') || cityName.includes('东京')) return 'ph-airplane-tilt';
    return 'ph-map-pin';
}

// 💡 分类引擎：优先提取上海、北京等核心城市
const groupedPhotos = computed(() => {
    const groups = {};
    const photos = familyData.value.photos || [];

    photos.forEach(p => {
        let city = p.tempCity || p.city;
        if (!city) {
            // 确保上海、北京等核心词汇在描述中能被100%精准识别
            const commonCities = ['上海', '北京', '广州', '深圳', '成都', '重庆', '杭州', '三亚', '西安', '巴黎', '伦敦', '东京'];
            const found = commonCities.find(c => p.desc && p.desc.includes(c));
            city = found || '温馨家园';
        }
        
        if (!groups[city]) {
            groups[city] = { name: city, photos: [], icon: getCityIcon(city) };
        }
        groups[city].photos.push(p);
    });

    return Object.values(groups).sort((a, b) => {
        if (a.name === '温馨家园') return 1;
        if (b.name === '温馨家园') return -1;
        return b.photos.length - a.photos.length;
    });
});

const activeGroup = computed(() => {
    return groupedPhotos.value.find(g => g.name === activeGroupName.value) || groupedPhotos.value[0];
});

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