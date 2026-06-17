<template>
    <div class="pt-24 pb-20 min-h-screen bg-transparent relative w-full overflow-hidden">
        
        <!-- 头部：Discover 标题与双轨切换器 -->
        <header class="px-6 md:px-10 max-w-6xl mx-auto flex flex-col md:flex-row md:items-end justify-between mb-8 relative z-10 gap-4">
            <div>
                <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-gray-900 drop-shadow-sm flex items-center">
                    Discover <i class="ph-duotone ph-sparkle ml-2 text-apple-blue text-2xl md:text-4xl"></i>
                </h1>
                <p class="text-gray-500 text-sm mt-2 font-light">探索我们留下的光影印记</p>
            </div>
            
            <!-- 分类模式切换 (地点 vs 类型) -->
            <div class="flex items-center bg-white/40 backdrop-blur-md p-1 rounded-full border border-white/60 shadow-sm shrink-0 w-fit">
                <button @click="viewMode = 'type'" :class="viewMode === 'type' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-800'" class="px-5 py-1.5 rounded-full text-xs transition-all flex items-center">
                    <i class="ph-fill ph-squares-four mr-1.5"></i> 按类型
                </button>
                <button @click="viewMode = 'location'" :class="viewMode === 'location' ? 'bg-white shadow-sm text-gray-800 font-medium' : 'text-gray-500 hover:text-gray-800'" class="px-5 py-1.5 rounded-full text-xs transition-all flex items-center">
                    <i class="ph-fill ph-map-pin mr-1.5"></i> 按地点
                </button>
            </div>
        </header>

        <!-- 模块 1：圆形精选集横向导航 (对标参考图顶部) -->
        <section class="w-full relative z-10 mb-10">
            <div class="w-full overflow-x-auto no-scrollbar pb-6 pt-2">
                <div class="flex px-6 md:px-10 max-w-6xl mx-auto gap-5 md:gap-8 snap-x relative z-10 w-max">
                    <div v-for="cat in dynamicCategories" :key="cat.name" 
                         class="flex flex-col items-center shrink-0 snap-start cursor-pointer group"
                         @click="activeCategoryName = cat.name">
                        
                        <!-- 圆形封面图 -->
                        <div class="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-full overflow-hidden border-[3px] transition-all duration-300 shadow-sm relative bg-gray-100"
                             :class="activeCategoryName === cat.name ? 'border-apple-blue shadow-md scale-110' : 'border-white/80 group-hover:border-white group-hover:scale-105 group-hover:shadow-md'">
                             
                             <div class="absolute inset-0 bg-gray-200 animate-pulse z-0" v-if="!cat.coverUrl"></div>
                             <img :src="getThumbUrl(cat.coverUrl)" :data-cover-index="0" class="w-full h-full object-cover relative z-10" loading="lazy" @error="useNextCategoryCover($event, cat)">
                        </div>
                        
                        <!-- 类别名称 -->
                        <span class="mt-3 text-xs md:text-sm font-medium transition-colors" 
                              :class="activeCategoryName === cat.name ? 'text-gray-900 font-semibold' : 'text-gray-500 group-hover:text-gray-800'">
                            {{ cat.name }}
                        </span>
                        <!-- 数量提示 -->
                        <span class="text-[9px] text-gray-400 mt-0.5">{{ cat.photos.length }} 张</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- 模块 2：原生的不规则瀑布流 (Masonry) 照片墙 -->
        <section class="max-w-6xl mx-auto px-4 md:px-10 relative z-10">
            <transition name="fade" mode="out-in">
                <!-- 核心：使用 CSS Columns 实现真正的瀑布流 -->
                <div :key="activeCategoryName" class="columns-2 md:columns-3 lg:columns-4 gap-4 md:gap-6 space-y-4 md:space-y-6">
                    
                    <div v-for="(photo, idx) in activePhotos" :key="idx" 
                         @click="previewPhoto(photo)" 
                         class="break-inside-avoid photo-card relative group cursor-pointer rounded-2xl overflow-hidden bg-gray-100 shadow-sm border border-black/5">
                        
                        <!-- 微光加载骨架 -->
                        <div class="absolute inset-0 bg-gradient-to-tr from-gray-100 via-gray-50 to-gray-100 animate-pulse z-0"></div>
                        
                        <!-- 图片本体：去掉了固定比例，高度由图片原始比例决定，形成高低错落感 -->
                        <img :src="getThumbUrl(photo.url)" 
                             :data-orig="photo.url"
                             onload="this.classList.remove('opacity-0');"
                             @error="handlePhotoError($event, photo)"
                             class="w-full h-auto object-cover opacity-0 transition-opacity duration-700 relative z-10 block" loading="lazy">
                        
                        <!-- 悬浮信息蒙层 (优雅的暗色渐变底) -->
                        <div class="absolute inset-x-0 bottom-0 p-4 pt-12 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20 flex flex-col justify-end">
                            <p class="text-white text-xs md:text-sm font-medium line-clamp-2 drop-shadow-sm">{{ photo.desc || '美好瞬间' }}</p>
                            <div class="flex items-center mt-1.5 space-x-2">
                                <span v-if="photo.tempCity || photo.city" class="text-[9px] text-white/80 bg-white/20 px-2 py-0.5 rounded backdrop-blur-md flex items-center"><i class="ph-fill ph-map-pin mr-1"></i>{{ photo.tempCity || photo.city }}</span>
                                <span v-if="photo.type" class="text-[9px] text-white/80 bg-white/20 px-2 py-0.5 rounded backdrop-blur-md">{{ photo.type }}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </transition>
            
            <div v-if="activePhotos.length === 0" class="text-center py-20 text-gray-500 bg-white/20 backdrop-blur-md rounded-3xl border border-dashed border-white/60 mt-4">
                <i class="ph-duotone ph-images text-4xl text-gray-400 mb-3"></i>
                <p class="text-sm font-medium">这个分类下还没有照片哦</p>
            </div>
        </section>

        <!-- ================= 全屏沉浸预览大图 ================= -->
        <transition name="fade">
            <div v-if="currentPreview" class="fixed inset-0 z-[100] bg-black/95 flex flex-col backdrop-blur-md">
                <div class="flex justify-between items-center p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent">
                    <p class="text-white/90 text-sm font-medium drop-shadow-md"><i class="ph-fill ph-info mr-1"></i> {{ currentPreview.desc || '照片预览' }}</p>
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
import { ref, inject, computed, watch } from 'vue'

