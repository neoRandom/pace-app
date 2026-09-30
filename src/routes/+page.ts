import type { PageLoad } from './$types';
import type { QuestionMetadata } from '$lib/types';

export const load: PageLoad = async ({ fetch }) => {
  const response = await fetch('/api/questions');
  if (!response.ok) throw new Error('Failed to load questions');

  const data = (await response.json()) as { questions: QuestionMetadata[] };
  return { questions: data.questions };
};
