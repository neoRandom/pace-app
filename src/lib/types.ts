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
  theme: 'dark' | 'light';
  minCooldownMinutes: number;
  maxCooldownMinutes: number;
  notificationsEnabled: boolean;
  attentionSoundEnabled: boolean;
  attentionSoundIntervalSeconds: number;
  attentionSoundVolume: number;
  questionContentAlternativesRatio: number;
  questionScratchpadRatio: number;
  showQuestionSidebar: boolean;
  questionCategoryFilter: string;
  questionFolderFilter: string;
}

export type TrainingPhase = 'cooldown' | 'answering' | 'answered';