const familyData = inject('familyData')
const viewMode = ref('type') // 'type' (按类型) 或 'location' (按地点)
const activeCategoryName = ref('')
const currentPreview = ref(null)
const failedPhotoUrls = ref(new Set())

const isTemplatePhotoUrl = (url = '') => /images\.unsplash\.com|source\.unsplash\.com|picsum\.photos/i.test(url)

const galleryPhotos = computed(() => (familyData.value.photos || []).filter(photo => {
    return photo.url && !isTemplatePhotoUrl(photo.url) && !failedPhotoUrls.value.has(photo.url)
}))

// 💡 核心：动态生成双轨分类数据
const dynamicCategories = computed(() => {
    const groups = {};
    const photos = galleryPhotos.value;

    photos.forEach(p => {
        let key = '未分类';
        
        if (viewMode.value === 'location') {
            // 按地点模式
            key = p.tempCity || p.city;
            if (!key) {
                const commonCities = ['上海', '北京', '广州', '深圳', '成都', '重庆', '杭州', '三亚', '西安', '巴黎', '伦敦', '东京', '丹东', '沈阳'];
                const found = commonCities.find(c => p.desc && p.desc.includes(c));
                key = found || '温馨家园';
            }
        } else {
            // 按类型模式
            key = p.type || '日常记录';
        }
        
        if (!groups[key]) {
            groups[key] = { name: key, photos: [], coverUrl: '' };
        }
        groups[key].photos.push(p);
    });

    const resultList = Object.values(groups).sort((a, b) => {
        if (a.name === '温馨家园' || a.name === '未分类') return 1;
        if (b.name === '温馨家园' || b.name === '未分类') return -1;
        return b.photos.length - a.photos.length;
    });

    // 提取每个分类下第一张图作为封面
    resultList.forEach(g => {
        if (g.photos.length > 0) g.coverUrl = g.photos[0].url;
    });

    return resultList;
});

// 当前选中分类的照片流
const activePhotos = computed(() => {
    const group = dynamicCategories.value.find(g => g.name === activeCategoryName.value);
    return group ? group.photos : [];
});

// 当切换模式或数据更新时，自动选中第一个分类
watch([dynamicCategories, viewMode], () => {
    if (dynamicCategories.value.length > 0) {
        // 如果当前选中的分类在新的列表中不存在，才重置到第一个
        const exists = dynamicCategories.value.find(g => g.name === activeCategoryName.value);
        if (!exists) {
            activeCategoryName.value = dynamicCategories.value[0].name;
        }
    }
}, { immediate: true })

const getThumbUrl = (url) => {
    if (!url) return '';
    return url.includes('myhuaweicloud.com') ? url + '?x-image-process=image/resize,w_800/quality,q_80' : url;
}

const markPhotoFailed = (url) => {
    const next = new Set(failedPhotoUrls.value)
    next.add(url)
    failedPhotoUrls.value = next
}

const handlePhotoError = (event, photo) => {
    const img = event.currentTarget
    const originalUrl = img.dataset.orig
    if (originalUrl && !img.dataset.triedOriginal && img.src !== originalUrl) {
        img.dataset.triedOriginal = '1'
        img.src = originalUrl
        return
    }

    markPhotoFailed(photo.url)
}

const useNextCategoryCover = (event, category) => {
    const img = event.currentTarget
    const currentIndex = Number(img.dataset.coverIndex || 0)
    const currentPhoto = category.photos[currentIndex]

    if (currentPhoto?.url && !img.dataset.triedOriginal) {
        img.dataset.triedOriginal = '1'
        img.src = currentPhoto.url
        return
    }

    const nextIndex = category.photos.findIndex((photo, index) => index > currentIndex && photo.url && !failedPhotoUrls.value.has(photo.url))
    if (nextIndex >= 0) {
        img.dataset.coverIndex = String(nextIndex)
        img.dataset.triedOriginal = ''
        img.src = getThumbUrl(category.photos[nextIndex].url)
        return
    }

    if (currentPhoto?.url) markPhotoFailed(currentPhoto.url)
    img.classList.add('opacity-0')
}

const previewPhoto = (photo) => { currentPreview.value = photo; }
const downloadPhoto = (url) => {
    const a = document.createElement('a'); a.href = url; a.download = `Aosen_Family_${Date.now()}.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
</script>
