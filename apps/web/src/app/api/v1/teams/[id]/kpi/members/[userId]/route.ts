import { getContainer } from '@ts24-htkh/core';
import { kpiRangeSchema, teamIdSchema, userIdSchema } from '@ts24-htkh/shared';
import { handle } from '../../../../../_lib/handle';
import { parseVi } from '../../../../../_lib/parse-vi';
import { requireUser } from '../../../../../_lib/require-user';

interface Ctx {
  params: Promise<{ id: string; userId: string }>;
}

export function GET(req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const p = await params;
    const teamId = parseVi(teamIdSchema, p.id);
    const userId = parseVi(userIdSchema, p.userId);
    const q = new URL(req.url).searchParams;
    const range = parseVi(kpiRangeSchema, { from: q.get('from'), to: q.get('to') });
    return Response.json({ member: await getContainer().teamKpiService.member(user, teamId, userId, range) });
  });
}
