<script setup>
import { useId } from "vue";
import { PEOPLE } from "../data.js";
defineProps({
  modelValue: String,
  label: { type: String, default: "记录人" },
  locked: Boolean,
});
defineEmits(["update:modelValue"]);
const groupId = useId();
</script>
<template>
  <fieldset class="author-picker">
    <legend>{{ label }}</legend>
    <div v-if="locked" class="locked-author">
      <span class="avatar-dot" :class="modelValue">{{
        modelValue === "aosen" ? "A" : "悦"
      }}</span
      >{{ PEOPLE[modelValue] }}<span class="quiet-text">原记录人</span>
    </div>
    <div v-else class="author-options">
      <label
        v-for="(name, id) in PEOPLE"
        :key="id"
        :class="{ selected: modelValue === id }"
      >
        <input
          type="radio"
          :name="groupId"
          :aria-label="name"
          :value="id"
          :checked="modelValue === id"
          @change="$emit('update:modelValue', id)"
        />
        <span class="avatar-dot" :class="id">{{
          id === "aosen" ? "A" : "悦"
        }}</span
        >{{ name }}
      </label>
    </div>
  </fieldset>
</template>
