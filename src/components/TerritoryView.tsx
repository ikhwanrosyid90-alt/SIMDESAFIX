import React, { useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  DusunCommitteeMember,
  DusunUnit,
  Resident,
  RwUnit,
  TerritoryUnit,
} from '../types/village';

interface TerritoryViewProps {
  dusuns: DusunUnit[];
  rws: RwUnit[];
  territories: TerritoryUnit[];
  residents: Resident[];
  onSaveDusun: (dusun: DusunUnit, isNew: boolean) => void;
  onDeleteDusun: (dusun: DusunUnit, rtCount: number) => void;
  onSaveRw: (rw: RwUnit, isNew: boolean) => void;
  onDeleteRw: (rw: RwUnit, rtCount: number) => void;
  onSaveTerritory: (unit: TerritoryUnit, isNew: boolean) => void;
  onDeleteTerritory: (unit: TerritoryUnit, assignedCount: number) => void;
  onOpenOnMap?: (territoryId: string) => void;
}

const JABATAN_DUSUN_PRESETS = [
  'Sekretaris Dusun',
  'Bendahara Dusun',
  'Ketua PKK Dusun',
  'Kader Posyandu',
  'Koordinator Linmas Dusun',
  'Ketua Karang Taruna Unit Dusun',
  'Tokoh Masyarakat / Adat',
  'Pengurus Lainnya',
];

const EMPTY_DUSUN: DusunUnit = {
  id: '',
  kode: '',
  namaDusun: '',
  kepalaDusun: '',
  noHpKadus: '',
  luasWilayah: '',
  keterangan: '',
  kepengurusan: [],
};

const EMPTY_RW: RwUnit = {
  id: '',
  dusunKode: '',
  namaDusun: '',
  rw: '001',
  ketuaRw: '',
  noHpRw: '',
  keterangan: '',
};

const EMPTY_RT: TerritoryUnit = {
  id: '',
  kode: '',
  namaDusun: '',
  rw: '001',
  rt: '001',
  kepalaWilayah: '',
  jabatan: 'Ketua RT',
  noHp: '',
  luasWilayah: '',
  keterangan: '',
};

