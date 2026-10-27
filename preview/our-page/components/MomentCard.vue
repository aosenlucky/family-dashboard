<script setup>
import Icon from "./Icon.vue";
import { PEOPLE, dateLabel } from "../data.js";
defineProps({ moment: Object, viewer: String });
defineEmits(["open", "remember", "favorite"]);
</script>
<template>
  <article class="moment-card" :class="{ 'text-moment': !moment.photo }">
    <button
      v-if="moment.photo"
      class="moment-image-button"
      :aria-label="'打开回忆：' + moment.title"
      @click="$emit('open', moment)"
    >
      <img
        :src="moment.photo"
        :alt="moment.photoAlt || moment.title"
        loading="lazy"
      />
    </button>
    <div class="moment-body">
      <div class="moment-meta">
        <span
          ><span class="avatar-dot" :class="moment.author">{{
            moment.author === "aosen" ? "A" : "悦"
          }}</span
          >{{ PEOPLE[moment.author] }} 记录</span
        ><time :datetime="moment.date">{{ dateLabel(moment.date) }}</time>
      </div>
      <h3>
        <button class="title-button" @click="$emit('open', moment)">
          {{ moment.title }}
        </button>
      </h3>
      <p class="moment-excerpt">{{ moment.text }}</p>
      <div v-if="moment.replies.length" class="reply-preview">
        <Icon name="chat" :size="15" /><span
          >{{ PEOPLE[moment.replies[0].author] }}：{{
            moment.replies[0].text
          }}</span
        >
      </div>
      <div class="moment-actions">
        <button
          class="remember-button"
          :class="{ remembered: moment.reactions.includes(viewer) }"
          :aria-pressed="moment.reactions.includes(viewer)"
          @click="$emit('remember', moment)"
        >
          <Icon name="heart" :size="17" />{{
            moment.reactions.includes(viewer) ? "我记得这件事" : "这件事我记得"
          }}
        </button>
        <button
          class="icon-button bookmark-button"
          :class="{ saved: moment.favorites.includes(viewer) }"
          :aria-pressed="moment.favorites.includes(viewer)"
          :aria-label="
            (moment.favorites.includes(viewer) ? '取消珍藏：' : '珍藏：') +
            moment.title
          "
          @click="$emit('favorite', moment)"
        >
          <Icon name="bookmark" :size="19" />
        </button>
      </div>
    </div>
  </article>
</template>
