# PACE App

Periodic Asynchronous Consistent Exercise Application

A local Markdown-driven study application built with SvelteKit + TypeScript.

The visual design follows the supplied wireframes: dark background, monochrome borders, three-panel question layout, and a dedicated cooldown screen.

## Architecture

- **SvelteKit + TypeScript** — application shell, routing, server endpoints, UI state.
- **gray-matter** — parses YAML frontmatter.
- **unified / remark** — parses Markdown, GFM and LaTeX math.
- **remark-rehype + rehype-raw** — converts Markdown to HTML while retaining trusted inline HTML.
- **rehype-katex** — renders `$...$` and `$$...$$` math.
- **Local Markdown files** — question files are discovered recursively under `<PACE_CONTENT_DIR>/questions/` and never require a database.

Question Markdown is treated as **trusted local content**, because raw inline HTML is intentionally supported.

## Run

```bash
npm install
npm run dev
```

Then open the local Vite development URL.

For a production build:

```bash
npm run check
npm run build
npm run preview
```


## Tests

Run the automated unit tests with:

```bash
npm install
npm test
```

The test suite exercises question parsing, frontmatter metadata and defaults, Markdown/GFM rendering, inline and display math, reference links, comment removal, alternative ordering, and invalid or missing answers. `npm test` runs Vitest once after synchronizing SvelteKit's generated types and aliases.

## Content directory

The content folder is configured with the `PACE_CONTENT_DIR` environment variable. Relative paths are resolved from the project root. The default is `src/content`, preserving the standard project layout.

Questions are discovered recursively from `PACE_CONTENT_DIR/questions/`, so subdirectories are supported. All files ending in `.md` (case-insensitive) are considered question files. When questions are nested, their relative path inside `questions/` becomes their question ID; the same relative path is used by the client ignore list.

Example `.env`:

```dotenv
PACE_CONTENT_DIR=content
```

With that value, PACE reads questions from `content/questions/**/*.md`.

## Adding a question

Create a file under `<PACE_CONTENT_DIR>/questions/`. The path relative to `questions/` is the unique question ID. For example, `src/content/questions/mathematics/algebra/pythagorean.md` is identified as `mathematics/algebra/pythagorean`.

```md
---
category: Mathematics
tags:
  - Trigonometry
  - Beginner-friendly
source: Question 42 - Green Notebook - ENEM 2026
effort: Single Step
knowledge: ~10
answer: 1
---

# Content

Question text with inline math such as $\sin(30^\circ)$.

![Required diagram][diagram]

# Alternatives

First alternative

Second alternative

[diagram]: data:image/png;base64,iVBORw0KGgo...
```

`answer` is zero-based and refers to the position in the alternatives list.

## Runtime behavior

1. Startup enters the cooldown state.
2. A random duration is generated between the configured minimum and maximum minutes.
3. The cooldown timer is hidden by default; holding **Show Timer** reveals the current countdown.
4. **Pause** freezes the cooldown at its current remaining time and **Resume** continues from that exact value.
5. **Skip cooldown** immediately enters the question state and discards the cooldown timer.
6. Questions are randomly selected from the current ignore cycle. Displaying a question does **not** consume it.
7. **Quit without Answering** returns to cooldown without changing the question's consumption state.
8. **Skip** loads another question without consuming the current question.
9. The current question screen is restored after a page refresh or server restart and remains active until the user quits/exits it; if the server returns 404 for that question, PACE clears the session and returns to cooldown. The scratchpad and elapsed timer state are also restored across refreshes and server restarts within the current browser tab, but are discarded when the question is left.
10. **Ignore** consumes the current question for the current cycle and immediately loads another question.
11. After an alternative is selected, the primary button becomes **Answer**. Answering consumes the current question, reveals the correct option, and changes the primary button to **Exit**.
12. **Exit** returns to cooldown without changing the answered question's consumption state.
13. Once every question is ignored or answered, the ignore list is cleared and a new selection cycle begins.
14. The ignore list is stored in the client browser only and contains question filenames. It persists across browser reloads and server process restarts until it is exhausted automatically or manually cleared in Settings.
15. The question screen shows an elapsed timer. It starts at `00:00`, is paused by default, and pauses while preserving its elapsed value when an answer is submitted. Its value and running state survive page refreshes and server restarts within the current browser tab, but are discarded when leaving the question. It is never sent to the server. The scratchpad follows the same lifecycle and survives refreshes/server restarts within the current tab.
16. The current number of available questions is shown unobtrusively as `total questions - questions in the ignore list`.
17. When an automatic cooldown reaches zero, an optional browser notification may be shown while PACE is not focused or visible. Notifications are enabled by default and depend on browser support and permission.
18. While an unresolved question is open and PACE is not focused, an optional periodic attention sound may play. It is enabled by default, uses the replaceable file `static/audio/attention-cue.wav`, and can be configured by repeat interval and volume. Browser autoplay/background throttling restrictions are handled gracefully.

## Settings

The theme, minimum and maximum cooldown values, browser notification preference, background attention-sound preference, attention-sound repeat interval, attention-sound volume, question-layout ratios, left-column visibility, and question filters are stored in `localStorage`. Dark mode is the default theme; enabling **Light mode** switches to the light theme.

**Question filters** are built from the current question inventory rather than a hard-coded list: category names come from question frontmatter, and folder names come from the question's relative path. Counts are shown beside the options. Folder filters include nested subfolders, and category and folder filters can be combined. The available-question count and random selection pool use the active filters.

The question layout provides independent client-side ratios for **question content : alternatives** and **question section : scratchpad**. **Reset layout defaults** restores the proportions used by the default desktop layout. On narrow screens, the application switches to its stacked responsive layout; the left question column can also be hidden entirely through **Show question left column**.

The default attention cue is loaded from `static/audio/attention-cue.wav`. Replace that file with another audio file using the same path to customize the sound without changing application code.

Browser notification permission is requested from a settings interaction rather than from page load, and unavailable or denied notification support does not affect the core workflow.

## Important implementation detail

The parser separates the `# Content` and `# Alternatives` sections from the Markdown AST before rendering. This means alternatives can contain a mixture of paragraphs, code, LaTeX, and images without treating the whole alternatives block as one opaque HTML string.
