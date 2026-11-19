import { getContainer } from '@ts24-htkh/core';
import { kpiRangeSchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { parseVi } from '../../_lib/parse-vi';
import { requireUser } from '../../_lib/require-user';

export function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const range = parseVi(kpiRangeSchema, { from: params.get('from'), to: params.get('to') });
    return Response.json({ kpi: await getContainer().kpiReportService.mine(user, range) });
  });
}
