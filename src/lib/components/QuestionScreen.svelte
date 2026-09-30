<script lang="ts">
  import type { ParsedQuestion } from "$lib/types";

  export let question: ParsedQuestion;
  export let selectedAlternative: number | null = null;
  export let answered = false;
  export let draftText = "";
  export let onSelect: (index: number) => void;
  export let onConfirm: () => void;
  export let onSkip: () => void;
  export let onExit: () => void;
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
</script>

<section class="screen question-screen" aria-label="Question">
  <aside class="metadata-panel">
    <div class="metadata-top">
      <div class="category">{question.category}</div>

      <div class="indicator-row">
        <div class="indicator">Effort: {question.effort}</div>
        <div class="indicator">Knowledge: {question.knowledge}</div>
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
      <button
        class="wire-button confirm-button"
        type="button"
        disabled={!answered && selectedAlternative === null}
        on:click={answered ? onExit : onConfirm}
      >
        {answered ? "Exit" : "Confirm"}
      </button>
      <div class="action-row">
        <button class="wire-button flex" type="button" on:click={onSettings}
          >Settings</button
        >
        <button class="wire-button flex" type="button" on:click={onSkip}
          >Skip</button
        >
      </div>
    </div>
  </aside>

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
</section>
