<template>
    <div class="min-h-screen relative bg-[#f5f5f7]">
        <!-- 头部标题悬浮 -->
        <header class="absolute top-20 left-0 right-0 z-10 px-4 text-center pointer-events-none">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-gray-800 mb-2 drop-shadow-md">我们的世界足迹</h1>
            <p class="text-gray-600 text-sm md:text-base max-w-2xl mx-auto font-medium drop-shadow bg-white/60 inline-block px-4 py-1 rounded-full backdrop-blur-md border border-white/50 shadow-sm">
                每一张照片，都是我们在地球上留下的锚点。
            </p>
        </header>
        
        <!-- 地图容器 -->
        <div id="map" class="w-full h-screen z-0"></div>

        <!-- 悬浮控制面板 (未分类/本地照片入口) -->
        <div class="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex space-x-4">
            <button @click="openDrawer(unmappedPhotos, '未记录坐标的记忆')" class="bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-lg border border-gray-200 text-sm font-medium text-gray-700 hover:text-apple-blue transition-colors flex items-center">
                <i class="ph-fill ph-images mr-2 text-apple-blue"></i> 其他记忆 ({{ unmappedPhotos.length }})
            </button>
            <button @click="focusOnPhotos" class="bg-white/90 backdrop-blur-md w-12 h-12 rounded-full shadow-lg border border-gray-200 text-gray-700 hover:text-apple-blue transition-colors flex items-center justify-center">
                <i class="ph-fill ph-crosshair text-xl"></i>
            </button>
        </div>

        <!-- ================= 底部抽屉 (Drawer) ================= -->
        <div class="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl rounded-t-[2.5rem] shadow-[0_-15px_50px_rgba(0,0,0,0.15)] z-[60] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] border-t border-white" 
             :class="showDrawer ? 'translate-y-0' : 'translate-y-full'" 
             style="height: 75vh;">
            
            <div class="sticky top-0 bg-white/90 backdrop-blur-md rounded-t-[2.5rem] z-10 px-6 pt-4 pb-4 border-b border-gray-100">
                <div class="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4 cursor-pointer" @click="closeDrawer"></div>
                <div class="flex justify-between items-center">
                    <h3 class="text-xl font-bold text-gray-800 flex items-center"><i class="ph-fill ph-map-pin mr-2 text-rose-500"></i> {{ drawerTitle }}</h3>
                    <button @click="closeDrawer" class="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition"><i class="ph ph-x"></i></button>
                </div>
            </div>

            <div class="p-6 overflow-y-auto" style="height: calc(100% - 90px);">
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
                    <div v-for="(photo, idx) in activePhotos" :key="idx" @click="previewPhoto(photo)" class="photo-card glass-card p-2 rounded-2xl relative group cursor-pointer bg-white">
                        <div class="aspect-square bg-gray-100 rounded-xl overflow-hidden relative border border-gray-100">
                            <img :src="photo.url.includes('myhuaweicloud.com') ? photo.url + '?x-image-process=image/resize,w_600/quality,q_80' : photo.url" 
                                 class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy">
                        </div>
                        <p class="text-xs font-medium text-gray-600 mt-2 truncate px-1">{{ photo.desc }}</p>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="showDrawer" @click="closeDrawer" class="fixed inset-0 bg-black/20 backdrop-blur-sm z-[50] transition-opacity"></div>

        <!-- ================= 全屏预览 ================= -->
        <transition name="fade">
            <div v-if="currentPreview" class="fixed inset-0 z-[100] bg-black/95 flex flex-col">
                <div class="flex justify-between items-center p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-black/60 to-transparent">
                    <p class="text-white/80 text-sm"><i class="ph ph-info mr-1"></i> {{ currentPreview.desc }}</p>
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
const drawerTitle = ref('')
const showDrawer = ref(false)
const currentPreview = ref(null)

onMounted(() => {
    initMap();
    renderMarkers();
})

onBeforeUnmount(() => {
    if (mapInstance.value) { mapInstance.value.remove(); }
})

watch(() => familyData.value.photos, () => {
    renderMarkers();
}, { deep: true })

const initMap = () => {
    mapInstance.value = L.map('map', { zoomControl: false, preferCanvas: true });
    
    // 💡 性能优化：使用 CartoDB 极简底图，舍弃耗费 GPU 的 filter，保障手机端流畅滑动
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(mapInstance.value);

    // 将缩放按钮移到右下角
    L.control.zoom({ position: 'bottomright' }).addTo(mapInstance.value);
}

