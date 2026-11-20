import { getContainer } from '@ts24-htkh/core';
import { kpiRangeSchema, teamIdSchema } from '@ts24-htkh/shared';
import { handle } from '../../../_lib/handle';
import { parseVi } from '../../../_lib/parse-vi';
import { requireUser } from '../../../_lib/require-user';

interface Ctx {
  params: Promise<{ id: string }>;
}

export function GET(req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const teamId = parseVi(teamIdSchema, (await params).id);
    const q = new URL(req.url).searchParams;
    const range = parseVi(kpiRangeSchema, { from: q.get('from'), to: q.get('to') });
    return Response.json({ report: await getContainer().teamKpiService.report(user, teamId, range) });
  });
}
