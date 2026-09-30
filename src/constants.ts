export const questionPrompt = `# Task

Convert a multiple-choice exam (for example a university entrance exam) into Markdown files, one file per question, in the format defined below. This is transcription, not creation: never write, alter, or invent questions.

# Output protocol

- For each converted question, output the file name on a plain line, then the file inside a fence of four backticks.
- Outside the fences, only file-name lines and the final report are allowed. No introduction, no commentary, no separate answer key.
- If the output limit stops you, end after the last complete file. When asked to continue, resume with the next question of the document.
- After the last question of the document, print the report (see "Report").

# Which questions to convert

Convert every question that the format can express: a stem, a list of alternatives, and exactly one correct alternative. Never skip a question because it is long, has images or tables, shares a text with other questions, or looks hard.

Do not convert, and list in the report, questions that:
- have no alternatives (written or discursive);
- have more than one correct alternative, or an answer given as a sum;
- are annulled in the answer key, or have no valid single answer there;
- have missing or unreadable alternatives;
- depend on an image you cannot read.

Variants and order:
- If the document contains several variants of the same exam (for example notebooks of different colors), convert each variant's questions separately.
- If the same question number appears in several language options (for example English and Spanish foreign-language questions), convert each option separately. \`category\` is that language, the option goes in \`source\` right after the question number, and the answer comes from that option's key column.
- Follow the order of the document.

# Transcription rules

## Fidelity
- Copy the stem, supporting texts, and alternatives exactly. Do not paraphrase, summarize, translate, correct, complete, or reorder anything, and do not remove alternatives. If something in the source looks wrong, keep it.
- Undo only PDF layout artifacts: rejoin lines wrapped by the layout into paragraphs, rejoin words hyphenated at line ends, and read multi-column pages in the correct order.

## Remove
Question numbers and question headings (such as "QUESTÃO 12"), alternative letters (A, B, C…), headers that point to other questions (such as "Texto para as questões 12 e 13"), page headers and footers, page numbers, watermarks, exam instructions, and answer-sheet marks.

## Keep
- Labels that identify supporting material ("TEXTO I", "TEXTO II", "Figura 1", "Quadro 2" and similar), because stems and alternatives refer to them. Write each as its own paragraph immediately before its material, as printed.
- Labels of items inside the stem (I., II., III., (a), (b)).
- Glossary notes, captions, and source citations that belong to a text.

## Stand-alone files
Each file must stand alone. If a question uses a text, figure, or data shared with other questions, copy that shared material into every question that uses it, before the stem.

## Supporting texts
Reproduce supporting texts as blockquotes and keep the citation line:

\`\`\`\`
> Primeira linha do trecho\\
> segunda linha do trecho
>
> SOBRENOME, Nome. *Título*. Cidade: Editora, 2020.
\`\`\`\`

- End a line with a backslash only where the source has a real line break (verse, lyrics, script). Rejoin the lines of prose.
- Inside a blockquote, separate paragraphs with a line containing only \`>\`. A blank line without \`>\` ends the blockquote. Outside blockquotes, a blank line separates paragraphs.

## Tables and code
- Reproduce tables as Markdown tables.
- Reproduce code as fenced blocks with a language tag.

## Escaping
Write a literal dollar sign as \`\\$\` (for example \`R\\$ 12,00\`), because \`$\` opens math. Also escape any other character that Markdown would interpret when it is literal in the source (\`*\`, \`_\`, \`#\`, \`>\`, \`|\` inside table cells, and \`1.\` or \`-\` at the start of a line). Escaping is not a change to the text.

## Math and chemistry
- Math is \`$...$\` inline and \`$$...$$\` as a block.
- Use math for equations, inequalities, fractions, roots, exponents or subscripts on variables, Greek letters, mathematical operators and symbols, scientific notation with a power of ten, and any variable or expression mentioned in running text (\`$x$\`, \`$f(x) = 2x + 1$\`).
- Keep plain text for words and for numbers, including numbers with units and percentages, using Unicode characters (12 m³, 5 km/h, 30%, 10 °C, 13,5).
- Inside math, write units with \`\\text{...}\` and a decimal comma as \`{,}\` (\`$13{,}5$\`), otherwise it renders with a space after the comma.
- Chemistry: every formula, ion, and reaction uses \`\\ce{...}\`, including in running text and in alternatives (\`\\ce{H2SO4}\`, \`\\ce{2H2 + O2 -> 2H2O}\`). Names written in words stay plain.

## Images
You cannot embed image data. For every figure, chart, map, photo, or drawing, write a reference and put one definition line per image at the bottom of the file:

\`\`\`\`
![Gráfico de barras da chuva mensal, em mm, de janeiro a abril: 80, 120, 60 e 40. A barra mais alta é a de fevereiro.][image1]

[image1]: PLACEHOLDER
\`\`\`\`

- The label is a complete textual equivalent, on a single line, in the document's language: every value, axis, trend, label, and relationship needed to answer. The question must be answerable from the label alone.
- Number images inside each file: image1, image2, and so on. A person will attach the image data later.
- Escape brackets inside labels: \`\\[0, 1)\`.
- An image inside an alternative uses the same form, as the whole alternative.

# File format

The file starts with \`---\`. Structure: front matter, then \`# Content\`, then \`# Alternatives\`, then the image definition lines if any. Keep the field names and the two headings exactly as written. \`# Content\` may contain anything Markdown supports. No HTML comments anywhere in the file.

Language: field names, headings, and front matter values are in English. Question text (stem, supporting texts, alternatives, image labels) stays in the document's language.

Conventions:
- Names in front matter are written in full, except acronyms (Mathematics, not Math).
- Meaningful words are capitalized (Green Notebook, not green notebook).
- Front matter is YAML. Wrap a value in double quotes when it contains \`:\` or \`#\`, or starts with one of \`[ ] { } * & ! | > ' " % @\` or a backtick, and escape \`"\` and \`\\\` inside it with a backslash. (An unquoted value cannot contain \`: \`, and \` #\` starts a comment that cuts the value.)

## Alternatives
- One alternative per printed alternative, in the printed order, with no numbering and no list markers.
- Separate alternatives with one blank line. An alternative contains no blank line, except inside a fenced code block.
- An alternative is a paragraph (inline code and inline math allowed), a Markdown table, a fenced code block, or an image.
- If the alternatives are the rows of one printed table, write each alternative as its own table: the header row followed by that alternative's row (empty header cells if the printed table has no header).

## Fields

category: A single subject name, e.g. Mathematics; Portuguese; English; Chemistry; Physics; Biology. When the exam groups questions under a broad area (such as Languages or Natural Sciences), use the specific subject of the question.

tags: A list of terms about the question, separated by ";", e.g. Trigonometry; Infamous (known to be hard); Beginner-friendly; Multidisciplinary.

source: Where the question comes from, as precise as possible, ordered specific → general, separated by " - ". e.g. Question 3 - Green Notebook - 1st Day - ENEM 2026. Use only what the document shows: question number, language option, notebook or booklet, day or phase, exam name, year. Omit any part that is not printed. Keep proper names (exam and institution names) as printed.

effort: The work needed to execute the solution, assuming every prerequisite is already held. Work = number of steps × size of each step. Examples: Single Step, Minimal, Brief, Medium, Lengthy (few steps, each large), Verbose (many steps, each small), Exhaustive (many steps, each large). Any label that describes the work is accepted.

knowledge: The number of concepts that must be learned to hold every prerequisite of the question, counted as the transitive closure (a concept that needs another to be understood brings it along), needed to solve it and to understand why the answer is correct. Not counted: everything the question prints (supporting texts, data, figures, definitions), reading its language, general reasoning.
- None: the count is 0 (the question itself gives all the information required).
- Otherwise round the count to the nearest power of 10 on a log scale: ~10 (1 to 30), ~100 (30 to 300), ~1000 (300 to 3000), ~10000 (3000 to 30000), and so on. A count of 1 or more is never None.

answer: Zero-based index of the correct alternative, counted by position in the printed order, not by any label. The first alternative is 0; if the correct alternative is the third one, answer: 2. A is 0, B is 1, C is 2, D is 3, E is 4.

## Answer source
- If the document (or another attached document) contains an answer key, use it. Never override it with your own solution.
- If there is no answer key, solve the question yourself and use your solution.
- If a key exists and your own solution disagrees with it, keep the key and list the question in the report.

## Judging effort and knowledge
Judge them separately, each only from its own definition; do not derive one from the other. Solve each question privately to judge them, and work out the concept closure privately; do not print either.

knowledge is the set of prerequisites. effort is the work done once that set is held. Neither value predicts the other.

knowledge anchors (closure figures are estimates):
- Logic puzzle with all rules stated in the text: closure is 0, so None.
- sin 30°: closure is angle, right triangle, side ratio, sine, special-angle value, about 5-10, so ~10.
- 17×23×19 by hand: closure is place value, carry addition, multiplication table, multi-digit multiplication, about 5, so ~10.
- Ethanol from sugarcane, interdisciplinary: closure is fermentation (about 10), sugarcane economy (about 5-10), land use (about 5), about 25 in total, so ~10.
- Which symmetry corresponds to conserved energy?: closure is symmetry, action, Lagrangian, calculus of variations, time translation, Noether's theorem and their prerequisites, about 50-100, so ~100.

effort anchors:
- Logic puzzle with all rules stated in the text: Depends on the puzzle (e.g. Medium).
- sin 30°: Single Step (one recall of the special-angle value).
- 17×23×19 by hand: Verbose (many steps, each small: partial products and carries).
- Ethanol from sugarcane, interdisciplinary: Minimal.
- Which symmetry corresponds to conserved energy?: Single Step (name the symmetry paired with energy conservation).

Independence:
- 17×23×19 by hand: knowledge ~10, effort Verbose. Little to know, much to do.
- Which symmetry corresponds to conserved energy?: knowledge ~100, effort Single Step. Much to know, little to do.

# File names

The file name is the question ID: a descriptive lowercase ASCII kebab-case name of 2 to 6 words (no accents) that describes the question's subject, then a hyphen, then a sequence number, then .md.
- The sequence number is decimal with at least 3 digits, starts at 001, and increases by 1 for each file in output order, continuing across variants and across continuation replies.
- Never write hash-like identifiers (hexadecimal strings, UUIDs, random-looking strings). Those must be generated by an algorithm, not by you.
- If you can generate hash-like identifiers using an algorithm, always use it instead of a number sequence.

# Example

consumo-medio-agua-tabela-007.md
\`\`\`\`
---
category: Mathematics
tags: Statistics; Arithmetic Mean; Tables
source: Question 7 - Yellow Notebook - 1st Day - Example Exam 2025
effort: Minimal
knowledge: ~10
answer: 2
---

# Content

O quadro mostra o consumo de água de uma residência em três meses consecutivos.

| Mês | Consumo (m³) |
|---|---|
| Janeiro | 12 |
| Fevereiro | 15 |
| Março | 18 |

Qual foi o consumo médio mensal, em m³, nesse período?

# Alternatives

12

13,5

15

16,5

18
\`\`\`\`

# Report

After the last question of the document, print plain text using only these line forms. Omit a form with no entries, except the last, which is always printed as the final line.
- skipped: <source> - <reason>
- answer key: none found, all answers solved by me
- answer solved without a key: <file name> (only when a key exists for part of the exam)
- key disagrees with my solution: <file name> - key <index>, mine <index>
- converted: <N>, skipped: <M>

# Checklist before writing each file

1. The text is identical to the source apart from the allowed layout fixes and escaping.
2. The alternatives are in printed order, unnumbered, separated by blank lines, and \`answer\` points to the correct one, counted from 0.
3. Shared material and the labels the stem refers to are in the file.
4. Every image has a complete single-line label and a \`PLACEHOLDER\` line.
5. Every literal \`$\` is escaped, and front matter values are quoted where required.
6. The file name is unique in the output.`
