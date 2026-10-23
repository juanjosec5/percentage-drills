<script setup lang="ts">
import { ref } from 'vue'

import DrillView from './components/DrillView.vue'
import HomeView from './components/HomeView.vue'
import PlacementView from './components/PlacementView.vue'
import { useProgress, type Mode } from './stores/progress'

const progress = useProgress()
const drill = ref<{ mode: Mode; level: number; key: number } | null>(null)
const placing = ref(false)

function placeFromDrill() {
  drill.value = null
  placing.value = true
}

function start(mode: Mode, level: number) {
  progress.justPlaced = false
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
    @place="placeFromDrill"
  />
  <PlacementView v-else-if="placing" @done="placing = false" />
  <HomeView v-else @start="start" @place="placing = true" />
</template>
