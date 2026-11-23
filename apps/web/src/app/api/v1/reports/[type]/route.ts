import { getContainer } from '@ts24-htkh/core';
import { reportQuerySchema, reportTypeSchema } from '@ts24-htkh/shared';
import { handle } from '../../_lib/handle';
import { parseVi } from '../../_lib/parse-vi';
import { requireUser } from '../../_lib/require-user';

interface Ctx {
  params: Promise<{ type: string }>;
}

export function GET(req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const type = parseVi(reportTypeSchema, (await params).type);
    const { start } = parseVi(reportQuerySchema, { start: new URL(req.url).searchParams.get('start') });
    return Response.json({ preview: await getContainer().reportService.preview(user, type, start) });
  });
}
