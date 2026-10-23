<script setup lang="ts">
import { seconds } from '@/composables/useStopwatch'
import { LEVELS } from '@/engine/levels'
import { PASS_ACCURACY, WINDOW } from '@/engine/mastery'
import { DAILY_COUNT, useProgress, type Mode } from '@/stores/progress'

const emit = defineEmits<{ start: [mode: Mode, level: number] }>()
const progress = useProgress()

function confirmReset() {
  if (confirm('Erase all progress and start again from level 1?')) progress.reset()
}
</script>

<template>
  <div class="mx-auto max-w-xl space-y-5 px-4 py-8">
    <header>
      <h1 class="text-3xl font-bold">Percent Drills</h1>
      <div class="rainbow mt-2 h-1.5 w-28 animate-rainbow rounded-full" />
      <p class="mt-1 text-ink-muted">A few quick percentages a day, one small step at a time.</p>
    </header>

    <section class="grid grid-cols-3 gap-3 text-center">
      <div class="card p-3">
        <p class="text-2xl font-semibold">{{ progress.streak }}</p>
        <p class="text-xs text-ink-muted">day streak</p>
      </div>
      <div class="card p-3">
        <p class="text-2xl font-semibold">
          {{ progress.today.correct }}/{{ progress.today.answered }}
        </p>
        <p class="text-xs text-ink-muted">right today</p>
      </div>
      <div class="card p-3">
        <p class="text-2xl font-semibold">
          {{ progress.today.bestMs === null ? '–' : seconds(progress.today.bestMs) }}
        </p>
        <p class="text-xs text-ink-muted">fastest today</p>
      </div>
    </section>

    <section class="grid gap-3 sm:grid-cols-2">
      <button
        class="card card-action text-left disabled:opacity-60"
        :disabled="progress.dailyDone"
        @click="emit('start', 'daily', progress.unlocked)"
      >
        <p class="font-semibold">Daily set</p>
        <p class="text-sm text-ink-muted">
          {{
            progress.dailyDone
              ? 'Done for today ✓'
              : `${Math.min(progress.today.daily, DAILY_COUNT)}/${DAILY_COUNT} done`
          }}
        </p>
      </button>
      <button
        class="card card-action text-left"
        @click="emit('start', 'endless', progress.unlocked)"
      >
        <p class="font-semibold">Endless</p>
        <p class="text-sm text-ink-muted">A new one every time you solve one</p>
      </button>
    </section>

    <section class="space-y-2">
      <h2 class="font-semibold">Levels</h2>
      <p class="text-sm text-ink-muted">
        Move up when your last {{ WINDOW }} answers at a level are {{ PASS_ACCURACY * 100 }}% right
        and under the target time. About a third of problems review earlier levels.
      </p>
      <ol class="space-y-2">
        <li v-for="(level, i) in LEVELS" :key="level.id">
          <button
            class="card card-action flex w-full items-start gap-3 p-4 text-left disabled:opacity-45 disabled:shadow-none"
            :class="{ 'rainbow-border animate-rainbow shadow-lift': i === progress.unlocked }"
            :disabled="i > progress.unlocked"
            @click="emit('start', 'endless', i)"
          >
            <span class="w-6 shrink-0 font-mono text-ink-muted">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1">
              <span class="block font-medium">{{ level.title }}</span>
              <span class="block text-sm text-ink-muted">{{ level.strategy }}</span>
              <span
                v-if="i <= progress.unlocked"
                class="mt-1 block font-mono text-xs text-ink-muted"
              >
                <template v-if="i < progress.unlocked">mastered ✓</template>
                <template v-else>
                  {{ progress.statusOf(i).answered }}/{{ WINDOW }} answered ·
                  {{ Math.round(progress.statusOf(i).accuracy * 100) }}% right · median
                  {{ progress.statusOf(i).medianSeconds.toFixed(1) }}s / target
                  {{ level.targetSeconds }}s
                </template>
              </span>
            </span>
            <span v-if="i > progress.unlocked" class="text-sm">🔒</span>
          </button>
        </li>
      </ol>
    </section>

    <button class="text-xs text-ink-muted underline" @click="confirmReset">Reset progress</button>
  </div>
</template>
