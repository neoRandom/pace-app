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
  let sourceActionMessage = "";
  let copyMenuOpen = false;
  let copyDropdownElement: HTMLDivElement;

  async function fetchQuestionSource(minimal = false): Promise<string> {
    const encodedQuestionId = question.id
      .split("/")
      .map(encodeURIComponent)
      .join("/");
    const query = minimal ? "?minimal=true" : "";
    const response = await fetch(`/api/question-source/${encodedQuestionId}${query}`);

    if (!response.ok) {
      throw new Error(`Question source could not be loaded (${response.status})`);
    }

    return response.text();
  }

  async function writeClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();

    if (!copied) throw new Error("Clipboard access is unavailable");
  }

  async function copyQuestionSource(minimal = false) {
    copyMenuOpen = false;
    sourceActionMessage = "";

    try {
      const source = await fetchQuestionSource(minimal);
      await writeClipboard(source);
      sourceActionMessage = minimal ? "Minimal Markdown copied" : "Markdown copied";
    } catch (error) {
      console.error(error);
      sourceActionMessage = "Could not copy Markdown";
    }
  }

  function closeCopyMenuOnOutsideClick(event: MouseEvent) {
    if (copyMenuOpen && !copyDropdownElement?.contains(event.target as Node)) {
      copyMenuOpen = false;
    }
  }

  function handleCopyMenuKeydown(event: KeyboardEvent) {
    if (!copyMenuOpen) return;

    if (event.key === "Escape") {
      copyMenuOpen = false;
      copyDropdownElement?.querySelector<HTMLButtonElement>(".copy-menu-trigger")?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      copyDropdownElement?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
  }

  async function downloadQuestionSource() {
    sourceActionMessage = "";

    try {
      const source = await fetchQuestionSource();
      const blob = new Blob([source], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const filename = question.id.split("/").pop() || "question";

      link.href = url;
      link.download = `${filename}.md`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      sourceActionMessage = "Download started";
    } catch (error) {
      console.error(error);
      sourceActionMessage = "Could not download Markdown";
    }
  }

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

<svelte:window on:click={closeCopyMenuOnOutsideClick} on:keydown={handleCopyMenuKeydown} />

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
      <div class="source-actions">
        <div class="copy-dropdown flex" bind:this={copyDropdownElement}>
          <div class="copy-button-row">
            <button class="wire-button compact copy-main-button" type="button" on:click={() => copyQuestionSource()}>
              Copy
            </button>
            <button
              class="wire-button compact copy-menu-trigger"
              type="button"
              aria-label="Copy options"
              aria-haspopup="menu"
              aria-expanded={copyMenuOpen}
              aria-controls="copy-menu"
              on:click={() => (copyMenuOpen = !copyMenuOpen)}
            >▾</button>
          </div>
          {#if copyMenuOpen}
            <div class="copy-dropdown-menu" id="copy-menu" role="menu" aria-label="Copy options">
              <button class="wire-button compact" type="button" role="menuitem" on:click={() => copyQuestionSource(true)}>
                Copy minimal
              </button>
            </div>
          {/if}
        </div>
        <button class="wire-button compact flex" type="button" on:click={downloadQuestionSource}>
          Download
        </button>
      </div>
      <div class="source-action-message" aria-live="polite">{sourceActionMessage}</div>
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
