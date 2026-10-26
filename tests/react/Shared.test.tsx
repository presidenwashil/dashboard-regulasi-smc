// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination, Chip } from '../../src/components/Shared';

describe('Pagination', () => {
  it('menampilkan rentang dan menonaktifkan Sebelumnya di halaman pertama', () => {
    render(<Pagination page={0} perPage={20} total={45} onPage={() => {}} />);
    expect(screen.getByText('Menampilkan 1 - 20 dari total 45 data')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sebelumnya/ })).toBeDisabled();
  });

  it('pindah ke halaman berikutnya saat Selanjutnya diklik', () => {
    const onPage = vi.fn();
    render(<Pagination page={0} perPage={20} total={45} onPage={onPage} />);
    fireEvent.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('menonaktifkan Selanjutnya di halaman terakhir', () => {
    render(<Pagination page={2} perPage={20} total={45} onPage={() => {}} />);
    expect(screen.getByRole('button', { name: /Selanjutnya/ })).toBeDisabled();
  });

  it('menampilkan 0 data jika kosong', () => {
    render(<Pagination page={0} perPage={20} total={0} onPage={() => {}} />);
    expect(screen.getByText('Menampilkan 0 data')).toBeInTheDocument();
  });
});

describe('Chip', () => {
  it('memakai warna hijau untuk ok dan oranye untuk belum', () => {
    const { rerender } = render(<Chip ok>Sudah Dibaca</Chip>);
    expect(screen.getByText('Sudah Dibaca')).toHaveClass('text-emerald-400');
    rerender(<Chip ok={false}>Belum Dibaca</Chip>);
    expect(screen.getByText('Belum Dibaca')).toHaveClass('text-orange-400');
  });
});