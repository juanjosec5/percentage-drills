<script setup lang="ts">
// Text set in monospace, where the thin space that groups thousands (43 720) gets a full digit's
// width and reads like a word break. Each group after the first is pushed off by a narrow margin
// instead; no space is left in the text, so a screen reader hears one number.
import { computed } from 'vue'

import { GROUP } from '@/engine/math'

const props = defineProps<{ text: string }>()
const parts = computed(() => props.text.split(GROUP))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i">
    <span v-if="i" class="ml-[0.2em]">{{ part }}</span>
    <template v-else>{{ part }}</template>
  </template>
</template>