const renderMarkers = () => {
    if (!mapInstance.value) return;
    
    if (markerClusterGroup.value) {
        mapInstance.value.removeLayer(markerClusterGroup.value);
    }
    
    markerClusterGroup.value = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: false,
        maxClusterRadius: 50, // 降低聚合半径，提升性能
        iconCreateFunction: function(cluster) {
            const childMarkers = cluster.getAllChildMarkers();
            const coverUrl = childMarkers[0].options.coverUrl;
            const count = cluster.getChildCount();
            
            const html = `
                <div class="relative w-14 h-14 rounded-xl border-[3px] border-white shadow-xl bg-cover bg-center transition-transform hover:scale-110" style="background-image: url('${coverUrl}')">
                    <div class="absolute -top-1 -right-1 w-full h-full border-2 border-white rounded-xl shadow-sm -z-10 bg-white" style="transform: rotate(6deg);"></div>
                    <span class="absolute -top-3 -right-3 bg-rose-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-md border-2 border-white">${count}</span>
                </div>
            `;
            return L.divIcon({ html: html, className: 'custom-cluster-icon', iconSize: L.point(56, 56) });
        }
    });

    const photos = familyData.value.photos || [];
    unmappedPhotos.value = photos.filter(p => !p.location || p.location.length !== 2);
    const validPhotos = photos.filter(p => p.location && p.location.length === 2);

    const grouped = {};
    validPhotos.forEach(p => {
        // 将极小范围内的照片分在同一组
        const key = `${p.location[0].toFixed(3)},${p.location[1].toFixed(3)}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(p);
    });

    for (const key in grouped) {
        const groupPhotos = grouped[key];
        const lat = groupPhotos[0].location[0];
        const lon = groupPhotos[0].location[1];
        
        let coverUrl = groupPhotos[0].url;
        if (coverUrl.includes('myhuaweicloud.com')) { coverUrl += '?x-image-process=image/resize,w_200/quality,q_60'; }

        const html = `
            <div class="relative w-12 h-12 rounded-xl border-[3px] border-white shadow-md bg-cover bg-center transition-transform hover:scale-110 transform rotate-[-3deg]" style="background-image: url('${coverUrl}')">
                <span class="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">${groupPhotos.length}</span>
            </div>
        `;

        const icon = L.divIcon({ html: html, className: 'custom-photo-icon', iconSize: L.point(48, 48) });
        const marker = L.marker([lat, lon], { icon: icon, coverUrl: coverUrl });
        
        marker.on('click', () => { openDrawer(groupPhotos, `在这附近的 ${groupPhotos.length} 个瞬间`); });
        markerClusterGroup.value.addLayer(marker);
    }

    markerClusterGroup.value.on('clusterclick', function (a) {
        a.layer.zoomToBounds({padding: [30, 30]});
    });

    mapInstance.value.addLayer(markerClusterGroup.value);
    
    // 💡 视觉重点优化：地图加载后自动聚焦到有照片的区域
    focusOnPhotos();
}

const focusOnPhotos = () => {
    if (!mapInstance.value) return;
    const validPhotos = (familyData.value.photos || []).filter(p => p.location && p.location.length === 2);
    
    if (validPhotos.length > 0) {
        const bounds = L.latLngBounds(validPhotos.map(p => p.location));
        mapInstance.value.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 });
    } else {
        // 默认视角设为中国区域
        mapInstance.value.setView([35.86166, 104.195397], 4);
    }
}

const openDrawer = (photos, title) => { if (photos.length === 0) return; activePhotos.value = photos; drawerTitle.value = title; showDrawer.value = true; }
const closeDrawer = () => { showDrawer.value = false; }
const previewPhoto = (photo) => { currentPreview.value = photo; }
const downloadPhoto = (url) => {
    const a = document.createElement('a'); a.href = url; a.download = `Aosen_Family_${Date.now()}.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
</script>

<style>
/* 地图微调：轻度不透明，让底色透出，提升质感且不损耗手机 GPU */
.leaflet-tile-pane { opacity: 0.9; }

/* 隐藏地图来源背景块 */
.leaflet-control-attribution {
    background: transparent !important;
    color: rgba(0,0,0,0.4) !important;
}

/* 🍎 苹果风药丸缩放按钮 */
.leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.08) !important;
    border-radius: 16px !important; 
    overflow: hidden;
    margin-bottom: 6rem !important; 
    margin-right: 1.5rem !important;
}
.leaflet-control-zoom a {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #1d1d1f !important;
    border-bottom: 1px solid rgba(0,0,0,0.05) !important;
}
.custom-cluster-icon, .custom-photo-icon { background: transparent; border: none; }
</style>