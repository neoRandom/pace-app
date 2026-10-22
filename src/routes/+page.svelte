<script lang="ts">
  import { onMount } from 'svelte';
  import CooldownScreen from '$lib/components/CooldownScreen.svelte';
  import QuestionScreen from '$lib/components/QuestionScreen.svelte';
  import SettingsModal from '$lib/components/SettingsModal.svelte';
  import type { AppSettings, ParsedQuestion, TrainingPhase } from '$lib/types';
  import type { PageData } from './$types';
import {
  DEFAULT_QUESTION_CONTENT_ALTERNATIVES_RATIO,
  DEFAULT_QUESTION_SCRATCHPAD_RATIO,
} from '../constants';
import {
  filterQuestions,
  getCategoryFilterOptions,
  getFolderFilterOptions,
  matchesQuestionFilters,
} from '$lib/questionFilters';

  export let data: PageData;

  const SETTINGS_KEY = 'pace-study-settings';
  const IGNORE_QUESTIONS_KEY = 'pace-study-ignore-question-files';
  const QUESTION_SESSION_KEY = 'pace-study-current-question';
  const QUESTION_STATE_KEY = 'pace-study-current-question-state';
  const LEGACY_QUESTION_EPHEMERAL_KEY = 'pace-study-current-question-ephemeral';
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
    questionCategoryFilter: '',
    questionFolderFilter: '',
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

  type PersistedQuestionSession = {
    questionId: string;
    phase: 'answering' | 'answered';
    selectedAlternative: number | null;
  };

  type PersistedQuestionEphemeral = {
    questionId: string;
    draftText: string;
    elapsedMs: number;
    elapsedRunning: boolean;
  };

  let questionElapsedMs = 0;
  let questionElapsedAccumulatedMs = 0;
  let questionElapsedRunning = false;
  let questionElapsedStartedAt = 0;
  let questionElapsedTimerId: ReturnType<typeof setInterval> | null = null;

  let attentionCueIntervalId: ReturnType<typeof setInterval> | null = null;
  let attentionCueTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let attentionAudio: HTMLAudioElement | null = null;

  $: categoryFilterOptions = getCategoryFilterOptions(data.questions);
  $: folderFilterOptions = getFolderFilterOptions(data.questions);
  $: filteredQuestions = filterQuestions(
    data.questions,
    settings.questionCategoryFilter,
    settings.questionFolderFilter,
  );
  $: filteredQuestionCount = filteredQuestions.length;
  $: availableQuestionCount = filteredQuestions.filter(
    (question) => !ignoredQuestionFiles.has(`${question.id}.md`),
  ).length;

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
      persistQuestionEphemeralState();
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
    persistQuestionEphemeralState();
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

  function persistQuestionSession() {
    if (!activeQuestionId || (phase !== 'answering' && phase !== 'answered')) {
      return;
    }

    const session: PersistedQuestionSession = {
      questionId: activeQuestionId,
      phase,
      selectedAlternative,
    };

    localStorage.setItem(QUESTION_SESSION_KEY, JSON.stringify(session));
  }

  function persistQuestionEphemeralState() {
    if (!activeQuestionId || (phase !== 'answering' && phase !== 'answered')) {
      return;
    }

    const state: PersistedQuestionEphemeral = {
      questionId: activeQuestionId,
      draftText,
      elapsedMs: questionElapsedMs,
      elapsedRunning: questionElapsedRunning && phase === 'answering',
    };

    localStorage.setItem(QUESTION_STATE_KEY, JSON.stringify(state));
  }

  function clearQuestionEphemeralState() {
    localStorage.removeItem(QUESTION_STATE_KEY);
    sessionStorage.removeItem(LEGACY_QUESTION_EPHEMERAL_KEY);
    resetQuestionElapsedTimer();
    draftText = '';
  }

  function restoreQuestionEphemeralState(questionId: string) {
    try {
      const raw = localStorage.getItem(QUESTION_STATE_KEY);
      if (!raw) {
        const legacyRaw = sessionStorage.getItem(LEGACY_QUESTION_EPHEMERAL_KEY);
        if (legacyRaw) {
          localStorage.setItem(QUESTION_STATE_KEY, legacyRaw);
          sessionStorage.removeItem(LEGACY_QUESTION_EPHEMERAL_KEY);
        }
      }
      const persistedRaw = localStorage.getItem(QUESTION_STATE_KEY);
      if (!persistedRaw) {
        resetQuestionElapsedTimer();
        draftText = '';
        return;
      }

      const parsed = JSON.parse(persistedRaw) as Partial<PersistedQuestionEphemeral>;
      if (
        parsed.questionId !== questionId ||
        typeof parsed.draftText !== 'string' ||
        typeof parsed.elapsedMs !== 'number' ||
        !Number.isFinite(parsed.elapsedMs) ||
        parsed.elapsedMs < 0 ||
        typeof parsed.elapsedRunning !== 'boolean'
      ) {
        clearQuestionEphemeralState();
        return;
      }

      stopQuestionElapsedTimer();
      questionElapsedMs = parsed.elapsedMs;
      questionElapsedAccumulatedMs = parsed.elapsedMs;
      questionElapsedRunning = false;
      questionElapsedStartedAt = 0;
      draftText = parsed.draftText;

      if (parsed.elapsedRunning && phase === 'answering') {
        startQuestionElapsedTimer();
      }

      persistQuestionEphemeralState();
    } catch {
      clearQuestionEphemeralState();
    }
  }

  function clearQuestionSession() {
    localStorage.removeItem(QUESTION_SESSION_KEY);
  }

  function readQuestionSession(): PersistedQuestionSession | null {
    try {
      const raw = localStorage.getItem(QUESTION_SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Partial<PersistedQuestionSession>;
      if (
        typeof parsed.questionId !== 'string' ||
        parsed.questionId.length === 0 ||
        (parsed.phase !== 'answering' && parsed.phase !== 'answered') ||
        (parsed.selectedAlternative !== null &&
          typeof parsed.selectedAlternative !== 'number')
      ) {
        return null;
      }

      return {
        questionId: parsed.questionId,
        phase: parsed.phase,
        selectedAlternative: parsed.selectedAlternative ?? null,
      };
    } catch {
      return null;
    }
  }

  function clearQuestionSessionAndReturnToCooldown() {
    clearQuestionSession();
    clearQuestionEphemeralState();
    activeQuestion = null;
    activeQuestionId = null;
    selectedAlternative = null;
    phase = 'cooldown';
    loadingQuestion = false;
    if (
      filterQuestions(
        data.questions,
        settings.questionCategoryFilter,
        settings.questionFolderFilter,
      ).length > 0
    ) {
      startCooldownTimer();
    } else {
      stopCooldownTimer();
      remainingMs = 0;
      cooldownPaused = false;
    }
    syncAttentionCue();
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

    const pool = filteredQuestions;
    if (pool.length === 0) {
      clearQuestionSession();
      clearQuestionEphemeralState();
      activeQuestion = null;
      activeQuestionId = null;
      selectedAlternative = null;
      phase = 'cooldown';
      loadingQuestion = false;
      stopCooldownTimer();
      syncAttentionCue();
      return;
    }

    let candidates = pool.filter(
      (question) => !ignoredQuestionFiles.has(`${question.id}.md`),
    );

    if (candidates.length === 0) {
      // Restart the ignore cycle for this filtered pool only. Keep ignored
      // questions from other categories/folders untouched.
      const poolFiles = new Set(pool.map((question) => `${question.id}.md`));
      ignoredQuestionFiles = new Set(
        [...ignoredQuestionFiles].filter((fileName) => !poolFiles.has(fileName)),
      );
      persistIgnoreList();
      candidates = pool;
    }

    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    clearQuestionEphemeralState();
    activeQuestionId = selected.id;
    selectedAlternative = null;
    phase = 'answering';
    loadingQuestion = true;
    persistQuestionSession();
    persistQuestionEphemeralState();

    try {
      const encodedQuestionId = selected.id.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`/api/questions/${encodedQuestionId}`);
      if (response.status === 404) {
        clearQuestionSessionAndReturnToCooldown();
        return;
      }
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

  async function restoreQuestionSession() {
    const session = readQuestionSession();
    if (!session) {
      localStorage.removeItem(QUESTION_SESSION_KEY);
      if (filterQuestions(data.questions, settings.questionCategoryFilter, settings.questionFolderFilter).length > 0) {
        startCooldownTimer();
      } else {
        stopCooldownTimer();
      }
      return;
    }

    const sessionMetadata = data.questions.find((question) => question.id === session.questionId);
    if (
      !sessionMetadata ||
      !matchesQuestionFilters(
        sessionMetadata,
        settings.questionCategoryFilter,
        settings.questionFolderFilter,
      )
    ) {
      clearQuestionSessionAndReturnToCooldown();
      return;
    }

    activeQuestionId = session.questionId;
    selectedAlternative = session.selectedAlternative;
    phase = session.phase;
    restoreQuestionEphemeralState(session.questionId);
    loadingQuestion = true;
    syncAttentionCue();

    try {
      const encodedQuestionId = session.questionId
        .split("/")
        .map(encodeURIComponent)
        .join("/");
      const response = await fetch(`/api/questions/${encodedQuestionId}`);

      if (response.status === 404) {
        clearQuestionSessionAndReturnToCooldown();
        return;
      }

      if (!response.ok) {
        throw new Error(`Question ${session.questionId} could not be restored`);
      }

      activeQuestion = (await response.json()) as ParsedQuestion;

      if (
        selectedAlternative !== null &&
        (selectedAlternative < 0 || selectedAlternative >= activeQuestion.alternatives.length)
      ) {
        selectedAlternative = null;
        persistQuestionSession();
      }
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
    persistQuestionSession();
  }

  function quitQuestion() {
    clearQuestionSession();
    clearQuestionEphemeralState();
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

    pauseQuestionElapsedTimer();
    phase = 'answered';
    persistQuestionSession();
    syncAttentionCue();
  }

  async function skipQuestion() {
    clearQuestionEphemeralState();
    await loadNextQuestion();
  }

  async function ignoreQuestion() {
    if (!activeQuestion || phase !== 'answering') return;

    const fileName = `${activeQuestion.id}.md`;
    ignoredQuestionFiles = new Set([...ignoredQuestionFiles, fileName]);
    persistIgnoreList();

    clearQuestionEphemeralState();
    await loadNextQuestion();
  }

  function exitQuestion() {
    clearQuestionSession();
    clearQuestionEphemeralState();
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
    questionCategoryFilter: string,
    questionFolderFilter: string,
  ) {
    const filterChanged =
      questionCategoryFilter !== settings.questionCategoryFilter ||
      questionFolderFilter !== settings.questionFolderFilter;
    const nextPool = filterQuestions(
      data.questions,
      questionCategoryFilter,
      questionFolderFilter,
    );
    const activeQuestionRemainsAllowed =
      !!activeQuestionId && nextPool.some((question) => question.id === activeQuestionId);

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
      questionCategoryFilter,
      questionFolderFilter,
    });
    settingsOpen = false;

    if (filterChanged && activeQuestionId && !activeQuestionRemainsAllowed) {
      clearQuestionSession();
      clearQuestionEphemeralState();
      activeQuestion = null;
      activeQuestionId = null;
      selectedAlternative = null;
      phase = 'cooldown';
      loadingQuestion = false;
      syncAttentionCue();
    }

    if (phase === 'cooldown') {
      if (nextPool.length > 0) {
        startCooldownTimer();
      } else {
        stopCooldownTimer();
        remainingMs = 0;
        cooldownPaused = false;
      }
    }
  }

  function draftChanged(value: string) {
    draftText = value;
    persistQuestionEphemeralState();
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
            questionCategoryFilter:
              typeof parsed.questionCategoryFilter === 'string' &&
              (parsed.questionCategoryFilter === '' ||
                categoryFilterOptions.some((option) => option.value === parsed.questionCategoryFilter))
                ? parsed.questionCategoryFilter
                : DEFAULT_SETTINGS.questionCategoryFilter,
            questionFolderFilter:
              typeof parsed.questionFolderFilter === 'string' &&
              (parsed.questionFolderFilter === '' ||
                folderFilterOptions.some((option) => option.value === parsed.questionFolderFilter))
                ? parsed.questionFolderFilter
                : DEFAULT_SETTINGS.questionFolderFilter,
          };
        }
      } catch {
        localStorage.removeItem(SETTINGS_KEY);
      }
    }

    applyTheme(settings.theme);
    void initializeSelectionState();
    void restoreQuestionSession();

    const handleFocusChange = () => {
      syncAttentionCue();
    };

    const handlePageHide = () => {
      persistQuestionEphemeralState();
    };

    window.addEventListener('focus', handleFocusChange);
    window.addEventListener('blur', handleFocusChange);
    document.addEventListener('visibilitychange', handleFocusChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      persistQuestionEphemeralState();
      stopCooldownTimer();
      resetQuestionElapsedTimer();
      stopAttentionCue();

      window.removeEventListener('focus', handleFocusChange);
      window.removeEventListener('blur', handleFocusChange);
      document.removeEventListener('visibilitychange', handleFocusChange);
      window.removeEventListener('pagehide', handlePageHide);
      attentionAudio?.pause();
      attentionAudio = null;
    };
  });
