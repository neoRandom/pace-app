export interface QuestionMetadata {
  id: string;
  category: string;
  tags: string[];
  source: string;
  effort: string;
  knowledge: string;
  answer: number;
}

export interface ParsedQuestion extends QuestionMetadata {
  contentHtml: string;
  alternatives: Array<{ html: string }>;
}

export interface AppSettings {
  minCooldownMinutes: number;
  maxCooldownMinutes: number;
}

export type TrainingPhase = 'cooldown' | 'answering' | 'answered';
