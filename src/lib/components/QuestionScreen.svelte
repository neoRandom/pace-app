<script lang="ts">
  import type { ParsedQuestion } from "$lib/types";

  export let question: ParsedQuestion;
  export let selectedAlternative: number | null = null;
  export let answered = false;
  export let draftText = "";
  export let elapsedMs = 0;
  export let elapsedRunning = false;
  export let availableQuestionCount = 0;
  export let showQuestionSidebar = true;
  export let questionContentAlternativesRatio = 3.2 / 1.18;
  export let questionScratchpadRatio = 1.6 / 0.98;
  export let onSelect: (index: number) => void;
  export let onAnswer: () => void;
  export let onQuit: () => void;
  export let onSkip: () => void;
  export let onIgnore: () => void;
  export let onExit: () => void;
  export let onToggleElapsedTimer: () => void;
  export let onSettings: () => void;
  export let onDraftInput: (value: string) => void;

  let scratchpadScrollTop = 0;

  function optionState(index: number): "correct" | "wrong" | "selected" | "" {
    if (!answered) return selectedAlternative === index ? "selected" : "";
    if (index === question.answer) return "correct";
    if (index === selectedAlternative) return "wrong";
    return "";
  }

  function handleScratchpadScroll(event: Event) {
    scratchpadScrollTop = (event.currentTarget as HTMLTextAreaElement)
      .scrollTop;
  }

  function formatElapsedTime(ms: number): string {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }

    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  $: primaryLabel = answered
    ? "Exit"
    : selectedAlternative === null
      ? "Quit without Answering"
      : "Answer";
</script>

<section
  class:sidebar-hidden={!showQuestionSidebar}
  class="screen question-screen"
  style={`--question-content-alternatives-fr: ${questionContentAlternativesRatio}fr; --question-scratchpad-fr: ${questionScratchpadRatio}fr`}
  aria-label="Question"
>
  <aside class="metadata-panel">
    <div class="metadata-top">
      <div class="category-heading">
        <div class="question-filename" title={`${question.id}.md`}>{question.id}.md</div>
        <div class="category">{question.category}</div>
      </div>

      <div class="indicator-row">
        <div class="indicator">Effort: {question.effort}</div>
        <div class="indicator">Knowledge: {question.knowledge}</div>
        <div class="indicator">Available: {availableQuestionCount}</div>
      </div>

      <div class="metadata-label">Tags</div>
      <div class="tag-list">
        {#each question.tags as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>

      <div class="metadata-label source-label">Source</div>
      <div class="source-field">
        <span class="source-text" title={question.source}
          >{question.source}</span
        >
      </div>
    </div>

    <div class="metadata-actions">
      <div class="question-timer" aria-label="Question elapsed timer">
        <output aria-live="off">{formatElapsedTime(elapsedMs)}</output>
        <button class="wire-button compact" type="button" on:click={onToggleElapsedTimer} disabled={answered}>
          {elapsedRunning ? "Pause" : elapsedMs > 0 ? "Resume" : "Start"}
        </button>
      </div>

      <button
        class="wire-button confirm-button"
        type="button"
        on:click={answered ? onExit : selectedAlternative === null ? onQuit : onAnswer}
      >
        {primaryLabel}
      </button>

      <div class="action-row">
        <button class="wire-button flex" type="button" on:click={onSettings}
          >Settings</button
        >
        {#if !answered}
          <button class="wire-button flex" type="button" on:click={onSkip}
            >Skip</button
          >
          <button class="wire-button flex" type="button" on:click={onIgnore}
            >Ignore</button
          >
        {/if}
      </div>
    </div>
  </aside>

  <div class="question-workspace">
    <main class="question-center">
      <article class="content-panel panel">
        <div class="panel-scroll markdown-body" aria-label="Question content">
          {@html question.contentHtml}
        </div>
      </article>

      <div class="alternatives-panel panel" aria-label="Alternatives">
        <div class="alternatives-scroll">
          {#each question.alternatives as alternative, index}
            <div
              class:selected={optionState(index) === "selected"}
              class:correct={optionState(index) === "correct"}
              class:wrong={optionState(index) === "wrong"}
              class="alternative"
              role="button"
              tabindex={answered ? -1 : 0}
              aria-pressed={selectedAlternative === index}
              aria-disabled={answered}
              on:click={() => !answered && onSelect(index)}
              on:keydown={(event) => {
                if (!answered && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onSelect(index);
                }
              }}
            >
              <span class="alternative-index">{index + 1}</span>
              <div class="alternative-content markdown-body">
                {@html alternative.html}
              </div>
              {#if answered && index === question.answer}
                <span class="answer-marker">Correct</span>
              {:else if answered && index === selectedAlternative}
                <span class="answer-marker">Selected</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </main>

    <aside class="scratchpad-panel panel">
      <div class="scratchpad">
        <div
          class="line-indicators"
          style={`transform: translateY(-${scratchpadScrollTop}px)`}
          aria-hidden="true"
        >
          {#each draftText.split("\n") as _}
            <span>•</span>
          {/each}
        </div>

        <textarea
          aria-label="Scratchpad"
          value={draftText}
          placeholder="open text area to draft"
          on:input={(event) =>
            onDraftInput((event.currentTarget as HTMLTextAreaElement).value)}
          on:scroll={handleScratchpadScroll}
          spellcheck="false"
        ></textarea>
      </div>
    </aside>
  </div>
</section>
