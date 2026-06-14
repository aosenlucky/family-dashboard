<template>
    <div class="pt-28 pb-20 min-h-screen">
        <!-- 头部标题 -->
        <header class="px-4 text-center mb-8">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">世界足迹与光影</h1>
            <p class="text-gray-500 text-sm md:text-base max-w-2xl mx-auto font-light leading-relaxed">
                每一张照片，都是我们在地球上留下的锚点。
            </p>
        </header>

        <!-- 模块 1：苹果风卡片式足迹地图 -->
        <section class="max-w-6xl mx-auto px-4 mb-12">
            <div class="glass-card rounded-3xl p-2 md:p-3 shadow-lg border-2 border-white/80 relative overflow-hidden">
                <div id="map" class="w-full h-[45vh] md:h-[55vh] rounded-[1.25rem] z-0"></div>
                
                <!-- 悬浮的操作按钮 -->
                <div class="absolute bottom-6 right-6 z-10 flex flex-col gap-3">
                    <button @click="focusOnPhotos" class="bg-white/90 backdrop-blur-md w-10 h-10 rounded-full shadow-md border border-gray-200 text-gray-700 hover:text-apple-blue transition-colors flex items-center justify-center">
                        <i class="ph-fill ph-crosshair text-lg"></i>
                    </button>
                </div>
            </div>
        </section>

        <!-- 模块 2：智能照片流控制台 -->
        <section class="max-w-6xl mx-auto px-4 mb-6 flex justify-between items-end">
            <div>
                <h2 class="text-xl font-semibold flex items-center text-gray-800">
                    <i class="ph-fill ph-images mr-2 text-apple-blue"></i> {{ galleryTitle }}
                </h2>
                <p class="text-xs text-gray-500 mt-1">共 {{ activePhotos.length }} 个瞬间</p>
            </div>
            
            <div class="flex space-x-2">
                <button v-if="filterMode !== 'all'" @click="showAllPhotos" class="text-[11px] font-medium bg-white/60 hover:bg-white border border-white text-gray-600 px-3 py-1.5 rounded-full shadow-sm transition-colors flex items-center">
                    <i class="ph ph-x mr-1 text-rose-500"></i> 取消筛选
                </button>
                <button v-if="unmappedPhotos.length > 0 && filterMode === 'all'" @click="showUnmapped" class="text-[11px] font-medium bg-white/60 hover:bg-white border border-white text-gray-600 px-3 py-1.5 rounded-full shadow-sm transition-colors flex items-center">
                    其他记忆 ({{ unmappedPhotos.length }})
                </button>
            </div>
        </section>

        <!-- 模块 3：照片瀑布流 (带骨架屏与优雅降级) -->
        <section class="max-w-6xl mx-auto px-4 mb-20">
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                <div v-for="(photo, idx) in activePhotos" :key="idx" @click="previewPhoto(photo)" class="photo-card glass-card p-2 md:p-3 rounded-2xl relative group cursor-pointer bg-white/50">
                    <div class="aspect-square md:aspect-[4/5] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-100/50 shadow-inner flex items-center justify-center">
                        
                        <!-- 优雅的骨架屏呼吸灯 (图片加载完前显示) -->
                        <div class="absolute inset-0 flex items-center justify-center bg-gray-100/80 animate-pulse z-0">
                            <i class="ph ph-image text-gray-300 text-3xl"></i>
                        </div>
                        
                        <!-- 图片本体：利用原生 onload/onerror 处理复杂加载状态 -->
                        <img :src="getThumbUrl(photo.url)" 
                             :data-orig="photo.url"
                             onload="this.classList.remove('opacity-0'); this.previousElementSibling.style.display='none';"
                             onerror="if(this.src!==this.dataset.orig) { this.src=this.dataset.orig; } else { this.previousElementSibling.innerHTML='<i class=\'ph ph-warning-circle text-red-300 text-3xl\'></i>'; this.previousElementSibling.classList.remove('animate-pulse'); }"
                             class="w-full h-full object-cover transition-all duration-700 opacity-0 group-hover:scale-110 relative z-10">
                    </div>
                    <p class="text-xs font-medium text-gray-600 mt-3 truncate px-1 text-center">{{ photo.desc }}</p>
                </div>
            </div>
            
            <!-- 空状态 -->
            <div v-if="activePhotos.length === 0" class="text-center py-20 text-gray-400 bg-white/40 rounded-3xl border border-dashed border-white shadow-sm mt-4">
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
import { ref, inject, onMounted, onBeforeUnmount, watch, shallowRef } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

const familyData = inject('familyData')

const mapInstance = shallowRef(null)
const markerClusterGroup = shallowRef(null)
const unmappedPhotos = ref([])
const activePhotos = ref([])
const galleryTitle = ref('所有光影记忆')
const filterMode = ref('all') // all, map, unmapped
const currentPreview = ref(null)

onMounted(() => {
    initMap();
    renderMarkers();
    showAllPhotos();
})

onBeforeUnmount(() => {
    if (mapInstance.value) { mapInstance.value.remove(); }
})

watch(() => familyData.value.photos, () => {
    renderMarkers();
    if (filterMode.value === 'all') showAllPhotos();
}, { deep: true })

// 💡 缩略图生成器
const getThumbUrl = (url) => {
    if (!url) return '';
    // 请求 800px 宽度的高清缩略图，保证展示质量
    return url.includes('myhuaweicloud.com') ? url + '?x-image-process=image/resize,w_800/quality,q_80' : url;
}

