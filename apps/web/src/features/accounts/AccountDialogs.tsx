'use client';

import type {
  AccountCreateInput,
  AccountUpdateInput,
  AccountView,
  CurrentUser,
  Team,
  TransferHeadInput,
} from '@ts24-htkh/shared';
import { Field, FormDialog } from '../../components/FormDialog';
import { ROLE_LABEL } from './labels';

interface Common {
  error: string | null;
  busy: boolean;
  onCancel: () => void;
}

const str = (d: FormData, k: string) => String(d.get(k) ?? '');

/** Gợi ý theo quyền: Trưởng phòng chọn mọi team và Quản lý/Nhân Viên; Quản lý chỉ Nhân Viên team mình. */
function RoleTeamFields({ me, teams, role, teamId }: { me: CurrentUser; teams: Team[]; role?: string; teamId?: string | null }) {
  const head = me.role === 'head';
  const roles = head ? (['staff', 'manager'] as const) : (['staff'] as const);
  const teamOptions = head ? teams : teams.filter((t) => t.id === me.teamId);
  return (
    <>
      <Field label="Vai trò">
        {(id) => (
          <select id={id} name="role" defaultValue={role ?? 'staff'}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label="Team">
        {(id) => (
          <select id={id} name="teamId" defaultValue={teamId ?? teamOptions[0]?.id} required>
            {teamOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </Field>
    </>
  );
}

export function CreateAccountDialog({
  me,
  teams,
  onSubmit,
  ...common
}: Common & { me: CurrentUser; teams: Team[]; onSubmit: (input: AccountCreateInput) => void }) {
  return (
    <FormDialog
      title="Tạo tài khoản"
      submitLabel="Tạo"
      hint="Người dùng đăng nhập bằng email và mật khẩu này. Email không đổi được sau khi tạo."
      {...common}
      onSubmit={(d) =>
        onSubmit({
          email: str(d, 'email'),
          fullName: str(d, 'fullName'),
          role: str(d, 'role') as AccountCreateInput['role'],
          teamId: str(d, 'teamId'),
          password: str(d, 'password'),
        })
      }
    >
      <Field label="Email">{(id) => <input id={id} name="email" type="email" autoComplete="off" required />}</Field>
      <Field label="Họ tên">{(id) => <input id={id} name="fullName" required maxLength={100} />}</Field>
      <RoleTeamFields me={me} teams={teams} />
      <Field label="Mật khẩu">
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="8 đến 128 ký tự"
            required
            minLength={8}
            maxLength={128}
          />
        )}
      </Field>
    </FormDialog>
  );
}

/** Chỉ gửi trường đã đổi; Trưởng phòng sửa chính mình thì không có vai trò/team. */
export function EditAccountDialog({
  me,
  teams,
  account,
  onSubmit,
  ...common
}: Common & { me: CurrentUser; teams: Team[]; account: AccountView; onSubmit: (input: AccountUpdateInput) => void }) {
  const roleTeam = !(account.id === me.id && me.role === 'head');
  return (
    <FormDialog
      title="Sửa tài khoản"
      submitLabel="Lưu"
      hint={`Email: ${account.email}`}
      {...common}
      onSubmit={(d) => {
        const input: AccountUpdateInput = {};
        if (str(d, 'fullName').trim() !== account.fullName) input.fullName = str(d, 'fullName');
        if (roleTeam && str(d, 'role') !== account.role) input.role = str(d, 'role') as AccountUpdateInput['role'];
        if (roleTeam && str(d, 'teamId') !== account.teamId) input.teamId = str(d, 'teamId');
        onSubmit(input);
      }}
    >
      <Field label="Họ tên">
        {(id) => <input id={id} name="fullName" defaultValue={account.fullName} required maxLength={100} />}
      </Field>
      {roleTeam && <RoleTeamFields me={me} teams={teams} role={account.role} teamId={account.teamId} />}
    </FormDialog>
  );
}

export function PasswordDialog({
  account,
  onSubmit,
  ...common
}: Common & { account: AccountView; onSubmit: (password: string) => void }) {
  return (
    <FormDialog
      title="Đặt mật khẩu"
      submitLabel="Đặt mật khẩu"
      hint={`Mật khẩu mới cho ${account.fullName} (${account.email}).`}
      {...common}
      onSubmit={(d) => onSubmit(str(d, 'password'))}
    >
      <Field label="Mật khẩu mới">
        {(id) => (
          <input
            id={id}
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="8 đến 128 ký tự"
            required
            minLength={8}
            maxLength={128}
          />
        )}
      </Field>
    </FormDialog>
  );
}

export function TransferDialog({
  me,
  teams,
  accounts,
  onSubmit,
  ...common
}: Common & { me: CurrentUser; teams: Team[]; accounts: AccountView[]; onSubmit: (input: TransferHeadInput) => void }) {
  const candidates = accounts.filter((a) => a.id !== me.id && a.status === 'active');
  return (
    <FormDialog
      title="Bàn giao Trưởng phòng"
      submitLabel="Tiếp tục"
      hint="Người nhận trở thành Trưởng phòng. Bạn nhận vai trò và team chọn dưới đây; cả hai bị đăng xuất."
      {...common}
      onSubmit={(d) =>
        onSubmit({
          toUserId: str(d, 'toUserId'),
          newRole: str(d, 'role') as TransferHeadInput['newRole'],
          newTeamId: str(d, 'teamId'),
        })
      }
    >
      <Field label="Người nhận">
        {(id) => (
          <select id={id} name="toUserId" defaultValue="" required>
            <option value="" disabled>
              Chọn người nhận
            </option>
            {candidates.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} ({a.email})
              </option>
            ))}
          </select>
        )}
      </Field>
      <RoleTeamFields me={me} teams={teams} role="manager" />
    </FormDialog>
  );
}
