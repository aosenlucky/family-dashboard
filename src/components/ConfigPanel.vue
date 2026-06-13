<template>
    <div class="fixed inset-0 z-[300] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative z-10 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                <h3 class="text-lg font-semibold flex items-center"><i class="ph ph-gear-six mr-2"></i> 配置台</h3>
                <button @click="$emit('close')" class="text-gray-400 hover:text-gray-800"><i class="ph ph-x text-xl"></i></button>
            </div>
            <div class="flex overflow-x-auto no-scrollbar border-b border-gray-200 px-6 bg-gray-50/50 shrink-0">
                <button @click="configTab = 'assets'" :class="configTab === 'assets' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500'" class="px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap shrink-0">资产与股市</button>
                <button @click="configTab = 'life'" :class="configTab === 'life' ? 'border-apple-blue text-apple-blue' : 'border-transparent text-gray-500'" class="px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap shrink-0">心愿与相册</button>
            </div>
            <div class="flex-1 overflow-y-auto modal-scroll p-4 md:p-6 bg-gray-50 relative">
                <!-- 资产模块 -->
                <div v-if="configTab === 'assets'" class="space-y-6">
                    <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                        <h4 class="text-sm font-semibold text-gray-800 flex items-center mb-4">固定资产</h4>
                        <button @click="addRegularAsset" class="text-[10px] bg-gray-100 px-2 py-1 rounded mb-4">加资产</button>
                        <div v-for="(asset, idx) in familyData.assets" :key="idx" class="flex gap-2 mb-2">
                            <input v-model="asset.name" placeholder="名称" class="border rounded px-2 py-1 text-xs">
                            <input v-model.number="asset.value" type="number" class="border rounded px-2 py-1 text-xs text-green-600">
                            <button @click="familyData.assets.splice(idx, 1)" class="text-red-500"><i class="ph ph-x"></i></button>
                        </div>
                    </div>
                </div>
                <!-- 其它模块可以通过复制原有的 HTML 输入框补充完整 -->
            </div>
            <div class="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-white shrink-0">
                <button @click="logout" class="text-sm text-red-500">锁定家门</button>
                <div class="space-x-3">
                    <button @click="$emit('close')" class="px-4 py-2 text-sm text-gray-600">取消</button>
                    <button @click="saveAndClose" class="px-6 py-2 text-sm bg-gray-800 text-white rounded-full">保存刷新</button>
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
const configTab = ref('assets')

const addRegularAsset = () => { familyData.value.assets.push({ id: Date.now(), owner: '共同', type: 'house', name: '', value: 0 }) }
const logout = () => { sessionStorage.removeItem('family_auth_token'); window.location.reload(); }
const saveAndClose = async () => { await saveConfig(); emit('close'); }
</script>
