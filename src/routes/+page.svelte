<script lang="ts">
  import { onMount } from 'svelte';
  import CooldownScreen from '$lib/components/CooldownScreen.svelte';
  import QuestionScreen from '$lib/components/QuestionScreen.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import type { AppSettings, ParsedQuestion, QuestionMetadata, TrainingPhase } from '$lib/types';
  import type { PageData } from './$types';

  export let data: PageData;

  const SETTINGS_KEY = 'pace-study-settings';
  const SELECTED_QUESTIONS_KEY = 'pace-study-selected-question-files';
  const SERVER_INSTANCE_KEY = 'pace-study-server-instance';
  const DEFAULT_SETTINGS: AppSettings = {
    minCooldownMinutes: 1,
    maxCooldownMinutes: 3
  };

  let settings: AppSettings = { ...DEFAULT_SETTINGS };
  let phase: TrainingPhase = 'cooldown';
  let remainingMs = 0;
  let cooldownEndsAt = 0;
  let timerId: ReturnType<typeof setInterval> | null = null;
  let timerVisible = false;
  let settingsOpen = false;
  let activeQuestion: ParsedQuestion | null = null;
  let activeQuestionId: string | null = null;
  let selectedAlternative: number | null = null;
  let draftText = '';
  let selectedQuestionFiles = new Set<string>();
  let selectionStateInitialized = false;
  let loadingQuestion = false;

  function persistSettings(next: AppSettings) {
    settings = next;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }

  function randomCooldownMs(): number {
    const min = Math.max(0, Math.min(settings.minCooldownMinutes, settings.maxCooldownMinutes));
    const max = Math.max(0, Math.max(settings.minCooldownMinutes, settings.maxCooldownMinutes));
    const minutes = min + Math.random() * (max - min);
    return Math.round(minutes * 60 * 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    remainingMs = randomCooldownMs();
    cooldownEndsAt = Date.now() + remainingMs;

    if (remainingMs <= 0) {
      void finishCooldown();
      return;
    }

    timerId = setInterval(() => {
      remainingMs = Math.max(0, cooldownEndsAt - Date.now());
      if (remainingMs <= 0) {
        stopTimer();
        void finishCooldown();
      }
    }, 250);
  }

  function questionFileName(questionId: string): string {
    return `${questionId}.md`;
  }

  function persistSelectedQuestionFiles() {
    localStorage.setItem(
      SELECTED_QUESTIONS_KEY,
      JSON.stringify([...selectedQuestionFiles]),
    );
  }

  async function initializeSelectionState() {
    if (selectionStateInitialized) return;

    const response = await fetch('/api/questions/instance');
    if (!response.ok) throw new Error('Failed to load server instance');

    const { instanceId } = (await response.json()) as { instanceId: string };
    const previousInstanceId = localStorage.getItem(SERVER_INSTANCE_KEY);
    const availableFiles = new Set(
      data.questions.map((question) => questionFileName(question.id)),
    );

    if (previousInstanceId !== instanceId) {
      selectedQuestionFiles = new Set();
    } else {
      try {
        const raw = localStorage.getItem(SELECTED_QUESTIONS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (Array.isArray(parsed)) {
          selectedQuestionFiles = new Set(
            parsed.filter(
              (fileName): fileName is string =>
                typeof fileName === 'string' && availableFiles.has(fileName),
            ),
          );
        } else {
          selectedQuestionFiles = new Set();
        }
      } catch {
        selectedQuestionFiles = new Set();
      }
    }

    localStorage.setItem(SERVER_INSTANCE_KEY, instanceId);
    persistSelectedQuestionFiles();
    selectionStateInitialized = true;
  }

  async function finishCooldown() {
    stopTimer();
    timerVisible = false;
    await loadNextQuestion();
  }

  async function skipCooldown() {
    await finishCooldown();
  }

  async function loadNextQuestion() {
    await initializeSelectionState();

    const pool = data.questions;
    if (pool.length === 0) {
      activeQuestion = null;
      activeQuestionId = null;
      phase = 'answering';
      return;
    }

    let candidates = pool.filter(
      (question) => !selectedQuestionFiles.has(questionFileName(question.id)),
    );

    if (candidates.length === 0) {
      selectedQuestionFiles = new Set();
      persistSelectedQuestionFiles();
      candidates = pool;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];
    selectedQuestionFiles.add(questionFileName(selected.id));
    persistSelectedQuestionFiles();

    activeQuestionId = selected.id;
    selectedAlternative = null;
    draftText = '';
    phase = 'answering';
    loadingQuestion = true;

    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(selected.id)}`);
      if (!response.ok) throw new Error(`Question ${selected.id} could not be loaded`);
      activeQuestion = (await response.json()) as ParsedQuestion;
    } catch (error) {
      console.error(error);
      activeQuestion = null;
    } finally {
      loadingQuestion = false;
    }
  }

  function selectAlternative(index: number) {
    if (phase !== 'answering') return;
    selectedAlternative = index;
  }

  function confirmAnswer() {
    if (!activeQuestion || selectedAlternative === null || phase !== 'answering') return;
    phase = 'answered';
    draftText = '';
  }

  async function skipQuestion() {
    draftText = '';
    await loadNextQuestion();
  }

  function exitQuestion() {
    draftText = '';
    activeQuestion = null;
    activeQuestionId = null;
    selectedAlternative = null;
    phase = 'cooldown';
    startTimer();
  }

  function openSettings() {
    settingsOpen = true;
  }

  function saveSettings(minMinutes: number, maxMinutes: number) {
    persistSettings({ minCooldownMinutes: minMinutes, maxCooldownMinutes: maxMinutes });
    settingsOpen = false;
    if (phase === 'cooldown') startTimer();
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
            minCooldownMinutes: parsed.minCooldownMinutes,
            maxCooldownMinutes: parsed.maxCooldownMinutes
          };
        }
      } catch {
        localStorage.removeItem(SETTINGS_KEY);
      }
    }

    startTimer();

    return () => stopTimer();
  });
</script>

{#if phase === 'cooldown'}
  <CooldownScreen
    {remainingMs}
    {timerVisible}
    onSkip={skipCooldown}
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
    onSelect={selectAlternative}
    onConfirm={confirmAnswer}
    onSkip={skipQuestion}
    onExit={exitQuestion}
    onSettings={openSettings}
    onDraftInput={draftChanged}
  />
{:else}
  <section class="screen loading-screen">
    <div class="loading-box">
      {#if data.questions.length === 0}
        <div>No local questions found.</div>
        <div class="loading-detail">Add Markdown files to <code>src/content/questions/</code>.</div>
      {:else}
        <div>Loading question…</div>
      {/if}
    </div>
  </section>
{/if}

{#if settingsOpen}
  <SettingsModal
    minMinutes={settings.minCooldownMinutes}
    maxMinutes={settings.maxCooldownMinutes}
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
    border: 3px solid #cfcfce;
    padding: 24px;
    text-align: center;
    min-width: min(460px, 80vw);
  }

  .loading-detail {
    margin-top: 12px;
    font-size: 14px;
  }
</style>