export const TerritoryView: React.FC<TerritoryViewProps> = ({
  dusuns,
  rws,
  territories,
  residents,
  onSaveDusun,
  onDeleteDusun,
  onSaveRw,
  onDeleteRw,
  onSaveTerritory,
  onDeleteTerritory,
  onOpenOnMap,
}) => {
  const [subTab, setSubTab] = useState<'dusun' | 'rw' | 'rt'>('dusun');

  // Dusun Modal State
  const [dusunModalOpen, setDusunModalOpen] = useState(false);
  const [editingDusun, setEditingDusun] = useState<DusunUnit | null>(null);
  const [dusunDraft, setDusunDraft] = useState<DusunUnit>(EMPTY_DUSUN);

  // Committee (Kepengurusan Dusun) Modal State
  const [committeeModalOpen, setCommitteeModalOpen] = useState(false);
  const [targetDusunForCommittee, setTargetDusunForCommittee] =
    useState<DusunUnit | null>(null);
  const [editingMember, setEditingMember] = useState<DusunCommitteeMember | null>(
    null
  );
  const [memberJabatanPreset, setMemberJabatanPreset] = useState(
    JABATAN_DUSUN_PRESETS[0]
  );
  const [memberDraft, setMemberDraft] = useState<DusunCommitteeMember>({
    id: '',
    nama: '',
    jabatan: JABATAN_DUSUN_PRESETS[0],
    noHp: '',
    periode: '2024–2029',
  });

  // RW Modal State
  const [rwModalOpen, setRwModalOpen] = useState(false);
  const [editingRw, setEditingRw] = useState<RwUnit | null>(null);
  const [rwDraft, setRwDraft] = useState<RwUnit>(EMPTY_RW);

  // RT Modal State
  const [rtModalOpen, setRtModalOpen] = useState(false);
  const [editingRt, setEditingRt] = useState<TerritoryUnit | null>(null);
  const [rtDraft, setRtDraft] = useState<TerritoryUnit>(EMPTY_RT);

  // Active Residents helper
  const activeResidents = useMemo(
    () =>
      residents.filter(
        (r) => r.statusKependudukan === 'Tetap' || r.statusKependudukan === 'Pendatang'
      ),
    [residents]
  );

  // Stats by RT id
  const statsByRt = useMemo(() => {
    const map = new Map<string, { warga: number; kk: number }>();
    for (const t of territories) {
      const wargaList = activeResidents.filter((r) => r.dusunId === t.id);
      const kk = new Set(wargaList.map((r) => r.noKk)).size;
      map.set(t.id, { warga: wargaList.length, kk });
    }
    return map;
  }, [territories, activeResidents]);

  // Stats by Dusun
  const statsByDusun = useMemo(() => {
    const map = new Map<
      string,
      { rwCount: number; rtCount: number; warga: number; kk: number }
    >();
    for (const d of dusuns) {
      const matchingRws = rws.filter(
        (rw) => rw.dusunKode === d.kode || rw.namaDusun === d.namaDusun
      );
      const matchingRts = territories.filter(
        (t) => t.kode === d.kode || t.namaDusun === d.namaDusun
      );
      const rtIds = new Set(matchingRts.map((t) => t.id));
      const wargaList = activeResidents.filter((r) => rtIds.has(r.dusunId));
      const kk = new Set(wargaList.map((r) => r.noKk)).size;
      map.set(d.id, {
        rwCount: matchingRws.length,
        rtCount: matchingRts.length,
        warga: wargaList.length,
        kk,
      });
    }
    return map;
  }, [dusuns, rws, territories, activeResidents]);

  // Stats by RW
  const statsByRw = useMemo(() => {
    const map = new Map<string, { rtCount: number; warga: number; kk: number }>();
    for (const rw of rws) {
      const matchingRts = territories.filter(
        (t) =>
          t.rw === rw.rw &&
          (t.kode === rw.dusunKode || t.namaDusun === rw.namaDusun)
      );
      const rtIds = new Set(matchingRts.map((t) => t.id));
      const wargaList = activeResidents.filter((r) => rtIds.has(r.dusunId));
      const kk = new Set(wargaList.map((r) => r.noKk)).size;
      map.set(rw.id, {
        rtCount: matchingRts.length,
        warga: wargaList.length,
        kk,
      });
    }
    return map;
  }, [rws, territories, activeResidents]);

  const totalPengurusDusun = useMemo(
    () => dusuns.reduce((sum, d) => sum + (d.kepengurusan?.length || 0), 0),
    [dusuns]
  );

  // Dusun Handlers
  const openCreateDusun = () => {
    setEditingDusun(null);
    setDusunDraft({
      ...EMPTY_DUSUN,
      kode: `DSN-0${dusuns.length + 1}`,
    });
    setDusunModalOpen(true);
  };

  const openEditDusun = (d: DusunUnit) => {
    setEditingDusun(d);
    setDusunDraft({ ...d, kepengurusan: [...(d.kepengurusan || [])] });
    setDusunModalOpen(true);
  };

  const handleDusunSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved: DusunUnit = {
      ...dusunDraft,
      id: editingDusun?.id || `dsn-${Date.now()}`,
      kode: dusunDraft.kode.trim().toUpperCase(),
      namaDusun: dusunDraft.namaDusun.trim(),
    };
    onSaveDusun(saved, !editingDusun);
    setDusunModalOpen(false);
  };

  // Kepengurusan Dusun Handlers
  const openAddCommitteeMember = (dusun: DusunUnit) => {
    setTargetDusunForCommittee(dusun);
    setEditingMember(null);
    setMemberJabatanPreset(JABATAN_DUSUN_PRESETS[0]);
    setMemberDraft({
      id: '',
      nama: '',
      jabatan: JABATAN_DUSUN_PRESETS[0],
      noHp: '',
      periode: '2024–2029',
    });
    setCommitteeModalOpen(true);
  };

  const openEditCommitteeMember = (
    dusun: DusunUnit,
    member: DusunCommitteeMember
  ) => {
    setTargetDusunForCommittee(dusun);
    setEditingMember(member);
    const isPreset = JABATAN_DUSUN_PRESETS.includes(member.jabatan);
    setMemberJabatanPreset(isPreset ? member.jabatan : 'Pengurus Lainnya');
    setMemberDraft({ ...member });
    setCommitteeModalOpen(true);
  };

  const handleCommitteeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDusunForCommittee) return;

    const finalJabatan =
      memberJabatanPreset === 'Pengurus Lainnya'
        ? memberDraft.jabatan.trim()
        : memberJabatanPreset;

    const savedMember: DusunCommitteeMember = {
      ...memberDraft,
      id: editingMember?.id || `peng-${Date.now()}`,
      jabatan: finalJabatan || 'Pengurus Dusun',
    };

    const currentList = targetDusunForCommittee.kepengurusan || [];
    const nextList = editingMember
      ? currentList.map((m) => (m.id === savedMember.id ? savedMember : m))
      : [...currentList, savedMember];

    onSaveDusun(
      { ...targetDusunForCommittee, kepengurusan: nextList },
      false
    );
    setCommitteeModalOpen(false);
  };

  const handleDeleteCommitteeMember = (
    dusun: DusunUnit,
    memberId: string
  ) => {
    const nextList = (dusun.kepengurusan || []).filter((m) => m.id !== memberId);
    onSaveDusun({ ...dusun, kepengurusan: nextList }, false);
  };

  // RW Handlers
  const openCreateRw = () => {
    const defaultDusun = dusuns[0];
    setEditingRw(null);
    setRwDraft({
      ...EMPTY_RW,
      dusunKode: defaultDusun?.kode || 'DSN-01',
      namaDusun: defaultDusun?.namaDusun || 'Dusun Krajan',
      rw: String(rws.length + 1).padStart(3, '0'),
    });
    setRwModalOpen(true);
  };

  const openEditRw = (rw: RwUnit) => {
    setEditingRw(rw);
    setRwDraft({ ...rw });
    setRwModalOpen(true);
  };

  const handleRwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved: RwUnit = {
      ...rwDraft,
      id: editingRw?.id || `rw-${Date.now()}`,
      rw: rwDraft.rw.padStart(3, '0'),
    };
    onSaveRw(saved, !editingRw);
    setRwModalOpen(false);
  };

  // RT Handlers
  const openCreateRt = () => {
    const defaultDusun = dusuns[0];
    const matchingRw =
      rws.find((r) => r.dusunKode === defaultDusun?.kode) || rws[0];
    setEditingRt(null);
    setRtDraft({
      ...EMPTY_RT,
      kode: defaultDusun?.kode || 'DSN-01',
      namaDusun: defaultDusun?.namaDusun || 'Dusun Krajan',
      rw: matchingRw?.rw || '001',
      rt: String(territories.length + 1).padStart(3, '0'),
      jabatan: 'Ketua RT',
    });
    setRtModalOpen(true);
  };

  const openEditRt = (unit: TerritoryUnit) => {
    setEditingRt(unit);
    setRtDraft({ ...unit, jabatan: 'Ketua RT' });
    setRtModalOpen(true);
  };

  const handleRtSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const saved: TerritoryUnit = {
      ...rtDraft,
      id: editingRt?.id || `wil-${Date.now()}`,
      jabatan: 'Ketua RT',
      rw: rtDraft.rw.padStart(3, '0'),
      rt: rtDraft.rt.padStart(3, '0'),
    };
    onSaveTerritory(saved, !editingRt);
    setRtModalOpen(false);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Kepala Dusun / Wilayah</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {dusuns.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {totalPengurusDusun} Pengurus Dusun aktif
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Rukun Warga (Ketua RW)</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {rws.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Tersebar di {dusuns.length} dusun
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Rukun Tetangga (Ketua RT)</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {territories.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Unit pendataan warga
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Penduduk Aktif Tercatat</p>
          <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
            {activeResidents.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {new Set(activeResidents.map((r) => r.noKk)).size} Kepala Keluarga
          </p>
        </div>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex w-full sm:w-auto items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('dusun')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'dusun'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kepala Dusun & Kepengurusan ({dusuns.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rw')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'rw'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ketua RW ({rws.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rt')}
            className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'rt'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ketua RT ({territories.length})
          </button>
        </div>

        <button
          type="button"
          onClick={
            subTab === 'dusun'
              ? openCreateDusun
              : subTab === 'rw'
              ? openCreateRw
              : openCreateRt
          }
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {subTab === 'dusun'
            ? 'Tambah Dusun & Kadus'
            : subTab === 'rw'
            ? 'Tambah RW & Ketua RW'
            : 'Tambah RT & Ketua RT'}
        </button>
      </div>

      {/* TAB 1: KEPALA DUSUN & INPUT KEPENGURUSAN PER DUSUN */}
      {subTab === 'dusun' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {dusuns.map((dusun) => {
            const st = statsByDusun.get(dusun.id) || {
              rwCount: 0,
              rtCount: 0,
              warga: 0,
              kk: 0,
            };
            const members = dusun.kepengurusan || [];

            return (
              <section
                key={dusun.id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white overflow-hidden"
              >
                <div className="p-5">
                  {/* Dusun Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono-tabular font-semibold text-teal-800">
                          {dusun.kode}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Luas {dusun.luasWilayah || '-'}</span>
                      </div>
                      <h3 className="mt-1 text-lg font-bold text-slate-900">
                        {dusun.namaDusun}
                      </h3>
                      <p className="mt-1 text-xs text-slate-600">
                        {dusun.keterangan || 'Wilayah administratif dusun desa.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditDusun(dusun)}
                        title="Edit Dusun & Kepala Dusun"
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDusun(dusun, st.rtCount)}
                        title="Hapus Dusun"
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Kepala Dusun & Stats */}
                  <div className="mt-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Kepala Dusun (Kadus)
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-slate-900">
                        {dusun.kepalaDusun || '-'}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 font-mono-tabular text-xs text-slate-600">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {dusun.noHpKadus || '-'}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 border-t border-slate-200 pt-2.5 sm:border-t-0 sm:border-l sm:pl-3 sm:pt-0 text-center">
                      <div>
                        <p className="text-[11px] text-slate-500">RW / RT</p>
                        <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-slate-900">
                          {st.rwCount}/{st.rtCount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">KK</p>
                        <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-slate-900">
                          {st.kk}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500">Warga</p>
                        <p className="mt-0.5 font-mono-tabular text-sm font-semibold text-slate-900">
                          {st.warga}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Kepengurusan Dusun Section */}
                  <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-teal-700" />
                        <h4 className="text-xs font-semibold text-slate-900">
                          Kepengurusan Wilayah {dusun.namaDusun} ({members.length})
                        </h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => openAddCommitteeMember(dusun)}
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100 whitespace-nowrap"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Input Pengurus
                      </button>
                    </div>

                    {members.length === 0 ? (
                      <div className="mt-2.5 rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-4 text-center text-xs text-slate-500">
                        Belum ada pengurus dusun (Sekretaris, PKK, Posyandu, Linmas, dll)
                        yang diinput.
                      </div>
                    ) : (
                      <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {members.map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900">{m.nama}</p>
                              <p className="text-[11px] text-slate-600">
                                {m.jabatan} · Periode {m.periode} ·{' '}
                                <span className="font-mono-tabular">{m.noHp || '-'}</span>
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => openEditCommitteeMember(dusun, m)}
                                title="Edit Pengurus"
                                className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteCommitteeMember(dusun, m.id)
                                }
                                title="Hapus Pengurus"
                                className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* TAB 2: DATA RW & KETUA RW */}
      {subTab === 'rw' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3.5 sm:px-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Daftar Rukun Warga (RW) & Ketua RW
            </h3>
            <p className="text-xs text-slate-500">
              Pengaturan terpisah untuk pimpinan RW yang membawahi unit-unit RT di
              setiap dusun.
            </p>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {rws.map((rw) => {
              const st = statsByRw.get(rw.id) || { rtCount: 0, warga: 0, kk: 0 };
              return (
                <div key={rw.id} className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono-tabular text-sm font-bold text-slate-900">
                        RW {rw.rw} · {rw.namaDusun}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-teal-800">
                        Ketua RW: {rw.ketuaRw}
                      </p>
                      <p className="font-mono-tabular text-[11px] text-slate-500">
                        HP {rw.noHpRw || '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditRw(rw)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRw(rw, st.rtCount)}
                        className="rounded-lg border border-red-200 p-2 text-red-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">{rw.keterangan || '-'}</p>
                  <p className="font-mono-tabular text-xs text-slate-500">
                    {st.rtCount} RT · {st.kk} KK · {st.warga} Warga
                  </p>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">Nomor RW</th>
                  <th className="py-2.5 px-3">Wilayah Dusun</th>
                  <th className="py-2.5 px-3">Nama Ketua RW</th>
                  <th className="py-2.5 px-3">No. HP Ketua RW</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-right">RT</th>
                  <th className="py-2.5 px-3 text-right">KK</th>
                  <th className="py-2.5 px-3 text-right">Warga</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rws.map((rw) => {
                  const st = statsByRw.get(rw.id) || { rtCount: 0, warga: 0, kk: 0 };
                  return (
                    <tr key={rw.id} className="hover:bg-slate-50">
                      <td className="py-3 pl-5 pr-3 font-mono-tabular text-xs font-bold text-slate-900">
                        RW {rw.rw}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-slate-800">
                        {rw.namaDusun} ({rw.dusunKode})
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-slate-900">
                        {rw.ketuaRw}
                      </td>
                      <td className="py-3 px-3 font-mono-tabular text-xs text-slate-600">
                        {rw.noHpRw || '-'}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                        {rw.keterangan || '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-xs text-slate-700">
                        {st.rtCount}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-xs text-slate-700">
                        {st.kk}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-xs font-semibold text-slate-900">
                        {st.warga}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditRw(rw)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit Ketua RW"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRw(rw, st.rtCount)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Hapus RW"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DATA RT & KETUA RT */}
      {subTab === 'rt' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3.5 sm:px-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Daftar Rukun Tetangga (RT) & Ketua RT
            </h3>
            <p className="text-xs text-slate-500">
              Unit RT terhubung langsung ke domisili warga, pengantar RT/RW, dan penandaan
              Peta Desa.
            </p>
          </div>

          {/* Mobile Cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {territories.map((unit) => {
              const counts = statsByRt.get(unit.id) || { warga: 0, kk: 0 };
              return (
                <div key={unit.id} className="space-y-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono-tabular text-sm font-bold text-slate-900">
                        RT {unit.rt} / RW {unit.rw}
                      </p>
                      <p className="text-xs font-medium text-slate-700">
                        {unit.namaDusun} ({unit.kode})
                      </p>
                      <p className="mt-1 text-xs font-semibold text-teal-800">
                        Ketua RT: {unit.kepalaWilayah}
                      </p>
                      <p className="font-mono-tabular text-[11px] text-slate-500">
                        HP {unit.noHp || '-'} · Luas {unit.luasWilayah || '-'}
                      </p>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-slate-900">
                      {counts.warga} Warga ({counts.kk} KK)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{unit.keterangan}</p>
                  <div className="flex items-center gap-2 pt-1">
                    {onOpenOnMap && (
                      <button
                        type="button"
                        onClick={() => onOpenOnMap(unit.id)}
                        className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 py-2 text-xs font-medium text-teal-700"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Lihat di Peta
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditRt(unit)}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTerritory(unit, counts.warga)}
                      className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">RT / RW</th>
                  <th className="py-2.5 px-3">Dusun</th>
                  <th className="py-2.5 px-3">Ketua RT</th>
                  <th className="py-2.5 px-3">No. HP Ketua RT</th>
                  <th className="py-2.5 px-3">Luas & Keterangan</th>
                  <th className="py-2.5 px-3 text-right">KK</th>
                  <th className="py-2.5 px-3 text-right">Warga</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {territories.map((unit) => {
                  const counts = statsByRt.get(unit.id) || { warga: 0, kk: 0 };
                  return (
                    <tr key={unit.id} className="hover:bg-slate-50">
                      <td className="py-3 pl-5 pr-3 font-mono-tabular text-xs font-bold text-slate-900">
                        RT {unit.rt} / RW {unit.rw}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-slate-800">
                        {unit.namaDusun} ({unit.kode})
                      </td>
                      <td className="py-3 px-3 text-xs font-semibold text-slate-900">
                        {unit.kepalaWilayah}
                      </td>
                      <td className="py-3 px-3 font-mono-tabular text-xs text-slate-600">
                        {unit.noHp || '-'}
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs">
                        <p className="font-medium text-slate-700">
                          {unit.luasWilayah || '-'}
                        </p>
                        <p className="truncate text-slate-500">{unit.keterangan}</p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-xs text-slate-700">
                        {counts.kk}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-xs font-semibold text-slate-900">
                        {counts.warga}
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {onOpenOnMap && (
                            <button
                              type="button"
                              onClick={() => onOpenOnMap(unit.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
                              title="Tandai atau lihat di Peta Desa"
                            >
                              <MapPin className="h-3 w-3" />
                              Peta
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditRt(unit)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            title="Edit Ketua RT"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTerritory(unit, counts.warga)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Hapus RT"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD/EDIT DUSUN & KEPALA DUSUN */}
      {dusunModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-teal-700" />
                <h3 className="text-base font-semibold text-slate-900">
                  {editingDusun
                    ? 'Edit Dusun & Kepala Dusun'
                    : 'Tambah Dusun & Kepala Dusun'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDusunModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleDusunSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kode Dusun *
                  </label>
                  <input
                    type="text"
                    required
                    value={dusunDraft.kode}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({ ...prev, kode: e.target.value }))
                    }
                    placeholder="DSN-01"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Dusun / Lingkungan *
                  </label>
                  <input
                    type="text"
                    required
                    value={dusunDraft.namaDusun}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({
                        ...prev,
                        namaDusun: e.target.value,
                      }))
                    }
                    placeholder="Dusun Krajan"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Kepala Dusun (Kadus) *
                  </label>
                  <input
                    type="text"
                    required
                    value={dusunDraft.kepalaDusun}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({
                        ...prev,
                        kepalaDusun: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    No. HP Kepala Dusun
                  </label>
                  <input
                    type="text"
                    value={dusunDraft.noHpKadus}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({
                        ...prev,
                        noHpKadus: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Perkiraan Luas Wilayah
                  </label>
                  <input
                    type="text"
                    value={dusunDraft.luasWilayah}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({
                        ...prev,
                        luasWilayah: e.target.value,
                      }))
                    }
                    placeholder="80 Ha"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Potensi & Keterangan Wilayah
                  </label>
                  <input
                    type="text"
                    value={dusunDraft.keterangan}
                    onChange={(e) =>
                      setDusunDraft((prev) => ({
                        ...prev,
                        keterangan: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setDusunModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Simpan Dusun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INPUT KEPENGURUSAN WILAYAH DUSUN */}
      {committeeModalOpen && targetDusunForCommittee && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingMember
                    ? 'Edit Pengurus Wilayah Dusun'
                    : 'Input Kepengurusan Wilayah Dusun'}
                </h3>
                <p className="text-xs text-slate-500">
                  {targetDusunForCommittee.namaDusun} ({targetDusunForCommittee.kode})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCommitteeModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCommitteeSubmit} className="space-y-4 p-5">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Jabatan Kepengurusan *
                </label>
                <select
                  value={memberJabatanPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMemberJabatanPreset(val);
                    if (val !== 'Pengurus Lainnya') {
                      setMemberDraft((prev) => ({ ...prev, jabatan: val }));
                    } else {
                      setMemberDraft((prev) => ({ ...prev, jabatan: '' }));
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                >
                  {JABATAN_DUSUN_PRESETS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              {memberJabatanPreset === 'Pengurus Lainnya' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Jabatan Khusus *
                  </label>
                  <input
                    type="text"
                    required
                    value={memberDraft.jabatan}
                    onChange={(e) =>
                      setMemberDraft((prev) => ({
                        ...prev,
                        jabatan: e.target.value,
                      }))
                    }
                    placeholder="Contoh: Ketua Gapoktan Dusun"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Nama Lengkap Pengurus *
                </label>
                <input
                  type="text"
                  required
                  value={memberDraft.nama}
                  onChange={(e) =>
                    setMemberDraft((prev) => ({ ...prev, nama: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    No. Telepon / HP
                  </label>
                  <input
                    type="text"
                    value={memberDraft.noHp}
                    onChange={(e) =>
                      setMemberDraft((prev) => ({
                        ...prev,
                        noHp: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Periode Masa Bakti
                  </label>
                  <input
                    type="text"
                    value={memberDraft.periode}
                    onChange={(e) =>
                      setMemberDraft((prev) => ({
                        ...prev,
                        periode: e.target.value,
                      }))
                    }
                    placeholder="2024–2029"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setCommitteeModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Simpan Pengurus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ADD/EDIT RW & KETUA RW */}
      {rwModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingRw ? 'Edit Data RW & Ketua RW' : 'Tambah RW & Ketua RW Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setRwModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRwSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Wilayah Dusun *
                  </label>
                  <select
                    value={rwDraft.dusunKode}
                    onChange={(e) => {
                      const d = dusuns.find((item) => item.kode === e.target.value);
                      setRwDraft((prev) => ({
                        ...prev,
                        dusunKode: d?.kode || e.target.value,
                        namaDusun: d?.namaDusun || prev.namaDusun,
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {dusuns.map((d) => (
                      <option key={d.id} value={d.kode}>
                        {d.namaDusun} ({d.kode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor RW *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={rwDraft.rw}
                    onChange={(e) =>
                      setRwDraft((prev) => ({
                        ...prev,
                        rw: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Ketua RW *
                  </label>
                  <input
                    type="text"
                    required
                    value={rwDraft.ketuaRw}
                    onChange={(e) =>
                      setRwDraft((prev) => ({ ...prev, ketuaRw: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    No. HP Ketua RW
                  </label>
                  <input
                    type="text"
                    value={rwDraft.noHpRw}
                    onChange={(e) =>
                      setRwDraft((prev) => ({ ...prev, noHpRw: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Keterangan Cakupan RW
                  </label>
                  <input
                    type="text"
                    value={rwDraft.keterangan}
                    onChange={(e) =>
                      setRwDraft((prev) => ({
                        ...prev,
                        keterangan: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setRwModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Simpan RW
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD/EDIT RT & KETUA RT */}
      {rtModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-3 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingRt ? 'Edit Data RT & Ketua RT' : 'Tambah RT & Ketua RT Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setRtModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleRtSubmit} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Wilayah Dusun *
                  </label>
                  <select
                    value={rtDraft.kode}
                    onChange={(e) => {
                      const d = dusuns.find((item) => item.kode === e.target.value);
                      const matchedRw = rws.find((r) => r.dusunKode === d?.kode);
                      setRtDraft((prev) => ({
                        ...prev,
                        kode: d?.kode || e.target.value,
                        namaDusun: d?.namaDusun || prev.namaDusun,
                        rw: matchedRw?.rw || prev.rw,
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {dusuns.map((d) => (
                      <option key={d.id} value={d.kode}>
                        {d.namaDusun} ({d.kode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Induk RW *
                  </label>
                  <select
                    value={rtDraft.rw}
                    onChange={(e) =>
                      setRtDraft((prev) => ({ ...prev, rw: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  >
                    {rws.map((r) => (
                      <option key={r.id} value={r.rw}>
                        RW {r.rw} — {r.namaDusun} ({r.ketuaRw})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor RT *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    value={rtDraft.rt}
                    onChange={(e) =>
                      setRtDraft((prev) => ({
                        ...prev,
                        rt: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Ketua RT *
                  </label>
                  <input
                    type="text"
                    required
                    value={rtDraft.kepalaWilayah}
                    onChange={(e) =>
                      setRtDraft((prev) => ({
                        ...prev,
                        kepalaWilayah: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    No. HP Ketua RT
                  </label>
                  <input
                    type="text"
                    value={rtDraft.noHp}
                    onChange={(e) =>
                      setRtDraft((prev) => ({ ...prev, noHp: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Perkiraan Luas Wilayah RT
                  </label>
                  <input
                    type="text"
                    value={rtDraft.luasWilayah}
                    onChange={(e) =>
                      setRtDraft((prev) => ({
                        ...prev,
                        luasWilayah: e.target.value,
                      }))
                    }
                    placeholder="Contoh: 42 Ha"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Keterangan / Batas Wilayah RT
                  </label>
                  <input
                    type="text"
                    value={rtDraft.keterangan}
                    onChange={(e) =>
                      setRtDraft((prev) => ({
                        ...prev,
                        keterangan: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setRtModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  Simpan RT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
