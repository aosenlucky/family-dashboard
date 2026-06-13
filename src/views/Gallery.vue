<template>
    <div class="pt-28 pb-20 min-h-screen">
        <header class="px-4 text-center mb-12">
            <h1 class="text-3xl md:text-5xl font-semibold tracking-tight text-apple-text mb-4">捕捉时光的切片</h1>
        </header>
        <section class="max-w-6xl mx-auto px-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                <div v-for="(photo, idx) in familyData.photos" :key="idx" @click="openImage(photo.url)" class="photo-card glass-card p-3 rounded-2xl relative group cursor-pointer" :style="{'transform': `rotate(${idx%2===0?-1.5:1.5}deg)`}">
                    <div class="aspect-square md:aspect-[4/5] bg-gray-200/50 rounded-xl overflow-hidden relative shadow-inner border border-white/50">
                        <img :src="photo.url.includes('myhuaweicloud.com') ? photo.url + '?x-image-process=image/resize,w_800/quality,q_80' : photo.url" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    </div>
                </div>
            </div>
        </section>
    </div>
</template>

<script setup>
import { inject } from 'vue'
const familyData = inject('familyData')
const openImage = (url) => window.open(url, '_blank')
</script>