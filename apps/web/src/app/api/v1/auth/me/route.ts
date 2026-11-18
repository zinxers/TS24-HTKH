import { handle } from '../../_lib/handle';
import { requireUser } from '../../_lib/require-user';

// Route mẫu cho mọi route có xác thực.
export function GET(): Promise<Response> {
  return handle(async () => Response.json({ user: await requireUser() }));
}
