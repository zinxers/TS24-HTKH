import { getContainer } from '@ts24-htkh/core';
import { trendQuerySchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { parseVi } from '../../_lib/parse-vi';
import { requireUser } from '../../_lib/require-user';

export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const q = new URL(req.url).searchParams;
    const { team, unit } = parseVi(trendQuerySchema, { team: q.get('team'), unit: q.get('unit') });
    return Response.json({ trend: await getContainer().teamKpiService.trend(user, team, unit) });
  });
}
