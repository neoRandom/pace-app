import { json } from '@sveltejs/kit';

const serverInstanceId = crypto.randomUUID();

export function GET() {
  return json({ instanceId: serverInstanceId });
}
