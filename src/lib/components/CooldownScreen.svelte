<script lang="ts">
  export let remainingMs = 0;
  export let timerVisible = false;
  export let onSkip: () => void;
  export let onPressStart: () => void;
  export let onPressEnd: () => void;
  export let onSettings: () => void;

  function formatTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
</script>

<section class="screen cooldown-screen" aria-label="Cooldown">
  <div class="cooldown-center">
    <button class="wire-button skip-button" type="button" on:click={onSkip}>Skip cooldown</button>
    {#if timerVisible}
      <output class="countdown" aria-live="polite">{formatTime(remainingMs)}</output>
    {/if}
  </div>

  <button class="wire-button settings-button" type="button" on:click={onSettings}>Settings</button>

  <button
    class="wire-button toggle-button"
    type="button"
    aria-label="Hold to show cooldown timer"
    on:pointerdown={onPressStart}
    on:pointerup={onPressEnd}
    on:pointercancel={onPressEnd}
    on:pointerleave={onPressEnd}
    on:blur={onPressEnd}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onPressStart();
    }}
    on:keyup={(event) => {
      if (event.key === 'Enter' || event.key === ' ') onPressEnd();
    }}
  >
    Show Timer
  </button>
</section>
