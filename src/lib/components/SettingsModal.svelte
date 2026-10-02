<script lang="ts">
  import {
    DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO,
    DEFAULT_QUESTION_SCRATCHPAD_RATIO,
    questionPrompt,
  } from "../../constants";

  export let theme: 'dark' | 'light' = 'dark';
  export let minMinutes = 10;
  export let maxMinutes = 30;
  export let notificationsEnabled = true;
  export let attentionSoundEnabled = true;
  export let attentionSoundIntervalSeconds = 8;
  export let attentionSoundVolume = 0.3;
  export let questionContentAlternativesRatio = DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO;
  export let questionScratchpadRatio = DEFAULT_QUESTION_SCRATCHPAD_RATIO;
  export let showQuestionSidebar = true;
  export let onSave: (
    theme: 'dark' | 'light',
    min: number,
    max: number,
    notifications: boolean,
    attentionSound: boolean,
    attentionSoundIntervalSeconds: number,
    attentionSoundVolume: number,
    questionContentAlternativesRatio: number,
    questionScratchpadRatio: number,
    showQuestionSidebar: boolean,
  ) => void;
  export let ignoredQuestionCount = 0;
  export let onClearIgnoreList: () => void;
  export let onClose: () => void;

  let themeValue: 'dark' | 'light' = theme;
  let minValue = minMinutes;
  let maxValue = maxMinutes;
  let notificationValue = notificationsEnabled;
  let soundValue = attentionSoundEnabled;
  let soundIntervalValue = attentionSoundIntervalSeconds;
  let soundVolumeValue = Math.round(attentionSoundVolume * 100);
  let contentAlternativesRatioValue = questionContentAlternativesRatio;
  let questionScratchpadRatioValue = questionScratchpadRatio;
  let questionSidebarValue = showQuestionSidebar;
  let promptCopied = false;
  let notificationError = '';

  const notificationsSupported = typeof Notification !== 'undefined';

  async function requestNotificationPermission() {
    notificationError = '';

    if (!notificationsSupported) {
      notificationValue = false;
      notificationError = 'Browser notifications are not supported here.';
      return;
    }

    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') {
      notificationValue = false;
      notificationError = 'Browser notification permission is blocked.';
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        notificationValue = false;
        notificationError = 'Browser notification permission was not granted.';
      }
    } catch {
      notificationValue = false;
      notificationError = 'Browser notification permission is unavailable.';
    }
  }

  async function toggleNotifications() {
    if (notificationValue) {
      await requestNotificationPermission();
    } else {
      notificationError = '';
    }
  }

  function toggleTheme() {
    themeValue = themeValue === 'light' ? 'dark' : 'light';
  }

  function resetLayoutDefaults() {
    contentAlternativesRatioValue = DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO;
    questionScratchpadRatioValue = DEFAULT_QUESTION_SCRATCHPAD_RATIO;
  }

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

  async function save() {
    if (notificationValue && notificationsSupported && Notification.permission === 'default') {
      await requestNotificationPermission();
    }

    const min = Number(minValue);
    const max = Number(maxValue);
    const soundInterval = Number(soundIntervalValue);
    const soundVolume = Number(soundVolumeValue) / 100;
    const contentAlternativesRatio = Number(contentAlternativesRatioValue);
    const questionScratchpadRatio = Number(questionScratchpadRatioValue);

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max < 0 ||
      !Number.isFinite(soundInterval) ||
      soundInterval < 1 ||
      soundInterval > 300 ||
      !Number.isFinite(soundVolume) ||
      soundVolume < 0 ||
      soundVolume > 1 ||
      !Number.isFinite(contentAlternativesRatio) ||
      contentAlternativesRatio < 0.25 ||
      contentAlternativesRatio > 6 ||
      !Number.isFinite(questionScratchpadRatio) ||
      questionScratchpadRatio < 0.25 ||
      questionScratchpadRatio > 6
    ) {
      return;
    }

    onSave(
      themeValue,
      Math.min(min, max),
      Math.max(min, max),
      notificationValue,
      soundValue,
      Math.round(soundInterval),
      soundVolume,
      Math.round(contentAlternativesRatio * 1000) / 1000,
      Math.round(questionScratchpadRatio * 1000) / 1000,
      questionSidebarValue,
    );
  }
