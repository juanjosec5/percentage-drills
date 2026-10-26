<script setup lang="ts">
import { ref } from 'vue'

import ChallengeView from './components/ChallengeView.vue'
import DrillView from './components/DrillView.vue'
import HomeView from './components/HomeView.vue'
import PlacementView from './components/PlacementView.vue'
import { useProgress } from './stores/progress'

const progress = useProgress()
const drill = ref<{ level: number; key: number } | null>(null)
const placing = ref(false)
/** The world whose challenge is open. */
const challenge = ref<number | null>(null)

function placeFromDrill() {
  drill.value = null
  placing.value = true
}

function start(level: number) {
  progress.justPlaced = false
  drill.value = { level, key: Date.now() }
}

function startChallenge(world: number) {
  progress.justPlaced = false
  challenge.value = world
}
</script>

<template>
  <DrillView
    v-if="drill"
    :key="drill.key"
    :start-level="drill.level"
    @exit="drill = null"
    @place="placeFromDrill"
  />
  <PlacementView v-else-if="placing" @done="placing = false" />
  <ChallengeView v-else-if="challenge !== null" :world="challenge" @done="challenge = null" />
  <HomeView v-else @start="start" @place="placing = true" @challenge="startChallenge" />
</template>
