# PACE question template

This is the canonical authoring template and a compact reference for the Markdown features PACE actually parses. Copy the contents of the template block into a new .md file under questions/, then replace the examples and delete optional material that does not belong in the exercise.

The file path becomes the question ID: for example, questions/physics/mechanics/torque.md has the ID physics/mechanics/torque. PACE discovers .md files recursively, so use folders to organize questions.

## Copy-ready template

The example deliberately demonstrates supported syntax. It is a reference, not a finished question: replace the sample statement and keep only the features that the exercise needs.

~~~~markdown
---
category: Physics
tags: Mechanics; Rotational Motion
source: "Replace with book, exam, paper, or other source and question number"
effort: "Single Step"
knowledge: "~10"
answer: 1
---

# Content

<!-- Replace this sample with the actual question statement. HTML comments are not shown in the rendered question. -->

## Problem statement

Write the complete question here. Include the information needed to answer it, but do not reveal the correct alternative in the statement.

Use **bold**, *italic*, ~~strikethrough~~, and `inline code` when useful. Standard Markdown paragraphs, headings below level 1, ordered and unordered lists, blockquotes, links, and fenced code blocks are supported.

Inline math uses dollar signs, for example $a = v^2/r$. Display math uses double dollar signs:

$$
K = \frac{1}{2} I \omega^2
$$

KaTeX's mhchem extension supports chemical notation inside math delimiters, for example $\ce{H2O}$ or $\ce{2H2 + O2 -> 2H2O}$.

A Markdown table can organize givens or comparisons:

| Quantity | Symbol | Example value |
| --- | --- | ---: |
| Speed | $v$ | $4\,\mathrm{m/s}$ |
| Radius | $r$ | $2\,\mathrm{m}$ |

GitHub-Flavored Markdown task lists and strikethrough are supported:

- [x] A condition already established
- [ ] A condition still to determine
- ~~An assumption that does not apply~~

A fenced code block can contain code or literal text:

~~~go
func kineticEnergy(moment, angularSpeed float64) float64 {
    return 0.5 * moment * angularSpeed * angularSpeed
}
~~~

Blockquotes are supported:

> Use a quotation for a supplied excerpt, definition, or other source material.

Reference-style links are supported, for example [this reference][formula-reference]. Ordinary links and automatic links are also supported; for example https://example.com/replace-me.

A footnote can be written like this.[^note]

[^note]: Keep footnote definitions in the content section, before the Alternatives heading.

Images can use a normal URL:

![Replace with a meaningful description of an external diagram](https://example.com/replace-with-diagram.png)

They can also use a reference whose URL is a data URI, which is useful for embedding image bytes directly in the Markdown file:

![Replace with a meaningful description of an embedded diagram][embedded-diagram]

Raw HTML is supported because PACE intentionally parses trusted question content as HTML. Use it only for content you trust; for example, a collapsible detail block:

<details>
<summary>Optional additional context</summary>

Put supplemental context here only when it belongs to the exercise.

</details>

<!-- Author-only notes may be placed in HTML comments. Remove notes that should not remain in the source file. -->

# Alternatives

<!-- Each top-level Markdown block below is one alternative. Keep one option per block; do not put a horizontal rule between options. -->

First alternative. Replace this with option A.

Second alternative. Replace this with option B. This is the correct alternative in this example, so the frontmatter has answer: 1.

Third alternative. Replace this with option C.

Fourth alternative. Add or remove alternatives as needed, and update answer.

[formula-reference]: https://example.com/replace-with-a-source
[embedded-diagram]: data:image/png;base64,REPLACE_WITH_THE_COMPLETE_BASE64_IMAGE_DATA
~~~~

## Rules encoded by the template

- **Frontmatter is YAML and starts at the very top of the file.** Keep the opening and closing **---** delimiters. Do not put a title, blank line, or comment before the opening delimiter.
- **Metadata fields:** **category**, **tags**, **source**, **effort**, **knowledge**, and **answer** are read by PACE. The first five describe the question; **answer** determines the correct alternative. Use a semicolon-separated string for **tags** as shown, matching the format used by your question files. A YAML list is also accepted.
- **The file path supplies the ID.** Do not add an **id** frontmatter field. The path relative to **questions/** is the ID without the **.md** extension.
- **Use the two structural level-one headings exactly as shown:** **# Content** and **# Alternatives**. Matching is case-insensitive. The content section runs between those headings; level-one headings are structural and are not rendered as normal content.
- **The answer index is zero-based.** The first alternative is **answer: 0**, the second is **answer: 1**, and so on. It must be a non-negative integer smaller than the number of alternatives. Every question needs at least one alternative.
- **One alternative equals one top-level Markdown block.** A paragraph is one option; a fenced code block or a blockquote can also be one option. Blank lines separate paragraphs and therefore create separate options. If an option needs multiple lines, keep them inside one block (for example, inside one blockquote), rather than adding a second top-level block.
- **Do not use a level-one heading or a horizontal rule to separate alternatives.** A later level-one heading or a thematic break terminates the alternatives section. Simply place each option after the previous one, separated by a blank line.
- **Reference definitions can be placed at the end of the file.** PACE makes Markdown reference definitions available while rendering content and alternatives. Keep footnote definitions in the content section rather than after the alternatives.
- **Embedded images:** a **data:image/...** URL must contain the complete, real base64 payload to display correctly; the placeholder in this template is illustrative only. The **Copy minimal** action removes embedded image payloads and their references, but keeps ordinary external image URLs.
- **Supported rendering:** standard Markdown; GitHub-Flavored Markdown such as tables, task lists, autolinks, and strikethrough; reference links; inline and display math using **$...$** and **$$...$$**; KaTeX chemistry notation via **\ce{...}** inside math; images; and trusted raw HTML.
- **Comments:** HTML comments are removed from rendered question content, so they can hold author notes. They remain part of the Markdown source unless you delete them.
- **Optional metadata defaults exist, but prefer explicit values.** When omitted, PACE currently defaults **category** to **Uncategorized**, **tags** to an empty list, **source** to **Unknown source**, and **effort** and **knowledge** to **Unknown**. **answer** has no usable default: it must be provided and valid.

Keep each exercise focused. Delete demonstration content that is irrelevant to the actual question, replace example URLs and placeholder image data, and verify the **answer** index after editing the alternatives.
