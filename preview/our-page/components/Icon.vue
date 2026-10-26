<script setup>
defineProps({ name: String, size: { type: [Number, String], default: 20 } });
const paths = {
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  book: "M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1m0-15c3-2 6-2 10-1v15c-4-1-7-1-10 1V5",
  pen: "m16 3 5 5M4 15 16 3a3.5 3.5 0 0 1 5 5L9 20l-7 2 2-7Zm0 0 5 5",
  bookmark: "M6 3h12v19l-6-4-6 4V3Z",
  mail: "M3 5h18v14H3V5Zm0 0 9 7 9-7",
  image: "M3 3h18v18H3V3Zm0 14 5-5 4 4 4-6 5 7M8 7h.01",
  plus: "M12 5v14M5 12h14",
  close: "m6 6 12 12M6 18 18 6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  chevron: "m9 5 7 7-7 7",
  check: "m5 12 4 4L19 6",
  leaf: "M4 20c2-7 6-11 13-13M4 16C-1 5 10 3 21 3c0 13-8 18-17 13Z",
  chat: "M21 11a9 9 0 0 1-9 9c-2 0-4-.6-5-1.5L3 20l1.5-4C3.5 15 3 13 3 11a9 9 0 0 1 18 0Z",
  calendar: "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Zm2-3v6m10-6v6M3 11h18",
  arrowLeft: "M20 12H4m6-6-6 6 6 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  info: "M12 8h.01M12 11v6M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.heart" />
  </svg>
</template>
