import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAdapter } from '../adapter/context';
import { DataTable, Modal, type DataTableColumn, type Notify } from '../components/Shared';
import type { MasterBidang, MasterUnit, Sesi } from '../adapter/types';

interface Props {
  sesi: Sesi;
  notify: Notify;
}

type Dialog =
  | { kind: 'create-bidang' }
  | { kind: 'rename-bidang'; bidang: MasterBidang }
  | { kind: 'delete-bidang'; bidang: MasterBidang }
  | { kind: 'create-unit' }
  | { kind: 'rename-unit'; unit: MasterUnit }
  | { kind: 'reparent-unit'; unit: MasterUnit }
  | { kind: 'delete-unit'; unit: MasterUnit }
  | null;

function dialogTitle(dialog: Dialog): string {
  switch (dialog?.kind) {
    case 'create-bidang':
      return 'Tambah Bidang';
    case 'rename-bidang':
      return 'Ubah Nama Bidang';
    case 'delete-bidang':
      return 'Hapus Bidang';
    case 'create-unit':
      return 'Tambah Unit Organisasi';
    case 'rename-unit':
      return 'Ubah Nama Unit Organisasi';
    case 'reparent-unit':
      return 'Ubah Bidang Induk Unit';
    case 'delete-unit':
      return 'Hapus Unit Organisasi';
    default:
      return '';
  }
}

function submitLabel(dialog: Dialog): string {
  switch (dialog?.kind) {
    case 'create-bidang':
      return 'Simpan Bidang';
    case 'rename-bidang':
    case 'rename-unit':
      return 'Simpan Perubahan';
    case 'delete-bidang':
      return 'Hapus Bidang';
    case 'create-unit':
      return 'Simpan Unit';
    case 'reparent-unit':
      return 'Simpan Bidang Induk';
    case 'delete-unit':
      return 'Hapus Unit';
    default:
      return 'Simpan';
  }
}

function needsName(dialog: Dialog): boolean {
  return dialog?.kind === 'create-bidang' ||
    dialog?.kind === 'rename-bidang' ||
    dialog?.kind === 'create-unit' ||
    dialog?.kind === 'rename-unit';
}

function needsParent(dialog: Dialog): boolean {
  return dialog?.kind === 'create-unit' || dialog?.kind === 'reparent-unit';
}

