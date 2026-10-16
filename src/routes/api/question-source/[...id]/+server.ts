import { error } from '@sveltejs/kit';
import { loadQuestionSource } from '$lib/server/questionParser';

export async function GET({ params, url }) {
  try {
    const minimal = url.searchParams.get('minimal') === 'true';
    const source = await loadQuestionSource(params.id, minimal);
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
