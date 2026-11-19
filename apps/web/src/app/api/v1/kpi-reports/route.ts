import { getContainer } from '@ts24-htkh/core';
import { kpiSubmitSchema } from '@ts24-htkh/shared';
import { handle } from '../_lib/handle';
import { parseVi } from '../_lib/parse-vi';
import { readJson } from '../_lib/read-json';
import { requireUser } from '../_lib/require-user';

export function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const user = await requireUser();
    // Từng dòng được service kiểm; dòng rác thành lỗi theo dòng, không làm hỏng cả lần gửi.
    const { rows } = parseVi(kpiSubmitSchema, await readJson(req));
    return Response.json(await getContainer().kpiReportService.submit(user, rows));
  });
}
