<script lang="ts">
  import { questionPrompt } from "../../constants";

  export let minMinutes = 10;
  export let maxMinutes = 30;
  export let onSave: (min: number, max: number) => void;
  export let onClose: () => void;

  let minValue = minMinutes;
  let maxValue = maxMinutes;
  let promptCopied = false;
  
  async function copyQuestionPrompt() {
    try {
      await navigator.clipboard.writeText(questionPrompt);
      promptCopied = true;

      setTimeout(() => {
        promptCopied = false;
      }, 1500);
    } catch {
      promptCopied = false;
    }
  }

  function save() {
    const min = Number(minValue);
    const max = Number(maxValue);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
      return;
    }

    onSave(Math.min(min, max), Math.max(min, max));
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={(event) => event.currentTarget === event.target && onClose()}
>
  <section
    class="settings-modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
  >
    <div class="modal-heading">
      <h2 id="settings-title">Settings</h2>

      <button
        class="icon-button"
        type="button"
        on:click={onClose}
        aria-label="Close settings"
      >
        ×
      </button>
    </div>

    <div class="settings-grid">
      <label>
        Minimum cooldown (minutes)
        <input bind:value={minValue} type="number" min="0" step="0.1" />
      </label>

      <label>
        Maximum cooldown (minutes)
        <input bind:value={maxValue} type="number" min="0" step="0.1" />
      </label>
    </div>

    <div class="modal-actions">
      <button
        class="wire-button compact prompt-button"
        type="button"
        on:click={copyQuestionPrompt}
      >
        {promptCopied ? 'Copied!' : 'Copy Question Prompt'}
      </button>

      <div class="modal-actions-right">
        <button class="wire-button" type="button" on:click={onClose}>
          Cancel
        </button>

        <button class="wire-button primary" type="button" on:click={save}>
          Save
        </button>
      </div>
    </div>
  </section>
</div>