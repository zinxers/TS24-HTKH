import { getContainer } from '@ts24-htkh/core';
import { kpiRangeSchema, reconcileFileNameAscii } from '@ts24-htkh/shared';
import { handle } from '../../../_lib/handle';
import { parseVi } from '../../../_lib/parse-vi';
import { requireUser } from '../../../_lib/require-user';

export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const { reconcileService } = getContainer();
    reconcileService.assertCanView(user);
    const q = new URL(req.url).searchParams;
    const range = parseVi(kpiRangeSchema, { from: q.get('from'), to: q.get('to') });
    const { fileName, bytes } = await reconcileService.file(user, range);
    const ascii = reconcileFileNameAscii(range);
    return new Response(bytes as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