</script>

<div
  class="modal-backdrop"
  role="presentation"
  on:click={(event) => event.currentTarget === event.target && onClose()}
>
  <dialog
    class="settings-modal"
    open
    aria-labelledby="settings-title"
  >
    <div class="modal-heading">
      <h2 id="settings-title">Settings</h2>

      <button
        class="wire-button compact icon-button"
        type="button"
        on:click={onClose}
        aria-label="Close settings"
      >
        ×
      </button>
    </div>

    <div class="settings-options settings-theme-option">
      <label class="setting-toggle">
        <input
          type="checkbox"
          checked={themeValue === 'light'}
          on:change={toggleTheme}
        />
        <span>Light mode</span>
      </label>
    </div>

    <div class="settings-grid">
      <label>
        <span class="setting-label">Minimum cooldown (minutes)</span>
        <input bind:value={minValue} type="number" min="0" step="0.1" />
      </label>

      <label>
        <span class="setting-label">Maximum cooldown (minutes)</span>
        <input bind:value={maxValue} type="number" min="0" step="0.1" />
      </label>
    </div>

    <div class="settings-options">
      <label class="setting-toggle">
        <input
          type="checkbox"
          bind:checked={notificationValue}
          on:change={toggleNotifications}
        />
        <span>Cooldown browser notification</span>
      </label>

      <label class="setting-toggle">
        <input type="checkbox" bind:checked={soundValue} />
        <span>Background attention sound</span>
      </label>

      <div class="settings-grid sound-settings-grid">
        <label>
          <span class="setting-label">Sound repeat interval (seconds)</span>
          <input
            bind:value={soundIntervalValue}
            type="number"
            min="1"
            max="300"
            step="1"
            disabled={!soundValue}
          />
        </label>

        <label>
          <span class="setting-label">Sound volume (%)</span>
          <input
            bind:value={soundVolumeValue}
            type="number"
            min="0"
            max="100"
            step="1"
            disabled={!soundValue}
          />
        </label>
      </div>

      {#if notificationError}
        <div class="setting-note">{notificationError}</div>
      {:else if notificationValue && notificationsSupported && Notification.permission !== 'granted'}
        <div class="setting-note">Browser permission is requested when notifications are enabled or saved.</div>
      {/if}
    </div>

    <div class="settings-options layout-settings">
      <div class="setting-section-title">Question layout</div>

      <div class="settings-grid layout-ratio-grid">
        <label>
          <span class="setting-label">Content : alternatives ratio</span>
          <input
            bind:value={contentAlternativesRatioValue}
            type="number"
            min="0.25"
            max="6"
            step="0.01"
          />
        </label>

        <label>
          <span class="setting-label">Question : scratchpad ratio</span>
          <input
            bind:value={questionScratchpadRatioValue}
            type="number"
            min="0.25"
            max="6"
            step="0.01"
          />
        </label>
      </div>

      <div class="setting-note">A ratio above 1 gives more space to the first section.</div>

      <div class="layout-row">
        <label class="setting-toggle">
          <input
            type="checkbox"
            bind:checked={questionSidebarValue}
          />
          <span>Show question left column</span>
        </label>

        <button
          class="wire-button compact"
          type="button"
          on:click={resetLayoutDefaults}
        >
          Reset layout defaults
        </button>
      </div>
    </div>

    <div class="ignore-list-section">
      <div>
        <div class="setting-section-title">Question cycle</div>
        <div class="setting-note">{ignoredQuestionCount} {ignoredQuestionCount === 1 ? 'question is' : 'questions are'} currently ignored.</div>
      </div>

      <button
        class="wire-button compact"
        type="button"
        on:click={onClearIgnoreList}
        disabled={ignoredQuestionCount === 0}
      >
        Clear ignore list
      </button>
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
  </dialog>
</div>
