import { describe, expect, it } from "vitest";
import { parseQuestion, removeEmbeddedImages } from "./questionParser";

function makeQuestion(body: string, frontmatter = "answer: 0"): string {
  return ["---", frontmatter, "---", body].join("\n");
}

describe("parseQuestion", () => {
  it("parses metadata and preserves the supplied question ID", async () => {
    const raw = makeQuestion(
      ["# Content", "", "What is two plus two?", "", "# Alternatives", "", "3", "", "4"].join("\n"),
      [
        "category: Mathematics",
        "tags:",
        "  - Arithmetic",
        "  - Beginner",
        "source: Practice sheet",
        "effort: Single Step",
        "knowledge: 5",
        "answer: 1"
      ].join("\n")
    );

    const question = await parseQuestion(raw, "math/arithmetic/addition");

    expect(question.id).toBe("math/arithmetic/addition");
    expect(question.category).toBe("Mathematics");
    expect(question.tags).toEqual(["Arithmetic", "Beginner"]);
    expect(question.source).toBe("Practice sheet");
    expect(question.effort).toBe("Single Step");
    expect(question.knowledge).toBe("5");
    expect(question.answer).toBe(1);
    expect(question.alternatives).toHaveLength(2);
  });

  it("provides defaults for optional metadata", async () => {
    const question = await parseQuestion(
      makeQuestion(["# Content", "", "A prompt.", "", "# Alternatives", "", "An answer."].join("\n")),
      "defaults"
    );

    expect(question.category).toBe("Uncategorized");
    expect(question.tags).toEqual([]);
    expect(question.source).toBe("Unknown source");
    expect(question.effort).toBe("Unknown");
    expect(question.knowledge).toBe("Unknown");
    expect(question.answer).toBe(0);
  });

  it("renders Markdown formatting in question content and alternatives", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "A **bold** term and a `code` span.",
        "",
        "# Alternatives",
        "",
        "A *formatted* answer.",
        "",
        "A ~~struck-through~~ answer."
      ].join("\n")),
      "markdown"
    );

    expect(question.contentHtml).toContain("<strong>bold</strong>");
    expect(question.contentHtml).toContain("<code>code</code>");
    expect(question.alternatives[0].html).toContain("<em>formatted</em>");
    expect(question.alternatives[1].html).toContain("<del>struck-through</del>");
  });

  it("renders GitHub Flavored Markdown tables", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "| Name | Value |",
        "| --- | --- |",
        "| x | 2 |",
        "",
        "# Alternatives",
        "",
        "2"
      ].join("\n")),
      "gfm-table"
    );

    expect(question.contentHtml).toContain("<table>");
    expect(question.contentHtml).toContain("<th>Name</th>");
    expect(question.contentHtml).toContain("<td>2</td>");
  });

  it("renders inline and display mathematical notation with KaTeX", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "Inline math: $x^2$.",
        "",
        "$$",
        "y = mx + b",
        "$$",
        "",
        "# Alternatives",
        "",
        "$x$"
      ].join("\n")),
      "math"
    );

    expect(question.contentHtml).toContain('class="katex"');
    expect(question.contentHtml).toContain("katex-display");
    expect(question.alternatives[0].html).toContain('class="katex"');
  });

  it("resolves reference-style links in content and alternatives", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "Read the [reference][docs].",
        "",
        "# Alternatives",
        "",
        "See [the documentation][docs].",
        "",
        "[docs]: https://example.com/docs"
      ].join("\n")),
      "reference-links"
    );

    expect(question.contentHtml).toContain('href="https://example.com/docs"');
    expect(question.contentHtml).toContain(">reference</a>");
    expect(question.alternatives[0].html).toContain(">the documentation</a>");
  });

  it("removes HTML documentation comments from rendered content", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "Visible text.",
        "",
        "<!-- private author note -->",
        "",
        "More visible text.",
        "",
        "# Alternatives",
        "",
        "An answer."
      ].join("\n")),
      "comments"
    );

    expect(question.contentHtml).toContain("Visible text.");
    expect(question.contentHtml).toContain("More visible text.");
    expect(question.contentHtml).not.toContain("private author note");
  });

  it("excludes section headings from the rendered question content", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "Question body.",
        "",
        "# Alternatives",
        "",
        "First option.",
        "",
        "Second option."
      ].join("\n")),
      "sections"
    );

    expect(question.contentHtml).toContain("Question body.");
    expect(question.contentHtml).not.toContain("Alternatives");
    expect(question.contentHtml).not.toContain("First option.");
    expect(question.alternatives.map((alternative) => alternative.html)).toEqual([
      "<p>First option.</p>",
      "<p>Second option.</p>"
    ]);
  });

  it("preserves alternative order and accepts the last valid answer index", async () => {
    const question = await parseQuestion(
      makeQuestion([
        "# Content",
        "",
        "Choose the correct option.",
        "",
        "# Alternatives",
        "",
        "First.",
        "",
        "Second.",
        "",
        "Third."
      ].join("\n"), "answer: 2"),
      "ordered-options"
    );

    expect(question.alternatives.map((alternative) => alternative.html)).toEqual([
      "<p>First.</p>",
      "<p>Second.</p>",
      "<p>Third.</p>"
    ]);
    expect(question.answer).toBe(2);
  });

  it("rejects questions without an Alternatives section", async () => {
    await expect(
      parseQuestion(makeQuestion("# Content\n\nNo options here."), "no-options")
    ).rejects.toThrow("Question no-options contains no alternatives");
  });

  it("rejects answer indexes outside the alternatives list", async () => {
    await expect(
      parseQuestion(
        makeQuestion("# Content\n\nPrompt.\n\n# Alternatives\n\nOnly option.", "answer: 1"),
        "answer-out-of-range"
      )
    ).rejects.toThrow("Question answer-out-of-range answer index 1 exceeds alternative count 1");
  });

  it("rejects negative and non-integer answer indexes", async () => {
    await expect(
      parseQuestion(
        makeQuestion("# Content\n\nPrompt.\n\n# Alternatives\n\nOption.", "answer: -1"),
        "negative-answer"
      )
    ).rejects.toThrow("Invalid answer index: -1");

    await expect(
      parseQuestion(
        makeQuestion("# Content\n\nPrompt.\n\n# Alternatives\n\nOption.", "answer: nope"),
        "invalid-answer"
      )
    ).rejects.toThrow("Invalid answer index: nope");
  });
});

