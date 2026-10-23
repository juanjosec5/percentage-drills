<script setup lang="ts">
import { computed } from 'vue'

import { seconds } from '@/composables/useStopwatch'
import { LEVELS } from '@/engine/levels'
import { PASS_ACCURACY, WINDOW } from '@/engine/mastery'
import { DAILY_COUNT, useProgress, type Mode } from '@/stores/progress'

const emit = defineEmits<{ start: [mode: Mode, level: number] }>()
const progress = useProgress()

// The main button: today's daily set first (it keeps the streak), endless practice after.
const ctaMode = computed<Mode>(() => (progress.dailyDone ? 'endless' : 'daily'))
const isNewLevel = computed(() => progress.statusOf(progress.unlocked).answered === 0)

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

    <button
      class="group block w-full rounded-2xl bg-cta outline-offset-3 focus-visible:outline-2 focus-visible:outline-cta px-6 py-6 text-left text-white shadow-[0_14px_30px_-10px_rgb(var(--palette-cta)/0.6)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_36px_-10px_rgb(var(--palette-cta)/0.7)] active:translate-y-0 active:shadow-press"
      autofocus
      @click="emit('start', ctaMode, progress.unlocked)"
    >
      <span class="block text-3xl font-bold sm:text-4xl">
        {{ isNewLevel ? 'Start' : 'Continue' }} level {{ progress.unlocked + 1 }}
        <span class="inline-block transition-transform group-hover:translate-x-1">→</span>
      </span>
      <span class="mt-1 block text-white/80">
        {{ LEVELS[progress.unlocked].title }} ·
        {{
          ctaMode === 'daily'
            ? `today's ${DAILY_COUNT - progress.today.daily} problems`
            : 'endless practice'
        }}
      </span>
    </button>

    <nav class="-mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
      <button
        class="underline-offset-4 enabled:hover:text-ink enabled:hover:underline"
        :disabled="progress.dailyDone"
        @click="emit('start', 'daily', progress.unlocked)"
      >
        Daily set ·
        {{
          progress.dailyDone
            ? 'done for today ✓'
            : `${Math.min(progress.today.daily, DAILY_COUNT)}/${DAILY_COUNT}`
        }}
      </button>
      <button
        class="underline-offset-4 hover:text-ink hover:underline"
        @click="emit('start', 'endless', progress.unlocked)"
      >
        Endless practice →
      </button>
    </nav>

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

    <section class="space-y-2">
      <h2 class="font-semibold">Levels</h2>
      <p class="text-sm text-ink-muted">
        Move up when your last {{ WINDOW }} answers at a level are {{ PASS_ACCURACY * 100 }}% right
        and under the target time. About a third of problems review earlier levels.
      </p>
      <ol class="space-y-2">
        <li v-for="(level, i) in LEVELS" :key="level.id">
          <button
            class="card card-action relative flex w-full items-start gap-3 overflow-hidden p-4 text-left disabled:opacity-45 disabled:shadow-none"
            :class="{
              'shadow-lift': i === progress.unlocked,
              'border-cta/20 bg-mastered!': i < progress.unlocked,
            }"
            :disabled="i > progress.unlocked"
            @click="emit('start', 'endless', i)"
          >
            <span class="w-6 shrink-0 font-mono text-ink-muted">{{ i + 1 }}</span>
            <span class="min-w-0 flex-1">
              <span
                v-if="i === progress.unlocked"
                class="absolute inset-y-0 left-0 w-1 bg-cta"
                aria-hidden="true"
              />
              <span class="block font-medium">{{ level.title }}</span>
              <span class="block text-sm text-ink-muted">{{ level.strategy }}</span>
              <span
                v-if="i === progress.unlocked"
                class="mt-1 block font-mono text-xs text-ink-muted"
              >
                {{ progress.statusOf(i).answered }}/{{ WINDOW }} answered ·
                {{ Math.round(progress.statusOf(i).accuracy * 100) }}% right · median
                {{ progress.statusOf(i).medianSeconds.toFixed(1) }}s / target
                {{ level.targetSeconds }}s
              </span>
            </span>
            <span
              v-if="i === progress.unlocked"
              class="shrink-0 rounded-full bg-cta/10 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-cta uppercase"
              >Current</span
            >
            <span
              v-else-if="i < progress.unlocked"
              class="shrink-0 rounded-full bg-[rgb(var(--rainbow-3))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink uppercase shadow-soft"
              >★ Mastered</span
            >
            <span v-else class="text-sm">🔒</span>
          </button>
        </li>
      </ol>
    </section>

    <button class="text-xs text-ink-muted underline" @click="confirmReset">Reset progress</button>
  </div>
</template>