</script>

{#if data.questions.length === 0}
  <section class="screen loading-screen">
    <div class="loading-box">
      <div>No local questions found.</div>
      <div class="loading-detail">Add Markdown files to <code>&lt;PACE_CONTENT_DIR&gt;/questions/</code>.</div>
    </div>
  </section>
{:else if filteredQuestionCount === 0}
  <section class="screen loading-screen">
    <div class="loading-box">
      <div class="empty-state-title">No questions match these filters.</div>
      <div class="loading-detail">
        PACE scanned {data.questions.length} question files. Change the category or folder filters to include more questions.
      </div>
      <button class="wire-button empty-state-button" type="button" on:click={openSettings}>
        Adjust filters
      </button>
    </div>
  </section>
{:else if phase === 'cooldown'}
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
      <div>Loading question…</div>
      {#if activeQuestionId}
        <div class="loading-question-filename">{activeQuestionId}.md</div>
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
    ignoredQuestionCount={filteredQuestionCount - availableQuestionCount}
    questionMetadata={data.questions}
    questionCategoryFilter={settings.questionCategoryFilter}
    questionFolderFilter={settings.questionFolderFilter}
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
    line-height: 1.5;
  }

  .empty-state-title {
    font-size: 18px;
    font-weight: bold;
  }

  .empty-state-button {
    margin-top: 18px;
  }

  .loading-question-filename {
    margin-top: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: min(70vw, 720px);
    font-size: 12px;
    opacity: 0.55;
  }

</style>
