import { error } from '@sveltejs/kit';
import { loadQuestionSource } from '$lib/server/questionParser';

export async function GET({ params }) {
  try {
    const source = await loadQuestionSource(params.id);
    return new Response(source, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch (cause) {
    throw error(404, cause instanceof Error ? cause.message : 'Question not found');
  }
}
