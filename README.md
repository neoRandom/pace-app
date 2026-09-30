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
- **Local Markdown glob** — question files under `src/content/questions/*.md` are bundled by Vite and never require a database.

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

## Adding a question

Create a file under `src/content/questions/`. The filename is the unique question ID.

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
3. The timer is hidden by default; holding **Toggle Cooldown** reveals the current countdown.
4. **Skip cooldown** immediately enters the question state and stops the timer.
5. The next question is selected randomly from questions not seen since the current application cycle began.
6. Selecting an alternative and confirming reveals the correct option and turns **Confirm** into **Exit**.
7. **Skip** loads another question immediately and clears the scratchpad.
8. **Exit** starts a fresh cooldown and returns to the cooldown screen.
9. Confirming an answer also clears the scratchpad.
10. Once every question has been seen, the unseen pool starts a new cycle so the application remains usable.

## Settings

The minimum and maximum cooldown values are stored in `localStorage` and can be changed from the built-in Settings modal.

## Important implementation detail

The parser separates the `# Content` and `# Alternatives` sections from the Markdown AST before rendering. This means alternatives can contain a mixture of paragraphs, code, LaTeX, and images without treating the whole alternatives block as one opaque HTML string.
