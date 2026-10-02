import { error, json } from '@sveltejs/kit';
import { loadQuestion } from '$lib/server/questionParser';

export async function GET({ params }) {
  try {
    return json(await loadQuestion(params.id));
  } catch (cause) {
    throw error(404, cause instanceof Error ? cause.message : 'Question not found');
  }
}
