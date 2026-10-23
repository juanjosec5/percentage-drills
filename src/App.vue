<script setup lang="ts">
import { ref } from 'vue'

import DrillView from './components/DrillView.vue'
import HomeView from './components/HomeView.vue'
import type { Mode } from './stores/progress'

const drill = ref<{ mode: Mode; level: number; key: number } | null>(null)

function start(mode: Mode, level: number) {
  drill.value = { mode, level, key: Date.now() }
}
</script>

<template>
  <DrillView
    v-if="drill"
    :key="drill.key"
    :mode="drill.mode"
    :start-level="drill.level"
    @exit="drill = null"
  />
  <HomeView v-else @start="start" />
</template>
