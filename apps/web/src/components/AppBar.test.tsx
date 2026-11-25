import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppBar } from './AppBar';

describe('AppBar', () => {
  it('hiện logo thay cho chữ TS24-HTKH', () => {
    render(<AppBar user={null} onLogoutError={() => {}} />);
    expect(screen.getByRole('img', { name: 'TS24 Hỗ trợ khách hàng' })).toBeInTheDocument();
    expect(screen.queryByText('TS24-HTKH')).not.toBeInTheDocument();
  });
});
