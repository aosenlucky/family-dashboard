<script setup>
import Icon from "./Icon.vue";
import { PEOPLE } from "../data.js";
defineProps({ latest: Object });
defineEmits(["open", "compose"]);
</script>
<template>
  <section class="life-placement">
    <header class="life-heading">
      <h1>记录生活的点滴</h1>
      <p>协作，期待，与成长。</p>
    </header>
    <section class="life-entry glass-card" aria-labelledby="entry-heading">
      <div class="entry-mark"><Icon name="heart" :size="26" /></div>
      <div class="entry-copy">
        <h2 id="entry-heading">我们这一页</h2>
        <p>记下暖心小事，也听见彼此的心里话。</p>
        <span v-if="latest" class="latest-memory"
          >最近 · {{ PEOPLE[latest.author] }} 记录了「{{ latest.title }}」</span
        >
      </div>
      <div class="entry-actions">
        <button class="primary-button" @click="$emit('compose')">
          <Icon name="plus" :size="17" />记一件小事</button
        ><button class="text-button" @click="$emit('open')">
          看看我们的日常 <Icon name="arrow" :size="16" />
        </button>
      </div>
    </section>
    <div class="life-existing" aria-label="生活页其他模块的位置示意">
      <article class="glass-card">
        <h2><Icon name="leaf" :size="20" />习惯花园</h2>
        <p>一起坚持的小习惯，慢慢长成生活的一部分。</p>
        <div class="placement-sample">
          每天阅读 30 分钟<span>习惯记录</span>
        </div>
      </article>
      <article class="glass-card">
        <h2><Icon name="check" :size="20" />家庭待办协作</h2>
        <p>把今天的小事，一起安排好。</p>
        <div class="placement-sample">周末一起去买菜<span>家庭待办</span></div>
      </article>
      <article class="glass-card">
        <h2><Icon name="calendar" :size="20" />宝宝时光轴</h2>
        <p>留住每一个成长的瞬间。</p>
      </article>
      <article class="glass-card">
        <h2><Icon name="heart" :size="20" />纪念日</h2>
        <p>记住属于我们的特别日子。</p>
      </article>
    </div>
    <p class="placement-note">
      入口位置预览：新卡片放在生活页顶部，原有模块继续保留。
    </p>
  </section>
</template>