describe("removeEmbeddedImages", () => {
  it("removes inline and reference-embedded images while preserving content and external images", () => {
    const source = [
      "---",
      "category: Mathematics",
      "answer: 0",
      "---",
      "# Content",
      "",
      "Keep this text. ![diagram](data:image/png;base64,INLINE_DATA) Keep this too.",
      "",
      "![Referenced diagram][embedded]",
      "",
      "[embedded]: data:image/png;base64,REFERENCE_DATA",
      "",
      "![External diagram](https://example.com/image.png)",
      "",
      "![External reference][external]",
      "",
      "[external]: https://example.com/external.png",
    ].join("\n");

    const minimal = removeEmbeddedImages(source);

    expect(minimal).toContain("category: Mathematics");
    expect(minimal).toContain("Keep this text.");
    expect(minimal).toContain("Keep this too.");
    expect(minimal).not.toContain("INLINE_DATA");
    expect(minimal).not.toContain("REFERENCE_DATA");
    expect(minimal).not.toContain("![Referenced diagram]");
    expect(minimal).not.toContain("[embedded]:");
    expect(minimal).toContain("![External diagram](https://example.com/image.png)");
    expect(minimal).toContain("![External reference][external]");
    expect(minimal).toContain("[external]: https://example.com/external.png");
  });

  it("removes embedded HTML images but leaves HTML images with external URLs", () => {
    const source = [
      "# Content",
      "",
      '<img src="data:image/png;base64,HTML_DATA" alt="embedded">',
      "",
      '<img src="https://example.com/image.png" alt="external">',
    ].join("\n");

    const minimal = removeEmbeddedImages(source);

    expect(minimal).not.toContain("HTML_DATA");
    expect(minimal).not.toContain('alt="embedded"');
    expect(minimal).toContain('<img src="https://example.com/image.png" alt="external">');
  });

  it("does not strip image-looking text inside code blocks", () => {
    const source = [
      "# Content",
      "",
      "```markdown",
      "![example](data:image/png;base64,KEEP_THIS_CODE)",
      '<img src="data:image/png;base64,KEEP_HTML_CODE">',
      "```",
    ].join("\n");

    const minimal = removeEmbeddedImages(source);
    expect(minimal).toContain("KEEP_THIS_CODE");
    expect(minimal).toContain("KEEP_HTML_CODE");
  });
});
