<script lang="ts">
  import { onMount } from 'svelte';
  import CooldownScreen from '$lib/components/CooldownScreen.svelte';
  import QuestionScreen from '$lib/components/QuestionScreen.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import type { AppSettings, ParsedQuestion, QuestionMetadata, TrainingPhase } from '$lib/types';
  import type { PageData } from './$types';
import {
  DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO,
  DEFAULT_QUESTION_SCRATCHPAD_RATIO,
} from '../constants';

  export let data: PageData;

  const SETTINGS_KEY = 'pace-study-settings';
  const IGNORE_QUESTIONS_KEY = 'pace-study-ignore-question-files';
  const ATTENTION_CUE_INITIAL_DELAY_MS = 1_000;
  const DEFAULT_SETTINGS: AppSettings = {
    theme: 'dark',
    minCooldownMinutes: 1,
    maxCooldownMinutes: 3,
    notificationsEnabled: true,
    attentionSoundEnabled: true,
    attentionSoundIntervalSeconds: 8,
    attentionSoundVolume: 0.3,
    questionContentAlternativesRatio:
      DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO,
    questionScratchpadRatio: DEFAULT_QUESTION_SCRATCHPAD_RATIO,
    showQuestionSidebar: true,
  };

  let settings: AppSettings = { ...DEFAULT_SETTINGS };
  let phase: TrainingPhase = 'cooldown';
  let remainingMs = 0;
  let cooldownEndsAt = 0;
  let cooldownPaused = false;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let timerVisible = false;
  let settingsOpen = false;
  let activeQuestion: ParsedQuestion | null = null;
  let activeQuestionId: string | null = null;
  let selectedAlternative: number | null = null;
  let draftText = '';
  let ignoredQuestionFiles = new Set<string>();
  let selectionStateInitialized = false;
  let loadingQuestion = false;

  let questionElapsedMs = 0;
  let questionElapsedAccumulatedMs = 0;
  let questionElapsedRunning = false;
  let questionElapsedStartedAt = 0;
  let questionElapsedTimerId: ReturnType<typeof setInterval> | null = null;

  let attentionCueIntervalId: ReturnType<typeof setInterval> | null = null;
  let attentionCueTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let attentionAudio: HTMLAudioElement | null = null;

  $: availableQuestionCount = Math.max(0, data.questions.length - ignoredQuestionFiles.size);

  function createAttentionAudio(): HTMLAudioElement {
    const audio = new Audio('/audio/attention-cue.wav');
    audio.preload = 'auto';
    audio.volume = settings.attentionSoundVolume;
    return audio;
  }

  function applyTheme(theme: AppSettings['theme']) {
    document.documentElement.dataset.theme = theme;

    const themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.content = theme === 'light' ? '#f7f5f2' : '#171513';
    }
  }

  function persistSettings(next: AppSettings) {
    applyTheme(next.theme);
    settings = next;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
    syncAttentionCue();
  }

  function randomCooldownMs(): number {
    const min = Math.max(0, Math.min(settings.minCooldownMinutes, settings.maxCooldownMinutes));
    const max = Math.max(0, Math.max(settings.minCooldownMinutes, settings.maxCooldownMinutes));
    const minutes = min + Math.random() * (max - min);
    return Math.round(minutes * 60 * 1000);
  }

  function stopCooldownTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startCooldownTimer() {
    stopCooldownTimer();
    cooldownPaused = false;
    remainingMs = randomCooldownMs();
    cooldownEndsAt = Date.now() + remainingMs;

    if (remainingMs <= 0) {
      void finishCooldown(true);
      return;
    }

    timerId = setInterval(() => {
      remainingMs = Math.max(0, cooldownEndsAt - Date.now());
      if (remainingMs <= 0) {
        stopCooldownTimer();
        void finishCooldown(true);
      }
    }, 250);
  }

  function pauseCooldown() {
    if (phase !== 'cooldown' || cooldownPaused || timerId === null) return;

    remainingMs = Math.max(0, cooldownEndsAt - Date.now());
    stopCooldownTimer();
    cooldownPaused = true;
  }

  function resumeCooldown() {
    if (phase !== 'cooldown' || !cooldownPaused) return;

    cooldownPaused = false;
    cooldownEndsAt = Date.now() + remainingMs;
    if (remainingMs <= 0) {
      void finishCooldown(true);
      return;
    }

    timerId = setInterval(() => {
      remainingMs = Math.max(0, cooldownEndsAt - Date.now());
      if (remainingMs <= 0) {
        stopCooldownTimer();
        void finishCooldown(true);
      }
    }, 250);
  }

  function toggleCooldownPause() {
    if (cooldownPaused) resumeCooldown();
    else pauseCooldown();
  }

  function stopQuestionElapsedTimer() {
    if (questionElapsedTimerId !== null) {
      clearInterval(questionElapsedTimerId);
      questionElapsedTimerId = null;
    }
  }

  function resetQuestionElapsedTimer() {
    stopQuestionElapsedTimer();
    questionElapsedMs = 0;
    questionElapsedAccumulatedMs = 0;
    questionElapsedRunning = false;
    questionElapsedStartedAt = 0;
  }

  function startQuestionElapsedTimer() {
    if (phase !== 'answering' || questionElapsedRunning) return;

    questionElapsedRunning = true;
    questionElapsedStartedAt = Date.now();
    questionElapsedTimerId = setInterval(() => {
      questionElapsedMs = Math.max(
        0,
        questionElapsedAccumulatedMs + Date.now() - questionElapsedStartedAt,
      );
    }, 250);
  }

  function pauseQuestionElapsedTimer() {
    if (!questionElapsedRunning) return;

    questionElapsedMs = Math.max(
      0,
      questionElapsedAccumulatedMs + Date.now() - questionElapsedStartedAt,
    );
    questionElapsedAccumulatedMs = questionElapsedMs;
    questionElapsedRunning = false;
    questionElapsedStartedAt = 0;
    stopQuestionElapsedTimer();
  }

  function toggleQuestionElapsedTimer() {
    if (questionElapsedRunning) pauseQuestionElapsedTimer();
    else startQuestionElapsedTimer();
  }

  function persistIgnoreList() {
    localStorage.setItem(
      IGNORE_QUESTIONS_KEY,
      JSON.stringify([...ignoredQuestionFiles]),
    );
  }

  function clearIgnoreList() {
    ignoredQuestionFiles = new Set();
    persistIgnoreList();
  }

  function validQuestionFiles(): Set<string> {
    return new Set(
      data.questions.map((question) => `${question.id}.md`),
    );
  }

  async function initializeSelectionState() {
    if (selectionStateInitialized) return;

    try {
      const raw = localStorage.getItem(IGNORE_QUESTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const availableFiles = validQuestionFiles();

      if (Array.isArray(parsed)) {
        ignoredQuestionFiles = new Set(
          parsed.filter(
            (fileName): fileName is string =>
              typeof fileName === 'string' && availableFiles.has(fileName),
          ),
        );
      } else {
        ignoredQuestionFiles = new Set();
      }
    } catch {
      ignoredQuestionFiles = new Set();
    }

    persistIgnoreList();
  }

  async function finishCooldown(shouldNotify: boolean) {
    stopCooldownTimer();
    cooldownPaused = false;
    timerVisible = false;
    await loadNextQuestion();

    if (shouldNotify && activeQuestion) {
      notifyQuestionReady();
    }
  }

  async function skipCooldown() {
    await finishCooldown(false);
  }

  async function loadNextQuestion() {
    await initializeSelectionState();

    const pool = data.questions;
    if (pool.length === 0) {
      resetQuestionElapsedTimer();
      activeQuestion = null;
      activeQuestionId = null;
      phase = 'answering';
      syncAttentionCue();
      return;
    }

    let candidates = pool.filter(
      (question) => !ignoredQuestionFiles.has(`${question.id}.md`),
    );

    if (candidates.length === 0) {
      ignoredQuestionFiles = new Set();
      persistIgnoreList();
      candidates = pool;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    activeQuestionId = selected.id;
    selectedAlternative = null;
    draftText = '';
    resetQuestionElapsedTimer();
    phase = 'answering';
    loadingQuestion = true;
    syncAttentionCue();

    try {
      const encodedQuestionId = selected.id.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`/api/questions/${encodedQuestionId}`);
      if (!response.ok) throw new Error(`Question ${selected.id} could not be loaded`);
      activeQuestion = (await response.json()) as ParsedQuestion;
    } catch (error) {
      console.error(error);
      activeQuestion = null;
    } finally {
      loadingQuestion = false;
      syncAttentionCue();
    }
  }

  function selectAlternative(index: number) {
    if (phase !== 'answering') return;
    selectedAlternative = selectedAlternative === index ? null : index;
  }

  function quitQuestion() {
    resetQuestionElapsedTimer();
    draftText = '';
    activeQuestion = null;
    activeQuestionId = null;
    selectedAlternative = null;
    phase = 'cooldown';
    startCooldownTimer();
    syncAttentionCue();
  }

  function answerQuestion() {
    if (!activeQuestion || selectedAlternative === null || phase !== 'answering') return;

    const fileName = `${activeQuestion.id}.md`;
    ignoredQuestionFiles = new Set([...ignoredQuestionFiles, fileName]);
    persistIgnoreList();

    resetQuestionElapsedTimer();
    phase = 'answered';
    draftText = '';
    syncAttentionCue();
  }

  async function skipQuestion() {
    resetQuestionElapsedTimer();
    draftText = '';
    await loadNextQuestion();
  }

  async function ignoreQuestion() {
    if (!activeQuestion || phase !== 'answering') return;

    const fileName = `${activeQuestion.id}.md`;
    ignoredQuestionFiles = new Set([...ignoredQuestionFiles, fileName]);
    persistIgnoreList();

    resetQuestionElapsedTimer();
    draftText = '';
    await loadNextQuestion();
  }

  function exitQuestion() {
    resetQuestionElapsedTimer();
    draftText = '';
    activeQuestion = null;
    activeQuestionId = null;
    selectedAlternative = null;
    phase = 'cooldown';
    startCooldownTimer();
    syncAttentionCue();
  }

  function openSettings() {
    settingsOpen = true;
  }

  function saveSettings(
    theme: AppSettings['theme'],
    minMinutes: number,
    maxMinutes: number,
    notificationsEnabled: boolean,
    attentionSoundEnabled: boolean,
    attentionSoundIntervalSeconds: number,
    attentionSoundVolume: number,
    questionContentAlternativesRatio: number,
    questionScratchpadRatio: number,
    showQuestionSidebar: boolean,
  ) {
    persistSettings({
      theme,
      minCooldownMinutes: minMinutes,
      maxCooldownMinutes: maxMinutes,
      notificationsEnabled,
      attentionSoundEnabled,
      attentionSoundIntervalSeconds,
      attentionSoundVolume,
      questionContentAlternativesRatio,
      questionScratchpadRatio,
      showQuestionSidebar,
    });
    settingsOpen = false;
    if (phase === 'cooldown') startCooldownTimer();
  }

  function draftChanged(value: string) {
    draftText = value;
  }

  function showTimer() {
    timerVisible = true;
  }

  function hideTimer() {
    timerVisible = false;
  }

  function isAppUnfocused(): boolean {
    return document.visibilityState !== 'visible' || !document.hasFocus();
  }

  async function playAttentionCue() {
    if (!settings.attentionSoundEnabled || phase !== 'answering' || !isAppUnfocused()) {
      return;
    }

    try {
      attentionAudio ??= createAttentionAudio();
      attentionAudio.volume = settings.attentionSoundVolume;
      attentionAudio.currentTime = 0;
      await attentionAudio.play();
    } catch {
      // Browser autoplay restrictions or unavailable audio should not affect PACE.
    }
  }

  function stopAttentionCue() {
    if (attentionCueTimeoutId !== null) {
      clearTimeout(attentionCueTimeoutId);
      attentionCueTimeoutId = null;
    }

    if (attentionCueIntervalId !== null) {
      clearInterval(attentionCueIntervalId);
      attentionCueIntervalId = null;
    }
  }

  function syncAttentionCue() {
    stopAttentionCue();

    if (!settings.attentionSoundEnabled || phase !== 'answering' || !isAppUnfocused()) {
      return;
    }

    attentionCueTimeoutId = setTimeout(() => {
      attentionCueTimeoutId = null;
      void playAttentionCue();
      attentionCueIntervalId = setInterval(() => {
        void playAttentionCue();
      }, Math.max(1, settings.attentionSoundIntervalSeconds) * 1000);
    }, ATTENTION_CUE_INITIAL_DELAY_MS);
  }

  function notifyQuestionReady() {
    if (!settings.notificationsEnabled || typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted' || !isAppUnfocused()) return;

    try {
      new Notification('PACE', { body: 'A question is ready.' });
    } catch {
      // Notifications are optional and must never block the study workflow.
    }
  }

  onMount(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        if (
          typeof parsed.minCooldownMinutes === 'number' &&
          typeof parsed.maxCooldownMinutes === 'number' &&
          parsed.minCooldownMinutes >= 0 &&
          parsed.maxCooldownMinutes >= 0
        ) {
          settings = {
            theme: parsed.theme === 'light' ? 'light' : DEFAULT_SETTINGS.theme,
            minCooldownMinutes: parsed.minCooldownMinutes,
            maxCooldownMinutes: parsed.maxCooldownMinutes,
            notificationsEnabled:
              typeof parsed.notificationsEnabled === 'boolean'
                ? parsed.notificationsEnabled
                : DEFAULT_SETTINGS.notificationsEnabled,
            attentionSoundEnabled:
              typeof parsed.attentionSoundEnabled === 'boolean'
                ? parsed.attentionSoundEnabled
                : DEFAULT_SETTINGS.attentionSoundEnabled,
            attentionSoundIntervalSeconds:
              typeof parsed.attentionSoundIntervalSeconds === 'number' &&
              parsed.attentionSoundIntervalSeconds >= 1 &&
              parsed.attentionSoundIntervalSeconds <= 300
                ? parsed.attentionSoundIntervalSeconds
                : DEFAULT_SETTINGS.attentionSoundIntervalSeconds,
            attentionSoundVolume:
              typeof parsed.attentionSoundVolume === 'number' &&
              parsed.attentionSoundVolume >= 0 &&
              parsed.attentionSoundVolume <= 1
                ? parsed.attentionSoundVolume
                : DEFAULT_SETTINGS.attentionSoundVolume,
            questionContentAlternativesRatio:
              typeof parsed.questionContentAlternativesRatio === 'number' &&
              parsed.questionContentAlternativesRatio >= 0.25 &&
              parsed.questionContentAlternativesRatio <= 6
                ? parsed.questionContentAlternativesRatio
                : DEFAULT_SETTINGS.questionContentAlternativesRatio,
            questionScratchpadRatio:
              typeof parsed.questionScratchpadRatio === 'number' &&
              parsed.questionScratchpadRatio >= 0.25 &&
              parsed.questionScratchpadRatio <= 6
                ? parsed.questionScratchpadRatio
                : DEFAULT_SETTINGS.questionScratchpadRatio,
            showQuestionSidebar:
              typeof parsed.showQuestionSidebar === 'boolean'
                ? parsed.showQuestionSidebar
                : DEFAULT_SETTINGS.showQuestionSidebar,
          };
        }
      } catch {
        localStorage.removeItem(SETTINGS_KEY);
      }
    }

    applyTheme(settings.theme);
    startCooldownTimer();
    void initializeSelectionState();

    const handleFocusChange = () => {
      syncAttentionCue();
    };

    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);
    document.addEventListener('visibilitychange', handleFocusChange);

    return () => {
      stopCooldownTimer();
      resetQuestionElapsedTimer();
      stopAttentionCue();

      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
      document.removeEventListener('visibilitychange', handleFocusChange);
      attentionAudio?.pause();
      attentionAudio = null;
    };
  });
