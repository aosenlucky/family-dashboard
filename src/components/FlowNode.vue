<template>
    <div class="flex flex-col items-center">
        <div v-if="node.transfer" class="w-1 h-10 bg-blue-100/50 -mt-2 z-0 relative overflow-hidden rounded-full shadow-inner border border-blue-200/30">
            <div class="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-blue-500 to-transparent animate-flow-current opacity-90 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
        </div>
        
        <div class="bg-white/90 backdrop-blur-xl border border-white px-5 py-3 rounded-2xl shadow-sm text-center relative min-w-[140px] transition-all z-10" :class="{'border-b-4 border-b-apple-blue bg-white shadow-md': node.isRoot}">
            <div v-if="node.transfer" class="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-[9px] px-2 py-0.5 rounded-full shadow-md whitespace-nowrap z-20">
                {{node.transfer.day}}日送达 {{formatCurrencyInt(node.transfer.amount)}}
            </div>
            <div class="font-semibold text-sm text-gray-800 flex justify-center items-center mt-1">
                <i v-if="node.isRoot" class="ph-fill ph-bank mr-1 text-apple-blue"></i>{{ node.name }}
            </div>
        </div>

        <div v-if="node.children && node.children.length" class="flex mt-2 relative pt-2">
            <div v-if="node.children.length > 1" class="absolute top-0 h-[2px] bg-blue-100/50 z-0" style="left: 20%; right: 20%;"></div>
            <div v-for="(child, index) in node.children" :key="index" class="flex flex-col items-center px-4 relative pt-2">
                <div class="absolute top-0 w-[2px] h-2 bg-blue-100/50 z-0"></div>
                <FlowNode :node="child" :rootSalaryDay="rootSalaryDay"></FlowNode>
            </div>
        </div>
    </div>
</template>

<script setup>
import { inject } from 'vue'
const props = defineProps(['node', 'rootSalaryDay'])
const formatCurrencyInt = inject('formatCurrencyInt')
</script>