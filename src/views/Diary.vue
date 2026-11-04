<script setup>
import { computed, inject, ref } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from "vue-router";
import DiaryAccount from "../features/diary/DiaryAccount.vue";
import PrivateDiary from "../features/diary/Diary.vue";

const route = useRoute();
const router = useRouter();
const familyDemo = inject("isDemoMode", ref(false));
const diary = ref(null);
const demo = computed(() => familyDemo.value || route.query.demo === "1");
const leave = () => diary.value?.prepareToLeave() ?? true;

onBeforeRouteLeave(leave);
onBeforeRouteUpdate(async (to) => {
  if ((to.query.demo === "1") !== (route.query.demo === "1")) return leave();
});

function showDemo() {
  router.push({ path: "/diary", query: { demo: "1" } });
}
function showPrivate() {
  // A family demo session must never open or write the browser's private vault.
  if (familyDemo.value) return;
  router.push({ path: "/diary" });
}
</script>

<template>
  <DiaryAccount v-if="!demo" ref="diary" @show-demo="showDemo" />
  <PrivateDiary
    v-else
    :key="demo ? 'demo' : 'private'"
    ref="diary"
    :demo-mode="demo"
    :allow-private="!familyDemo"
    @show-demo="showDemo"
    @show-private="showPrivate"
  />
</template>
