<script setup lang="ts">
// A one-shot burst for a mastered node: a gold ring swells out and eight rainbow dots fly off.
// Purely decorative, so hidden from screen readers; it plays once and leaves nothing behind.
const DOTS = [1, 2, 3, 4, 5, 6, 3, 6]
</script>

<template>
  <span class="burst" aria-hidden="true">
    <span class="ring" />
    <span
      v-for="(hue, k) in DOTS"
      :key="k"
      class="dot"
      :style="{
        background: `rgb(var(--rainbow-${hue}))`,
        '--angle': `${(k / DOTS.length) * 360}deg`,
      }"
    />
  </span>
</template>

<style scoped>
.burst {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}
.ring {
  position: absolute;
  left: -14px;
  top: -14px;
  width: 28px;
  height: 28px;
  border: 3px solid rgb(var(--rainbow-3));
  border-radius: 9999px;
  animation: swell 0.65s ease-out both;
}
.dot {
  position: absolute;
  left: -4px;
  top: -4px;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  animation: fly 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) both;
}
@keyframes swell {
  from {
    transform: scale(0.6);
  }
  to {
    transform: scale(2.6);
    opacity: 0;
  }
}
@keyframes fly {
  from {
    transform: rotate(var(--angle)) translateX(0) scale(1);
  }
  to {
    transform: rotate(var(--angle)) translateX(40px) scale(0.3);
    opacity: 0;
  }
}
</style>
