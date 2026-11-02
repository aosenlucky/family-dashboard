<script setup>
defineProps({ name: String, size: { default: 20 } });
const paths = {
  heart:
    "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
  pen: "m16 3 5 5M4 15 16 3a3.5 3.5 0 0 1 5 5L9 20l-7 2 2-7Zm0 0 5 5",
  book: "M12 5c-3-2-6-2-10-1v15c4-1 7-1 10 1m0-15c3-2 6-2 10-1v15c-4-1-7-1-10 1V5",
  lock: "M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4m-4 4v3",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  calendar: "M5 5h14a2 2 0 0 1 2 2v13H3V7a2 2 0 0 1 2-2Zm2-3v6m10-6v6M3 11h18",
  bookmark: "M6 3h12v19l-6-4-6 4V3Z",
  image: "M3 3h18v18H3V3Zm0 14 5-5 4 4 4-6 5 7M8 7h.01",
  close: "m6 6 12 12M6 18 18 6",
  check: "m5 12 4 4L19 6",
  plus: "M12 5v14M5 12h14",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  left: "m15 5-7 7 7 7",
  right: "m9 5 7 7-7 7",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  download: "M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4",
  upload: "M12 16V3m-5 5 5-5 5 5M4 17v4h16v-4",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  leaf: "M4 20c2-7 6-11 13-13M4 16C-1 5 10 3 21 3c0 13-8 18-17 13Z",
  clock: "M12 7v5l3 2M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0Z",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6L12 2Zm-5 10 3 3 7-7",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.65"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.book" />
  </svg>
</template>
