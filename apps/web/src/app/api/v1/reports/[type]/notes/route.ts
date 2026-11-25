import { getContainer } from '@ts24-htkh/core';
import { reportNoteSaveSchema, reportTypeSchema } from '@ts24-htkh/shared';
import { handle } from '../../../_lib/handle';
import { parseVi } from '../../../_lib/parse-vi';
import { readJson } from '../../../_lib/read-json';
import { requireUser } from '../../../_lib/require-user';

interface Ctx {
  params: Promise<{ type: string }>;
}

export function PUT(req: Request, { params }: Ctx): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    const type = parseVi(reportTypeSchema, (await params).type);
    const dto = parseVi(reportNoteSaveSchema, await readJson(req));
    return Response.json({ notes: await getContainer().reportService.saveNotes(user, type, dto) });
  });
}
