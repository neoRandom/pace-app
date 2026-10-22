import { describe, expect, it } from "vitest";
import type { QuestionMetadata } from "$lib/types";
import {
  EMPTY_CATEGORY_FILTER,
  ROOT_FOLDER_FILTER,
  filterQuestions,
  getCategoryFilterOptions,
  getFolderFilterOptions,
  getQuestionFolder,
} from "./questionFilters";

function question(id: string, category: string): QuestionMetadata {
  return {
    id,
    category,
    tags: [],
    source: "Test",
    effort: "Unknown",
    knowledge: "Unknown",
    answer: 0,
  };
}

const inventory = [
  question("physics/mechanics/newton", "Physics"),
  question("physics/mechanics/torque", "Physics"),
  question("physics/electricity/charge", "Physics"),
  question("mathematics/algebra/linear", "Mathematics"),
  question("chemistry", "Chemistry"),
  question("uncategorized", ""),
];

describe("question filters", () => {
  it("derives category options and counts from actual question metadata", () => {
    expect(getCategoryFilterOptions(inventory)).toEqual([
      { value: "Chemistry", count: 1 },
      { value: "Mathematics", count: 1 },
      { value: "Physics", count: 3 },
      { value: EMPTY_CATEGORY_FILTER, count: 1 },
    ]);
  });

  it("derives exact folders and recursive counts from question IDs", () => {
    expect(getFolderFilterOptions(inventory)).toEqual([
      { value: ROOT_FOLDER_FILTER, count: 2 },
      { value: "mathematics", count: 1 },
      { value: "mathematics/algebra", count: 1 },
      { value: "physics", count: 3 },
      { value: "physics/electricity", count: 1 },
      { value: "physics/mechanics", count: 2 },
    ]);
  });

  it("filters by category and supports an empty category value", () => {
    expect(filterQuestions(inventory, "Physics").map((q) => q.id)).toEqual([
      "physics/mechanics/newton",
      "physics/mechanics/torque",
      "physics/electricity/charge",
    ]);
    expect(filterQuestions(inventory, EMPTY_CATEGORY_FILTER).map((q) => q.id)).toEqual([
      "uncategorized",
    ]);
  });

  it("filters a folder recursively and combines folder and category with AND", () => {
    expect(filterQuestions(inventory, "", "physics").map((q) => q.id)).toEqual([
      "physics/mechanics/newton",
      "physics/mechanics/torque",
      "physics/electricity/charge",
    ]);
    expect(filterQuestions(inventory, "Physics", "physics/mechanics").map((q) => q.id)).toEqual([
      "physics/mechanics/newton",
      "physics/mechanics/torque",
    ]);
    expect(filterQuestions(inventory, "Mathematics", "physics").map((q) => q.id)).toEqual([]);
  });

  it("distinguishes the questions root from named folders", () => {
    expect(getQuestionFolder("chemistry")).toBe("");
    expect(filterQuestions(inventory, "", ROOT_FOLDER_FILTER).map((q) => q.id)).toEqual([
      "chemistry",
      "uncategorized",
    ]);
  });
});
