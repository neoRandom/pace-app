import matter from "gray-matter";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import katex from "katex";
import rehypeStringify from "rehype-stringify";
import "katex/contrib/mhchem";
import type { Root, RootContent, Node } from "mdast";
import type { ParsedQuestion, QuestionMetadata } from "$lib/types";

type Frontmatter = Partial<{
  category: unknown;
  tags: unknown;
  source: unknown;
  effort: unknown;
  knowledge: unknown;
  answer: unknown;
}>;

function asString(value: unknown, fallback = ""): string {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((tag) => asString(tag)).filter(Boolean);
  return asString(value)
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseAnswer(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Invalid answer index: ${String(value)}`);
  }
  return parsed;
}

function textOf(node: Node): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((child) => textOf(child as Node)).join("");
  }
  return "";
}

function isH1(node: Node, title: string): boolean {
  return (
    node.type === "heading" &&
    node.depth === 1 &&
    textOf(node).trim().toLowerCase() === title.toLowerCase()
  );
}

function stripDocumentationComments(root: Root): void {
  const visit = (nodes: RootContent[]): void => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      if (node.type === "html" && /^\s*<!--/.test(node.value)) {
        nodes.splice(index, 1);
        continue;
      }
      if ("children" in node && Array.isArray(node.children)) {
        visit(node.children as RootContent[]);
      }
    }
  };
  visit(root.children);
}

function renderMathNodes(root: Root): void {
  const visit = (nodes: RootContent[]): void => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];

      if (node.type === "inlineMath" || node.type === "math") {
        nodes[index] = {
          type: "html",
          value: katex.renderToString(node.value, {
            displayMode: node.type === "math",
            throwOnError: false,
          }),
        };

        continue;
      }

      if ("children" in node && Array.isArray(node.children)) {
        visit(node.children as RootContent[]);
      }
    }
  };

  visit(root.children);
}

const markdownProcessor = unified()
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

function extractDefinitions(root: Root): RootContent[] {
  return root.children.filter((node) => node.type === "definition");
}

async function renderNodes(
  nodes: RootContent[],
  definitions: RootContent[] = [],
): Promise<string> {
  const root: Root = {
    type: "root",
    children: [...definitions, ...nodes],
  };

  renderMathNodes(root);

  const tree = await markdownProcessor.run(root);

  return String(markdownProcessor.stringify(tree));
}

function findSection(root: Root, title: string): number {
  return root.children.findIndex((node) => isH1(node, title));
}

function extractAlternatives(root: Root, headingIndex: number): RootContent[] {
  const alternatives: RootContent[] = [];

  for (let index = headingIndex + 1; index < root.children.length; index += 1) {
    const node = root.children[index];

    if (node.type === "thematicBreak" || (node.type === "heading" && node.depth === 1)) {
      break;
    }

    // Reference definitions are document metadata, not alternatives.
    if (node.type === "definition") continue;

    alternatives.push(node);
  }

  return alternatives;
}

function extractContent(
  root: Root,
  contentHeading: number,
  alternativesHeading: number,
): RootContent[] {
  const start = contentHeading >= 0 ? contentHeading + 1 : 0;
  const end =
    alternativesHeading >= 0 ? alternativesHeading : root.children.length;
  return root.children
    .slice(start, end)
    .filter((node) => node.type !== "heading" || node.depth !== 1);
}

export async function parseQuestion(
  raw: string,
  id: string,
): Promise<ParsedQuestion> {
  const parsed = matter(raw);
  const data = parsed.data as Frontmatter;
  const metadata: QuestionMetadata = {
    id,
    category: asString(data.category, "Uncategorized"),
    tags: parseTags(data.tags),
    source: asString(data.source, "Unknown source"),
    effort: asString(data.effort, "Unknown"),
    knowledge: asString(data.knowledge, "Unknown"),
    answer: parseAnswer(data.answer),
  };

  const root = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .parse(parsed.content) as Root;
  stripDocumentationComments(root);

  const definitions = extractDefinitions(root);

  const contentHeading = findSection(root, "Content");
  const alternativesHeading = findSection(root, "Alternatives");
  const contentNodes = extractContent(
    root,
    contentHeading,
    alternativesHeading,
  );
  const alternativeItems =
    alternativesHeading >= 0
      ? extractAlternatives(root, alternativesHeading)
      : [];

  if (alternativeItems.length === 0)
    throw new Error(`Question ${id} contains no alternatives`);
  if (metadata.answer >= alternativeItems.length) {
    throw new Error(
      `Question ${id} answer index ${metadata.answer} exceeds alternative count ${alternativeItems.length}`,
    );
  }

  const alternatives = await Promise.all(
    alternativeItems.map(async (item) => ({
      html: await renderNodes([item], definitions),
    })),
  );

  return {
    ...metadata,
    contentHtml: await renderNodes(contentNodes, definitions),
    alternatives,
  };
}

const questionFiles = import.meta.glob("/src/content/questions/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

function questionIdFromPath(path: string): string {
  const fileName = path.split("/").pop() ?? path;
  return fileName.replace(/\.md$/i, "");
}

export function listQuestionIds(): string[] {
  return Object.keys(questionFiles).map(questionIdFromPath).sort();
}

export async function loadQuestion(id: string): Promise<ParsedQuestion> {
  const path = Object.keys(questionFiles).find(
    (candidate) => questionIdFromPath(candidate) === id,
  );
  if (!path) throw new Error(`Question not found: ${id}`);
  return parseQuestion(questionFiles[path], id);
}

export async function loadQuestionMetadata(): Promise<QuestionMetadata[]> {
  const result: QuestionMetadata[] = [];
  for (const [path, raw] of Object.entries(questionFiles)) {
    const id = questionIdFromPath(path);
    const parsed = matter(raw).data as Frontmatter;
    result.push({
      id,
      category: asString(parsed.category, "Uncategorized"),
      tags: parseTags(parsed.tags),
      source: asString(parsed.source, "Unknown source"),
      effort: asString(parsed.effort, "Unknown"),
      knowledge: asString(parsed.knowledge, "Unknown"),
      answer: parseAnswer(parsed.answer),
    });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