// 💡 初始化地图：使用灰白透视主题
const initMap = () => {
    mapInstance.value = L.map('map', { zoomControl: false, preferCanvas: true });
    
    // 轻度透明的 CartoDB 极简底图，与家庭空间的背景完美融合
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance.value);

    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.value);
}

// 💡 渲染聚合图标
const renderMarkers = () => {
    if (!mapInstance.value) return;
    
    if (markerClusterGroup.value) {
        mapInstance.value.removeLayer(markerClusterGroup.value);
    }
    
    markerClusterGroup.value = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            const childMarkers = cluster.getAllChildMarkers();
            const coverUrl = childMarkers[0].options.coverUrl;
            const count = cluster.getChildCount();
            
            const html = `
                <div class="relative w-12 h-12 rounded-xl border-[3px] border-white shadow-md transition-transform hover:scale-110 bg-gray-100 z-20">
                    <img src="${coverUrl}" class="w-full h-full object-cover rounded-lg">
                    <div class="absolute -top-1 -right-1 w-full h-full border-2 border-white rounded-xl shadow-sm -z-10 bg-white" style="transform: rotate(6deg);"></div>
                    <span class="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white z-30">${count}</span>
                </div>
            `;
            return L.divIcon({ html: html, className: 'custom-cluster-icon', iconSize: L.point(48, 48) });
        }
    });

    const photos = familyData.value.photos || [];
    unmappedPhotos.value = photos.filter(p => !p.location || p.location.length !== 2);
    const validPhotos = photos.filter(p => p.location && p.location.length === 2);

    const grouped = {};
    validPhotos.forEach(p => {
        const key = `${p.location[0].toFixed(3)},${p.location[1].toFixed(3)}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
    });

    for (const key in grouped) {
        const groupPhotos = grouped[key];
        const lat = groupPhotos[0].location[0];
        const lon = groupPhotos[0].location[1];
        const coverUrl = getThumbUrl(groupPhotos[0].url);

        const html = `
            <div class="relative w-10 h-10 rounded-xl border-2 border-white shadow-sm transition-transform hover:scale-110 transform rotate-[-3deg] bg-gray-100 z-10">
                <img src="${coverUrl}" class="w-full h-full object-cover rounded-lg">
                <span class="absolute -top-2 -right-2 bg-blue-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-sm border border-white z-20">${groupPhotos.length}</span>
            </div>
        `;

        const icon = L.divIcon({ html: html, className: 'custom-photo-icon', iconSize: L.point(40, 40) });
        const marker = L.marker([lat, lon], { icon: icon, coverUrl: coverUrl });
        
        // 点击地图图标时：平滑滚动到相册并筛选数据
        marker.on('click', () => { 
            activePhotos.value = groupPhotos; 
            galleryTitle.value = `定格于此的 ${groupPhotos.length} 个瞬间`;
            filterMode.value = 'map';
            scrollToGallery();
        });
        markerClusterGroup.value.addLayer(marker);
    }

    markerClusterGroup.value.on('clusterclick', function (a) {
        a.layer.zoomToBounds({padding: [30, 30]});
    });

    mapInstance.value.addLayer(markerClusterGroup.value);
    focusOnPhotos();
}

const focusOnPhotos = () => {
    if (!mapInstance.value) return;
    const validPhotos = (familyData.value.photos || []).filter(p => p.location && p.location.length === 2);
    if (validPhotos.length > 0) {
        const bounds = L.latLngBounds(validPhotos.map(p => p.location));
        mapInstance.value.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
    } else {
        mapInstance.value.setView([35.86166, 104.195397], 4);
    }
}

// 视图与交互控制
const showAllPhotos = () => {
    activePhotos.value = familyData.value.photos || [];
    galleryTitle.value = '所有光影记忆';
    filterMode.value = 'all';
}
const showUnmapped = () => {
    activePhotos.value = unmappedPhotos.value;
    galleryTitle.value = '未标记坐标的记忆';
    filterMode.value = 'unmapped';
    scrollToGallery();
}
const scrollToGallery = () => {
    window.scrollTo({ top: document.getElementById('map').offsetHeight + 150, behavior: 'smooth' });
}
const previewPhoto = (photo) => { currentPreview.value = photo; }
const downloadPhoto = (url) => {
    const a = document.createElement('a'); a.href = url; a.download = `Aosen_Family_${Date.now()}.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
</script>

<style>
/* 融合式地图样式优化 */
.leaflet-container { 
    background: transparent !important; 
    border-radius: 1.25rem;
}

.leaflet-tile-pane { 
    opacity: 0.75; 
    filter: grayscale(0.6) contrast(1.05); 
    transition: opacity 0.3s;
}

.leaflet-control-attribution {
    background: transparent !important;
    color: rgba(0,0,0,0.3) !important;
    text-shadow: 0 1px 1px rgba(255,255,255,0.6);
}
.leaflet-control-attribution a { color: rgba(0,0,0,0.5) !important; }

/* 苹果风药丸缩放按钮 */
.leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important;
    border-radius: 12px !important; 
    overflow: hidden;
    margin-bottom: 4rem !important; 
    margin-right: 1rem !important;
}
.leaflet-control-zoom a {
    background: rgba(255, 255, 255, 0.9) !important;
    backdrop-filter: blur(12px);
    color: #1d1d1f !important;
    border-bottom: 1px solid rgba(0,0,0,0.05) !important;
}
.custom-cluster-icon, .custom-photo-icon { background: transparent; border: none; }
</style>