import { json } from '@sveltejs/kit';
import { loadQuestionMetadata } from '$lib/server/questionParser';

export async function GET() {
  return json({ questions: await loadQuestionMetadata() });
}
