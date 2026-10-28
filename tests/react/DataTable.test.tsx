// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../../src/components/Shared';

interface Item {
  id: number;
  name: string;
}

const columns = [
  { key: 'name', label: 'Nama', render: (item: Item) => item.name },
];

const rows = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`,
}));

describe('DataTable', () => {
  it('starts with ten rows and changes page size with an updated result range', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} getRowKey={(item) => item.id} />);

    expect(screen.getByText('Menampilkan 1 - 10 dari total 12 data')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Item 10')).toBeInTheDocument();
    expect(within(table).queryByText('Item 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    expect(screen.getByText('Menampilkan 11 - 12 dari total 12 data')).toBeInTheDocument();

    const pageSize = screen.getByRole('combobox', { name: 'Baris per halaman' });
    expect(within(pageSize).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual([
      '10',
      '20',
      '50',
    ]);
    await user.selectOptions(pageSize, '20');

    expect(within(screen.getByRole('table')).getByText('Item 12')).toBeInTheDocument();
    expect(screen.getByText('Menampilkan 1 - 12 dari total 12 data')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Selanjutnya/ })).not.toBeInTheDocument();
  });

  it('moves through pages and prevents navigation beyond the result boundaries', async () => {
    const user = userEvent.setup();
    render(<DataTable columns={columns} rows={rows} getRowKey={(item) => item.id} />);

    expect(screen.getByRole('button', { name: /Sebelumnya/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Selanjutnya/ }));
    expect(screen.getByText('Menampilkan 11 - 12 dari total 12 data')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Item 12')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Selanjutnya/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /Sebelumnya/ }));
    expect(screen.getByText('Menampilkan 1 - 10 dari total 12 data')).toBeInTheDocument();
  });

  it('returns to the first result when the supplied filtered rows change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataTable columns={columns} rows={rows} getRowKey={(item) => item.id} />);
    await user.click(screen.getByRole('button', { name: /Selanjutnya/ }));

    const filteredRows = [{ id: 21, name: 'Hasil filter' }];
    rerender(<DataTable columns={columns} rows={filteredRows} getRowKey={(item) => item.id} isFiltered />);

    expect(screen.getByText('Menampilkan 1 - 1 dari total 1 data')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Hasil filter')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Selanjutnya/ })).not.toBeInTheDocument();
  });

  it('keeps page-size selections independent between table instances', async () => {
    const user = userEvent.setup();
    render(
      <>
        <DataTable columns={columns} rows={rows} getRowKey={(item) => item.id} />
        <DataTable columns={columns} rows={rows} getRowKey={(item) => item.id} />
      </>,
    );
    const pageSizeControls = screen.getAllByRole('combobox', { name: 'Baris per halaman' });

    await user.selectOptions(pageSizeControls[0], '20');

    expect(pageSizeControls[0]).toHaveValue('20');
    expect(pageSizeControls[1]).toHaveValue('10');
    expect(screen.getAllByText('Menampilkan 1 - 12 dari total 12 data')).toHaveLength(1);
    expect(screen.getAllByText('Menampilkan 1 - 10 dari total 12 data')).toHaveLength(1);
  });

  it('distinguishes an empty dataset from a filtered result with no matches', () => {
    const { rerender } = render(<DataTable columns={columns} rows={[]} getRowKey={(item) => item.id} />);

    expect(screen.getByRole('status')).toHaveTextContent('Belum ada data.');
    expect(screen.getByText('Menampilkan 0 data')).toBeInTheDocument();

    rerender(<DataTable columns={columns} rows={[]} getRowKey={(item) => item.id} isFiltered />);
    expect(screen.getByRole('status')).toHaveTextContent('Tidak ada data yang sesuai.');
  });

  it('shows a shared loading state instead of table or empty content', () => {
    render(<DataTable columns={columns} rows={[]} getRowKey={(item) => item.id} loading />);

    expect(screen.getByRole('status')).toHaveTextContent('Memuat data...');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText('Belum ada data.')).not.toBeInTheDocument();
  });

  it('shows every column label, value, and action in the narrow-screen row cards', () => {
    const cardColumns = [
      ...columns,
      {
        key: 'action',
        label: 'Aksi',
        render: (item: Item) => <button type="button">Buka {item.name}</button>,
      },
    ];
    render(<DataTable columns={cardColumns} rows={[rows[0]]} getRowKey={(item) => item.id} />);

    const card = within(screen.getByRole('list')).getByRole('listitem');
    expect(within(card).getByText('Nama')).toBeInTheDocument();
    expect(within(card).getByText('Item 1')).toBeInTheDocument();
    expect(within(card).getByText('Aksi')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Buka Item 1' })).toBeInTheDocument();
  });
});