export default function MasterOrganisasiPage({ sesi, notify }: Props) {
  const api = useAdapter();
  const [bidangs, setBidangs] = useState<MasterBidang[]>([]);
  const [units, setUnits] = useState<MasterUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [masterBidang, masterUnit] = await Promise.all([
        api.getMasterBidang(),
        api.getMasterUnit(),
      ]);
      setBidangs(masterBidang);
      setUnits(masterUnit);
      setLoadError('');
    } catch (error) {
      // Keep the last valid master data visible; only the request failed.
      setLoadError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  useEffect(() => {
    // Sinkronisasi dengan server Apps Script. setState terjadi setelah await.
    // oxlint-disable-next-line react/set-state-in-effect
    void refresh();
  }, [refresh]);

  const openCreateBidang = () => {
    setDialog({ kind: 'create-bidang' });
    setName('');
    setParentId('');
    setFormError('');
  };

  const openRenameBidang = (bidang: MasterBidang) => {
    setDialog({ kind: 'rename-bidang', bidang });
    setName(bidang.name);
    setParentId('');
    setFormError('');
  };

  const openDeleteBidang = (bidang: MasterBidang) => {
    setDialog({ kind: 'delete-bidang', bidang });
    setName('');
    setParentId('');
    setFormError('');
  };

  const openCreateUnit = () => {
    setDialog({ kind: 'create-unit' });
    setName('');
    setParentId('');
    setFormError('');
  };

  const openRenameUnit = (unit: MasterUnit) => {
    setDialog({ kind: 'rename-unit', unit });
    setName(unit.name);
    setParentId('');
    setFormError('');
  };

  const openReparentUnit = (unit: MasterUnit) => {
    setDialog({ kind: 'reparent-unit', unit });
    setName('');
    setParentId(String(unit.bidangId));
    setFormError('');
  };

  const openDeleteUnit = (unit: MasterUnit) => {
    setDialog({ kind: 'delete-unit', unit });
    setName('');
    setParentId('');
    setFormError('');
  };

  const closeDialog = () => {
    if (busy) return;
    setDialog(null);
    setFormError('');
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!dialog) return;

    const trimmed = name.trim();
    if (needsName(dialog) && !trimmed) {
      setFormError(dialog.kind.includes('bidang') ? 'Nama Bidang wajib diisi.' : 'Nama Unit wajib diisi.');
      return;
    }
    if (needsParent(dialog) && !bidangs.some((bidang) => bidang.id === Number(parentId))) {
      setFormError('Pilih Bidang induk dari MasterBidang.');
      return;
    }

    setBusy(true);
    try {
      if (dialog.kind === 'create-bidang') {
        const created = await api.createMasterBidang(sesi, trimmed);
        notify(`Bidang ${created.name} berhasil ditambahkan.`);
      } else if (dialog.kind === 'rename-bidang') {
        const updated = await api.renameMasterBidang(sesi, dialog.bidang.id, trimmed);
        notify(`Nama Bidang ${updated.name} berhasil diperbarui.`);
      } else if (dialog.kind === 'delete-bidang') {
        const message = await api.deleteMasterBidang(sesi, dialog.bidang.id);
        notify(message || 'Bidang berhasil dihapus.');
      } else if (dialog.kind === 'create-unit') {
        const created = await api.createMasterUnit(sesi, trimmed, Number(parentId));
        notify(`Unit ${created.name} berhasil ditambahkan.`);
      } else if (dialog.kind === 'rename-unit') {
        const updated = await api.renameMasterUnit(sesi, dialog.unit.id, trimmed);
        notify(`Nama Unit ${updated.name} berhasil diperbarui.`);
      } else if (dialog.kind === 'reparent-unit') {
        const updated = await api.reparentMasterUnit(sesi, dialog.unit.id, Number(parentId));
        notify(`Bidang induk Unit ${updated.name} berhasil diperbarui.`);
      } else if (dialog.kind === 'delete-unit') {
        const message = await api.deleteMasterUnit(sesi, dialog.unit.id);
        notify(message || 'Unit Organisasi berhasil dihapus.');
      }
      setDialog(null);
      await refresh();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const bidangColumns: DataTableColumn<MasterBidang>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (bidang) => <span className="font-mono text-cyan-400">{bidang.id}</span>,
    },
    {
      key: 'name',
      label: 'Nama Bidang',
      render: (bidang) => <span className="font-semibold text-gray-200">{bidang.name}</span>,
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (bidang) => (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => openRenameBidang(bidang)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <i className="ph ph-pencil-simple" /> Ubah Nama
          </button>
          <button
            onClick={() => openDeleteBidang(bidang)}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <i className="ph ph-trash" /> Hapus
          </button>
        </div>
      ),
    },
  ];

  const unitColumns: DataTableColumn<MasterUnit>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (unit) => <span className="font-mono text-cyan-400">{unit.id}</span>,
    },
    {
      key: 'name',
      label: 'Unit Organisasi',
      render: (unit) => <span className="font-semibold text-gray-200">{unit.name}</span>,
    },
    {
      key: 'bidang',
      label: 'Bidang Induk',
      render: (unit) => <span className="text-gray-400">{unit.bidang}</span>,
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (unit) => (
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => openRenameUnit(unit)}
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <i className="ph ph-pencil-simple" /> Ubah Nama
          </button>
          <button
            onClick={() => openReparentUnit(unit)}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <i className="ph ph-arrows-left-right" /> Ubah Bidang Induk
          </button>
          <button
            onClick={() => openDeleteUnit(unit)}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <i className="ph ph-trash" /> Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-buildings text-cyan-500 text-2xl" /> Master Organisasi
          </h3>
          <button
            onClick={() => void refresh()}
            aria-label="Refresh Master Organisasi"
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1"
          >
            <i className="ph ph-arrows-clockwise" /> Refresh
          </button>
        </div>
        {loadError && (
          <div role="alert" className="m-4 text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {loadError}
          </div>
        )}
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-squares-four text-cyan-500 text-2xl" /> Master Bidang
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateBidang}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <i className="ph ph-plus" /> Tambah Bidang
            </button>
            <button
              onClick={() => void refresh()}
              aria-label="Refresh Master Bidang"
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1"
            >
              <i className="ph ph-arrows-clockwise" /> Refresh
            </button>
          </div>
        </div>
        <DataTable
          columns={bidangColumns}
          rows={bidangs}
          getRowKey={(bidang) => bidang.id}
          loading={loading}
          emptyMessage="Belum ada Bidang."
        />
      </div>

      <div className="bg-gray-800 rounded-2xl shadow-lg overflow-hidden border border-gray-700">
        <div className="bg-gray-900/50 border-b border-gray-700 p-4 flex justify-between items-center">
          <h3 className="font-bold text-gray-200 flex items-center gap-2 text-lg">
            <i className="ph ph-tree-structure text-cyan-500 text-2xl" /> Master Unit Organisasi
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreateUnit}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
            >
              <i className="ph ph-plus" /> Tambah Unit
            </button>
            <button
              onClick={() => void refresh()}
              aria-label="Refresh Master Unit Organisasi"
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 flex items-center gap-1"
            >
              <i className="ph ph-arrows-clockwise" /> Refresh
            </button>
          </div>
        </div>
        <DataTable
          columns={unitColumns}
          rows={units}
          getRowKey={(unit) => unit.id}
          loading={loading}
          emptyMessage="Belum ada Unit Organisasi."
        />
      </div>

      <Modal open={!!dialog} onClose={closeDialog}>
        <form onSubmit={submit}>
          <div className="bg-gray-900/60 px-6 py-4 border-b border-gray-700 flex items-center gap-3">
            <i className="ph ph-buildings text-cyan-400 text-2xl" />
            <h3 className="font-bold text-gray-100 text-lg">{dialogTitle(dialog)}</h3>
          </div>
          <div className="p-6 space-y-4">
            {needsName(dialog) && (
              <label className="block text-xs font-bold text-gray-400 uppercase">
                {dialog?.kind.includes('bidang') ? 'Nama Bidang' : 'Nama Unit'}
                <input
                  aria-label={dialog?.kind.includes('bidang') ? 'Nama Bidang' : 'Nama Unit'}
                  className="mt-1 w-full px-4 py-2.5 rounded-lg text-sm normal-case font-normal"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoFocus
                />
              </label>
            )}

            {needsParent(dialog) && (
              <label className="block text-xs font-bold text-gray-400 uppercase">
                Bidang Induk
                <select
                  aria-label="Bidang Induk"
                  className="mt-1 w-full px-4 py-2.5 rounded-lg text-sm normal-case"
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="">Pilih Bidang...</option>
                  {bidangs.map((bidang) => (
                    <option key={bidang.id} value={bidang.id}>
                      {bidang.name} (ID {bidang.id})
                    </option>
                  ))}
                </select>
              </label>
            )}

            {dialog?.kind === 'delete-bidang' && (
              <p className="text-sm text-gray-300">
                Hapus Bidang <span className="font-bold text-cyan-400">{dialog.bidang.name}</span>?
                Penghapusan ditolak bila masih ada Unit Organisasi, target Dokumen, atau snapshot
                Bidang pengunggah yang memakai ID ini.
              </p>
            )}
            {dialog?.kind === 'delete-unit' && (
              <p className="text-sm text-gray-300">
                Hapus Unit Organisasi <span className="font-bold text-cyan-400">{dialog.unit.name}</span>?
                Penghapusan ditolak bila masih ada User yang memakai Unit ini.
              </p>
            )}

            {formError && (
              <div role="alert" className="text-red-400 text-xs font-semibold bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {formError}
              </div>
            )}
          </div>
          <div className="bg-gray-900/40 px-6 py-4 flex justify-end gap-3 border-t border-gray-700">
            <button
              type="button"
              onClick={closeDialog}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-300 hover:bg-gray-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 rounded-xl text-sm font-bold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-60"
            >
              {busy ? 'Memproses...' : submitLabel(dialog)}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
