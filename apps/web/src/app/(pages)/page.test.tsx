import { render, screen } from '@testing-library/react';
import Page from './page';

it('hiện tên hệ thống và Mốc 0', () => {
  render(<Page />);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('TS24-HTKH');
  expect(screen.getByText(/Mốc 0/)).toBeInTheDocument();
});