</script>

{#if phase === 'cooldown'}
  <CooldownScreen
    {remainingMs}
    {cooldownPaused}
    {timerVisible}
    availableQuestionCount={availableQuestionCount}
    onSkip={skipCooldown}
    onTogglePause={toggleCooldownPause}
    onPressStart={showTimer}
    onPressEnd={hideTimer}
    onSettings={openSettings}
  />
{:else if activeQuestion && !loadingQuestion}
  <QuestionScreen
    question={activeQuestion}
    selectedAlternative={selectedAlternative}
    answered={phase === 'answered'}
    {draftText}
    elapsedMs={questionElapsedMs}
    elapsedRunning={questionElapsedRunning}
    availableQuestionCount={availableQuestionCount}
    showQuestionSidebar={settings.showQuestionSidebar}
    questionContentAlternativesRatio={settings.questionContentAlternativesRatio}
    questionScratchpadRatio={settings.questionScratchpadRatio}
    onSelect={selectAlternative}
    onAnswer={answerQuestion}
    onQuit={quitQuestion}
    onSkip={skipQuestion}
    onIgnore={ignoreQuestion}
    onExit={exitQuestion}
    onToggleElapsedTimer={toggleQuestionElapsedTimer}
    onSettings={openSettings}
    onDraftInput={draftChanged}
  />
{:else}
  <section class="screen loading-screen">
    <div class="loading-box">
      {#if data.questions.length === 0}
        <div>No local questions found.</div>
        <div class="loading-detail">Add Markdown files to <code>&lt;PACE_CONTENT_DIR&gt;/questions/</code>.</div>
      {:else}
        <div>Loading question…</div>
      {/if}
    </div>
  </section>
{/if}

{#if settingsOpen}
  <SettingsModal
    theme={settings.theme}
    minMinutes={settings.minCooldownMinutes}
    maxMinutes={settings.maxCooldownMinutes}
    notificationsEnabled={settings.notificationsEnabled}
    attentionSoundEnabled={settings.attentionSoundEnabled}
    attentionSoundIntervalSeconds={settings.attentionSoundIntervalSeconds}
    attentionSoundVolume={settings.attentionSoundVolume}
    questionContentAlternativesRatio={settings.questionContentAlternativesRatio}
    questionScratchpadRatio={settings.questionScratchpadRatio}
    showQuestionSidebar={settings.showQuestionSidebar}
    ignoredQuestionCount={ignoredQuestionFiles.size}
    onClearIgnoreList={clearIgnoreList}
    onSave={saveSettings}
    onClose={() => (settingsOpen = false)}
  />
{/if}

<style>
  .loading-screen {
    display: grid;
    place-items: center;
  }

  .loading-box {
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--border-radius);
    padding: 24px;
    text-align: center;
    min-width: min(460px, 80vw);
  }

  .loading-detail {
    margin-top: 12px;
    font-size: 14px;
  }
</style>
