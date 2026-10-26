<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import Icon from "./Icon.vue";
defineProps({ title: String, eyebrow: String, wide: Boolean });
const emit = defineEmits(["close"]);
const dialog = ref(null);
let previousFocus;
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value.showModal();
  document.body.style.overflow = "hidden";
});
onBeforeUnmount(() => {
  document.body.style.overflow = "";
  previousFocus?.focus?.();
});
</script>
<template>
  <dialog
    ref="dialog"
    class="dialog"
    :class="{ 'dialog-wide': wide }"
    aria-labelledby="dialog-title"
    @cancel.prevent="emit('close')"
    @click="(e) => e.target === dialog && emit('close')"
  >
    <div class="dialog-content">
      <header class="dialog-header">
        <div>
          <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
          <h2 id="dialog-title">{{ title }}</h2>
        </div>
        <button
          class="icon-button"
          type="button"
          aria-label="关闭窗口"
          @click="emit('close')"
        >
          <Icon name="close" />
        </button>
      </header>
      <slot />
    </div>
  </dialog>
</template>
