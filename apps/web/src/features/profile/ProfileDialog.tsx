'use client';

import { Field, FormDialog } from '../../components/FormDialog';

/** Hộp thoại tự sửa họ tên của mình (mở từ menu tài khoản). */
export function ProfileDialog({
  fullName,
  onSubmit,
  ...common
}: {
  fullName: string;
  error: string | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (fullName: string) => void;
}) {
  return (
    <FormDialog title="Sửa họ tên" submitLabel="Lưu" {...common} onSubmit={(d) => onSubmit(String(d.get('fullName') ?? ''))}>
      <Field label="Họ tên">
        {(id) => <input id={id} name="fullName" defaultValue={fullName} required maxLength={100} />}
      </Field>
    </FormDialog>
  );
}
