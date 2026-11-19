'use client';

import { useState } from 'react';
import type { ConfirmDialogProps } from '../../components/ConfirmDialog';
import { ApiError } from '../../lib/api-client';
import { errorMessage } from './labels';

export interface PendingAction {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  /** Gọi API và cập nhật màn hình; chỉ chạy khi người dùng bấm xác nhận. */
  run: () => Promise<void>;
}

/** Mọi thao tác ghi: ask() mở ConfirmDialog, xác nhận mới chạy; 401 → onAuthLost, lỗi khác → error. */
export function useConfirmAction(onAuthLost: () => void) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!pending) return;
    setBusy(true);
    try {
      await pending.run();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) onAuthLost();
      else setError(errorMessage(e));
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  const dialogProps: ConfirmDialogProps = {
    open: pending !== null,
    title: pending?.title ?? '',
    message: pending?.message ?? '',
    confirmLabel: pending?.confirmLabel ?? '',
    danger: pending?.danger,
    busy,
    onConfirm: () => void confirm(),
    onCancel: () => setPending(null),
  };

  return {
    ask: (action: PendingAction) => {
      setError(null);
      setPending(action);
    },
    busy,
    error,
    setError,
    dialogProps,
  };
}
