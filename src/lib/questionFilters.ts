import type { QuestionMetadata } from "$lib/types";

export const EMPTY_CATEGORY_FILTER = "__pace_empty_category__";
export const ROOT_FOLDER_FILTER = "__pace_root_folder__";

export type QuestionFilterOption = {
  value: string;
  count: number;
};

export function getQuestionFolder(questionId: string): string {
  const separator = questionId.lastIndexOf("/");
  return separator < 0 ? "" : questionId.slice(0, separator);
}

export function matchesQuestionFilters(
  question: QuestionMetadata,
  categoryFilter = "",
  folderFilter = "",
): boolean {
  if (categoryFilter) {
    if (categoryFilter === EMPTY_CATEGORY_FILTER) {
      if (question.category !== "") return false;
    } else if (question.category !== categoryFilter) {
      return false;
    }
  }

  if (!folderFilter) return true;

  const folder = getQuestionFolder(question.id);
  if (folderFilter === ROOT_FOLDER_FILTER) return folder === "";

  return folder === folderFilter || folder.startsWith(`${folderFilter}/`);
}

export function filterQuestions(
  questions: QuestionMetadata[],
  categoryFilter = "",
  folderFilter = "",
): QuestionMetadata[] {
  return questions.filter((question) =>
    matchesQuestionFilters(question, categoryFilter, folderFilter),
  );
}

export function getCategoryFilterOptions(
  questions: QuestionMetadata[],
): QuestionFilterOption[] {
  const counts = new Map<string, number>();

  for (const question of questions) {
    const value = question.category === "" ? EMPTY_CATEGORY_FILTER : question.category;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => {
      const aLabel = a.value === EMPTY_CATEGORY_FILTER ? "" : a.value;
      const bLabel = b.value === EMPTY_CATEGORY_FILTER ? "" : b.value;
      return aLabel.localeCompare(bLabel);
    });
}

export function getFolderFilterOptions(
  questions: QuestionMetadata[],
): QuestionFilterOption[] {
  const counts = new Map<string, number>();
  let rootCount = 0;

  for (const question of questions) {
    const folder = getQuestionFolder(question.id);
    if (!folder) {
      rootCount += 1;
      continue;
    }

    const segments = folder.split("/");
    for (let index = 1; index <= segments.length; index += 1) {
      const ancestor = segments.slice(0, index).join("/");
      counts.set(ancestor, (counts.get(ancestor) ?? 0) + 1);
    }
  }

  const options = [...counts.entries()].map(([value, count]) => ({ value, count }));
  options.sort((a, b) => {
    const depth = a.value.split("/").length - b.value.split("/").length;
    return depth || a.value.localeCompare(b.value);
  });

  if (rootCount > 0) {
    options.unshift({ value: ROOT_FOLDER_FILTER, count: rootCount });
  }

  return options;
}
