import React, { useMemo, useRef, useState } from 'react';
import {
  CloudUpload,
  Download,
  Eye,
  FileCheck,
  FileText,
  HandHeart,
  Home,
  Image as ImageIcon,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  AssistanceProgram,
  EducationLevel,
  Gender,
  HouseConditionType,
  HouseOwnershipStatus,
  LetterType,
  MaritalStatus,
  Religion,
  Resident,
  ResidentStatus,
  RtlhStatus,
  TerritoryUnit,
} from '../types/village';
import {
  calculateAge,
  exportResidentsToCsv,
  formatIndonesianDate,
  readDocumentFileAsDataUrl,
} from '../utils/villageHelpers';

interface ResidentsViewProps {
  residents: Resident[];
  territories: TerritoryUnit[];
  isGoogleConnected?: boolean;
  onSaveResident: (resident: Resident, isNew: boolean, syncKkHousing?: boolean) => void;
  onDeleteResident: (resident: Resident) => void;
  onInstantPrintLetter: (resident: Resident, letterType: LetterType) => void;
  onUploadDocToDrive?: (
    resident: Resident,
    docType: 'KTP' | 'KK',
    dataUrl: string,
    fileName: string
  ) => void;
  externalAddTrigger?: number;
}

const ASSISTANCE_PRESETS = [
  'PKH (Program Keluarga Harapan)',
  'BPNT / Sembako',
  'BLT Dana Desa',
  'PBI-JK / KIS',
  'PIP / Beasiswa Sekolah',
  'BSPS / Rutilahu',
  'Bantuan Modal UMKM Desa',
  'Program Bantuan Lainnya',
];

const EMPTY_RESIDENT = (defaultTerritory?: TerritoryUnit): Resident => ({
  id: '',
  nik: '',
  noKk: '',
  nama: '',
  jenisKelamin: 'Laki-laki',
  tempatLahir: '',
  tanggalLahir: '1990-01-01',
  agama: 'Islam',
  pendidikan: 'SMA/Sederajat',
  pekerjaan: '',
  statusPerkawinan: 'Kawin',
  hubunganKeluarga: 'Kepala Keluarga',
  golonganDarah: 'O',
  statusKependudukan: 'Tetap',
  kewarganegaraan: 'WNI',
  namaAyah: '',
  namaIbu: '',
  dusunId: defaultTerritory?.id || 'wil-1',
  rw: defaultTerritory?.rw || '001',
  rt: defaultTerritory?.rt || '001',
  alamat: '',
  noHp: '',
  statusRumah: 'Milik Sendiri',
  kondisiRumah: 'Permanen (Tembok)',
  statusRtlh: 'Layak Huni',
  ktpFileUrl: '',
  ktpFileName: '',
  kkFileUrl: '',
  kkFileName: '',
  bantuanList: [],
  updatedAt: new Date().toISOString(),
});

export const ResidentsView: React.FC<ResidentsViewProps> = ({
  residents,
  territories,
  isGoogleConnected = false,
  onSaveResident,
  onDeleteResident,
  onInstantPrintLetter,
  onUploadDocToDrive,
  externalAddTrigger = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ResidentStatus | 'Semua'>('Semua');
  const [dusunFilter, setDusunFilter] = useState<string>('Semua');
  const [bantuanFilter, setBantuanFilter] = useState<string>('Semua');
  const [rumahFilter, setRumahFilter] = useState<string>('Semua');
  const [selectedResident, setSelectedResident] = useState<Resident | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);
  const [formData, setFormData] = useState<Resident>(EMPTY_RESIDENT(territories[0]));
  const [syncKkHousing, setSyncKkHousing] = useState(true);
  const [housingTouched, setHousingTouched] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  // New assistance entry draft inside Add/Edit Resident modal
  const [bantuanDraft, setBantuanDraft] = useState<{
    namaProgram: string;
    customNama: string;
    tahun: string;
    nominalAtauBentuk: string;
    status: 'Aktif' | 'Selesai';
    keterangan: string;
  }>({
    namaProgram: ASSISTANCE_PRESETS[0],
    customNama: '',
    tahun: String(new Date().getFullYear()),
    nominalAtauBentuk: '',
    status: 'Aktif',
    keterangan: '',
  });

  // Document Lightbox Preview
  const [docPreviewModal, setDocPreviewModal] = useState<{
    title: string;
    url: string;
    fileName: string;
  } | null>(null);

  const ktpInputRef = useRef<HTMLInputElement | null>(null);
  const kkInputRef = useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (externalAddTrigger > 0) {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalAddTrigger]);

  const territoryMap = useMemo(
    () => new Map(territories.map((t) => [t.id, t])),
    [territories]
  );

  const uniqueDusunNames = useMemo(
    () => Array.from(new Set(territories.map((t) => t.namaDusun))),
    [territories]
  );

  const filteredResidents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return residents.filter((r) => {
      if (statusFilter !== 'Semua' && r.statusKependudukan !== statusFilter) {
        return false;
      }
      if (dusunFilter !== 'Semua') {
        const terr = territoryMap.get(r.dusunId);
        if (terr?.namaDusun !== dusunFilter) return false;
      }
      const bList = r.bantuanList || [];
      if (bantuanFilter === 'Penerima Aktif') {
        if (!bList.some((b) => b.status === 'Aktif')) return false;
      } else if (bantuanFilter === 'Pernah Menerima') {
        if (bList.length === 0) return false;
      } else if (bantuanFilter === 'Tidak Menerima') {
        if (bList.length > 0) return false;
      } else if (bantuanFilter !== 'Semua') {
        if (
          !bList.some((b) =>
            b.namaProgram.toLowerCase().includes(bantuanFilter.toLowerCase())
          )
        ) {
          return false;
        }
      }
      const statusRumah = r.statusRumah || 'Milik Sendiri';
      const kondisiRumah = r.kondisiRumah || 'Permanen (Tembok)';
      const statusRtlh = r.statusRtlh || 'Layak Huni';

      if (rumahFilter !== 'Semua') {
        if (rumahFilter === 'RTLH') {
          if (
            statusRtlh !== 'Calon Penerima RTLH' &&
            statusRtlh !== 'Penerima RTLH'
          ) {
            return false;
          }
        } else if (
          rumahFilter === 'Milik Sendiri' ||
          rumahFilter === 'Menumpang' ||
          rumahFilter === 'Sewa / Kontrak'
        ) {
          if (statusRumah !== rumahFilter) return false;
        } else if (
          rumahFilter === 'Permanen (Tembok)' ||
          rumahFilter === 'Semi Permanen' ||
          rumahFilter === 'Kayu / Papan / Bilik'
        ) {
          if (kondisiRumah !== rumahFilter) return false;
        } else if (
          rumahFilter === 'Calon Penerima RTLH' ||
          rumahFilter === 'Penerima RTLH'
        ) {
          if (statusRtlh !== rumahFilter) return false;
        }
      }

      if (!q) return true;
      return (
        r.nama.toLowerCase().includes(q) ||
        r.nik.toLowerCase().includes(q) ||
        r.noKk.toLowerCase().includes(q) ||
        r.alamat.toLowerCase().includes(q) ||
        r.pekerjaan.toLowerCase().includes(q) ||
        statusRumah.toLowerCase().includes(q) ||
        kondisiRumah.toLowerCase().includes(q) ||
        statusRtlh.toLowerCase().includes(q) ||
        bList.some((b) => b.namaProgram.toLowerCase().includes(q))
      );
    });
  }, [residents, searchQuery, statusFilter, dusunFilter, bantuanFilter, rumahFilter, territoryMap]);

  const familyMembers = useMemo(() => {
    if (!selectedResident) return [];
    return residents.filter(
      (r) => r.noKk === selectedResident.noKk && r.id !== selectedResident.id
    );
  }, [residents, selectedResident]);

  const openCreateModal = () => {
    setEditingResident(null);
    setFormData(EMPTY_RESIDENT(territories[0]));
    setSyncKkHousing(true);
    setHousingTouched(false);
    setFormError(null);
    setDocUploadError(null);
    setFormModalOpen(true);
  };

  const openEditModal = (resident: Resident) => {
    setEditingResident(resident);
    setFormData({
      ...resident,
      statusRumah: resident.statusRumah || 'Milik Sendiri',
      kondisiRumah: resident.kondisiRumah || 'Permanen (Tembok)',
      statusRtlh: resident.statusRtlh || 'Layak Huni',
      bantuanList: resident.bantuanList ? [...resident.bantuanList] : [],
    });
    setSyncKkHousing(true);
    setHousingTouched(true);
    setFormError(null);
    setDocUploadError(null);
    setFormModalOpen(true);
  };

  const handleTerritorySelect = (dusunId: string) => {
    const terr = territoryMap.get(dusunId);
    setFormData((prev) => ({
      ...prev,
      dusunId,
      rw: terr?.rw || prev.rw,
      rt: terr?.rt || prev.rt,
    }));
  };

  const handleUploadDoc = async (
    docType: 'KTP' | 'KK',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploadError(null);
    try {
      const { dataUrl, fileName } = await readDocumentFileAsDataUrl(file, 1080);
      setFormData((prev) =>
        docType === 'KTP'
          ? { ...prev, ktpFileUrl: dataUrl, ktpFileName: fileName }
          : { ...prev, kkFileUrl: dataUrl, kkFileName: fileName }
      );
    } catch (err) {
      setDocUploadError(
        err instanceof Error ? err.message : `Gagal memproses berkas ${docType}.`
      );
    } finally {
      e.target.value = '';
    }
  };

  const handleAddBantuan = () => {
    const finalName =
      bantuanDraft.namaProgram === 'Program Bantuan Lainnya'
        ? bantuanDraft.customNama.trim()
        : bantuanDraft.namaProgram;

    if (!finalName) return;

    const newItem: AssistanceProgram = {
      id: `bnt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      namaProgram: finalName,
      tahun: bantuanDraft.tahun.trim() || String(new Date().getFullYear()),
      nominalAtauBentuk: bantuanDraft.nominalAtauBentuk.trim() || '-',
      status: bantuanDraft.status,
      keterangan: bantuanDraft.keterangan.trim() || undefined,
    };

    setFormData((prev) => ({
      ...prev,
      bantuanList: [...(prev.bantuanList || []), newItem],
    }));

    setBantuanDraft((prev) => ({
      ...prev,
      customNama: '',
      nominalAtauBentuk: '',
      keterangan: '',
    }));
  };

  const handleRemoveBantuan = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      bantuanList: (prev.bantuanList || []).filter((b) => b.id !== id),
    }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const cleanNik = formData.nik.trim();
    const cleanKk = formData.noKk.trim();

    if (!/^\d{16}$/.test(cleanNik)) {
      setFormError('NIK harus terdiri dari tepat 16 digit angka.');
      return;
    }
    if (!/^\d{16}$/.test(cleanKk)) {
      setFormError('Nomor Kartu Keluarga (KK) harus terdiri dari tepat 16 digit angka.');
      return;
    }
    const duplicate = residents.find(
      (r) => r.nik === cleanNik && r.id !== editingResident?.id
    );
    if (duplicate) {
      setFormError(`NIK ${cleanNik} sudah terdaftar atas nama ${duplicate.nama}.`);
      return;
    }

    const saved: Resident = {
      ...formData,
      id: editingResident?.id || `res-${Date.now()}`,
      nik: cleanNik,
      noKk: cleanKk,
      statusRumah: formData.statusRumah || 'Milik Sendiri',
      kondisiRumah: formData.kondisiRumah || 'Permanen (Tembok)',
      statusRtlh: formData.statusRtlh || 'Layak Huni',
      bantuanList: formData.bantuanList || [],
      updatedAt: new Date().toISOString(),
    };
    onSaveResident(saved, !editingResident, syncKkHousing);
    if (selectedResident?.id === saved.id) {
      setSelectedResident(saved);
    }
    setFormModalOpen(false);
  };

  const handleDownloadCsv = () => {
    const csv = exportResidentsToCsv(filteredResidents, territories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data-penduduk-desa-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isPdfDataUrl = (url?: string) =>
    Boolean(url && url.startsWith('data:application/pdf'));

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari NIK, No. KK, nama warga, pekerjaan, atau bantuan..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Ekspor CSV
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex min-h-[40px] flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Tambah Penduduk
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3">
          <select
            value={dusunFilter}
            onChange={(e) => setDusunFilter(e.target.value)}
            aria-label="Filter Dusun"
            className="min-h-[38px] flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Dusun</option>
            {uniqueDusunNames.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={bantuanFilter}
            onChange={(e) => setBantuanFilter(e.target.value)}
            aria-label="Filter Program Bantuan"
            className="min-h-[38px] flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Penerima Bantuan</option>
            <option value="Penerima Aktif">Penerima Bantuan Aktif</option>
            <option value="Pernah Menerima">Semua Riwayat Penerima Bantuan</option>
            <option value="PKH">PKH</option>
            <option value="BPNT">BPNT / Sembako</option>
            <option value="BLT">BLT Dana Desa</option>
            <option value="PBI-JK">PBI-JK / KIS</option>
            <option value="PIP">PIP / Beasiswa Sekolah</option>
            <option value="UMKM">Bantuan Modal UMKM</option>
            <option value="Tidak Menerima">Tidak Menerima Bantuan</option>
          </select>

          <select
            value={rumahFilter}
            onChange={(e) => setRumahFilter(e.target.value)}
            aria-label="Filter Status Rumah dan RTLH"
            className="min-h-[38px] flex-1 sm:flex-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-teal-600 focus:outline-none"
          >
            <option value="Semua">Semua Status Rumah & RTLH</option>
            <option value="Milik Sendiri">Rumah: Milik Sendiri</option>
            <option value="Menumpang">Rumah: Menumpang</option>
            <option value="Sewa / Kontrak">Rumah: Sewa / Kontrak</option>
            <option value="Permanen (Tembok)">Konstruksi: Permanen (Tembok)</option>
            <option value="Semi Permanen">Konstruksi: Semi Permanen</option>
            <option value="Kayu / Papan / Bilik">Konstruksi: Kayu / Papan / Bilik</option>
            <option value="RTLH">Semua Calon & Penerima RTLH</option>
            <option value="Calon Penerima RTLH">Calon Penerima RTLH</option>
            <option value="Penerima RTLH">Penerima RTLH</option>
          </select>

          <div className="flex w-full sm:w-auto items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
            {(['Semua', 'Tetap', 'Pendatang', 'Pindah', 'Meninggal'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Data Container */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5">
          <span>
            Menampilkan <strong className="text-slate-900">{filteredResidents.length}</strong>{' '}
            dari <strong className="text-slate-900">{residents.length}</strong> data
            penduduk
          </span>
          <span className="hidden sm:inline">
            Klik baris warga untuk membuka profil, berkas KTP/KK, bantuan & cetak surat pengantar
          </span>
        </div>

        {/* MOBILE VIEW: Touch-friendly Card List */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredResidents.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Tidak ada data warga yang cocok
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Ubah kata kunci pencarian atau tambah data penduduk baru.
              </p>
            </div>
          ) : (
            filteredResidents.map((resident) => {
              const terr = territoryMap.get(resident.dusunId);
              const age = calculateAge(resident.tanggalLahir);
              const activeBantuan = (resident.bantuanList || []).filter(
                (b) => b.status === 'Aktif'
              );
              const hasKtp = Boolean(resident.ktpFileUrl);
              const hasKk = Boolean(resident.kkFileUrl);

              return (
                <div
                  key={resident.id}
                  onClick={() => setSelectedResident(resident)}
                  className="space-y-2.5 p-4 active:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{resident.nama}</p>
                      <p className="mt-0.5 font-mono-tabular text-xs text-slate-500">
                        NIK {resident.nik}
                      </p>
                      <p className="font-mono-tabular text-[11px] text-slate-400">
                        KK {resident.noKk}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-xs font-semibold ${
                        resident.statusKependudukan === 'Tetap'
                          ? 'text-emerald-700'
                          : resident.statusKependudukan === 'Pendatang'
                          ? 'text-amber-700'
                          : 'text-red-700'
                      }`}
                    >
                      {resident.statusKependudukan}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                    <span>
                      {resident.jenisKelamin === 'Laki-laki' ? 'L' : 'P'} · {age} thn
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {terr?.namaDusun || 'Desa'} (RT {resident.rt}/RW {resident.rw})
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{resident.pekerjaan}</span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">
                      Hunian:{' '}
                      <strong
                        className={
                          (resident.statusRumah || 'Milik Sendiri') === 'Menumpang'
                            ? 'text-amber-700'
                            : 'text-slate-800'
                        }
                      >
                        {resident.statusRumah || 'Milik Sendiri'}
                      </strong>{' '}
                      ·{' '}
                      <span className="text-slate-700">
                        {resident.kondisiRumah || 'Permanen (Tembok)'}
                      </span>
                      {(resident.statusRtlh === 'Calon Penerima RTLH' ||
                        resident.statusRtlh === 'Penerima RTLH') && (
                        <>
                          {' '}
                          ·{' '}
                          <strong className="text-red-700">
                            {resident.statusRtlh}
                          </strong>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="text-slate-600">
                      Bantuan:{' '}
                      <strong className="text-slate-800">
                        {activeBantuan.length > 0
                          ? activeBantuan.map((b) => b.namaProgram).join(', ')
                          : 'Tidak ada'}
                      </strong>
                    </span>
                    <span className="font-mono-tabular text-slate-500">
                      KTP:{' '}
                      <strong className={hasKtp ? 'text-emerald-700' : 'text-slate-400'}>
                        {hasKtp ? 'Ada' : 'Belum'}
                      </strong>{' '}
                      · KK:{' '}
                      <strong className={hasKk ? 'text-emerald-700' : 'text-slate-400'}>
                        {hasKk ? 'Ada' : 'Belum'}
                      </strong>
                    </span>
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-2 pt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onInstantPrintLetter(resident, 'pengantar')}
                      className="inline-flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Pengantar
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedResident(resident)}
                      className="inline-flex min-h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Profil
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(resident)}
                      aria-label={`Edit ${resident.nama}`}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteResident(resident)}
                      aria-label={`Hapus ${resident.nama}`}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* DESKTOP VIEW: Structured Table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                <th className="py-2.5 pl-5 pr-3">NIK / No. KK</th>
                <th className="py-2.5 px-3">Nama Lengkap</th>
                <th className="py-2.5 px-3">L/P · Usia</th>
                <th className="py-2.5 px-3">Wilayah (Dusun / RT-RW)</th>
                <th className="py-2.5 px-3">Hunian & RTLH</th>
                <th className="py-2.5 px-3">Pekerjaan & Bantuan</th>
                <th className="py-2.5 px-3">Berkas (KTP/KK)</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredResidents.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      Tidak ada data warga yang cocok
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Ubah kata kunci pencarian atau tambah data penduduk baru.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredResidents.map((resident) => {
                  const terr = territoryMap.get(resident.dusunId);
                  const age = calculateAge(resident.tanggalLahir);
                  const isSelected = selectedResident?.id === resident.id;
                  const bList = resident.bantuanList || [];
                  const activeBantuan = bList.filter((b) => b.status === 'Aktif');
                  const hasKtp = Boolean(resident.ktpFileUrl);
                  const hasKk = Boolean(resident.kkFileUrl);

                  return (
                    <tr
                      key={resident.id}
                      onClick={() => setSelectedResident(resident)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 pl-5 pr-3 align-middle">
                        <p className="font-mono-tabular text-xs font-medium text-slate-900">
                          {resident.nik}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-500">
                          KK {resident.noKk}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-middle">
                        <p className="font-medium text-slate-900">{resident.nama}</p>
                        <p className="text-xs text-slate-500">
                          {resident.hubunganKeluarga} · {resident.agama}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {resident.jenisKelamin === 'Laki-laki' ? 'L' : 'P'} · {age} thn
                      </td>
                      <td className="py-2.5 px-3 align-middle text-xs text-slate-700">
                        <p className="font-medium text-slate-800">
                          {terr?.namaDusun || 'Dusun Krajan'}
                        </p>
                        <p className="font-mono-tabular text-[11px] text-slate-500">
                          RT {resident.rt} / RW {resident.rw}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-xs text-slate-700">
                        <p
                          className={`font-medium ${
                            (resident.statusRumah || 'Milik Sendiri') === 'Menumpang'
                              ? 'text-amber-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {resident.statusRumah || 'Milik Sendiri'}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {resident.kondisiRumah || 'Permanen (Tembok)'}
                          {(resident.statusRtlh === 'Calon Penerima RTLH' ||
                            resident.statusRtlh === 'Penerima RTLH') && (
                            <span className="font-semibold text-red-700">
                              {' '}
                              · {resident.statusRtlh}
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-xs text-slate-700 max-w-[220px]">
                        <p className="truncate">{resident.pekerjaan}</p>
                        {bList.length > 0 && (
                          <p className="mt-0.5 truncate text-[11px] font-medium text-teal-800">
                            Bantuan:{' '}
                            {activeBantuan.length > 0
                              ? activeBantuan.map((b) => b.namaProgram).join(', ')
                              : `${bList[0].namaProgram} (Selesai)`}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 align-middle text-[11px] font-mono-tabular">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              hasKtp ? 'font-semibold text-emerald-700' : 'text-slate-400'
                            }
                          >
                            KTP {hasKtp ? '✓' : '—'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={
                              hasKk ? 'font-semibold text-emerald-700' : 'text-slate-400'
                            }
                          >
                            KK {hasKk ? '✓' : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 align-middle text-xs font-medium">
                        <span
                          className={
                            resident.statusKependudukan === 'Tetap'
                              ? 'text-emerald-700'
                              : resident.statusKependudukan === 'Pendatang'
                              ? 'text-amber-700'
                              : 'text-red-700'
                          }
                        >
                          {resident.statusKependudukan}
                        </span>
                      </td>
                      <td
                        className="py-2.5 pl-3 pr-5 text-right align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Cetak Surat Pengantar Instan"
                            onClick={() => onInstantPrintLetter(resident, 'pengantar')}
                            className="inline-flex items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-100 whitespace-nowrap"
                          >
                            <Printer className="h-3 w-3" />
                            Pengantar
                          </button>
                          <button
                            type="button"
                            title="Lihat Profil Warga"
                            onClick={() => setSelectedResident(resident)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Edit Data Warga"
                            onClick={() => openEditModal(resident)}
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Hapus Data Warga"
                            onClick={() => onDeleteResident(resident)}
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resident Profile Drawer */}
      {selectedResident && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/35 backdrop-blur-[1px]"
          onClick={() => setSelectedResident(null)}
        >
          <aside
            className="flex h-full w-full sm:max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">
                  Profil Kependudukan · {selectedResident.statusKependudukan}
                </p>
                <h3 className="mt-1 truncate text-lg sm:text-xl font-bold text-slate-900">
                  {selectedResident.nama}
                </h3>
                <p className="mt-0.5 font-mono-tabular text-xs text-slate-600">
                  NIK {selectedResident.nik} · KK {selectedResident.noKk}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResident(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Instant Letter Printing Section */}
            <div className="border-b border-slate-200 bg-teal-50/50 px-5 py-4 sm:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">
                    Layanan Surat Instan dari Profil Warga
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    Cetak langsung dengan biodata dan Kop Surat desa terisi otomatis.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onInstantPrintLetter(selectedResident, 'pengantar')}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak Surat Pengantar
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onInstantPrintLetter(selectedResident, 'domisili')}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileCheck className="h-3.5 w-3.5 text-teal-700" />
                  SK Domisili
                </button>
                <button
                  type="button"
                  onClick={() => onInstantPrintLetter(selectedResident, 'usaha')}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileCheck className="h-3.5 w-3.5 text-teal-700" />
                  SK Usaha
                </button>
                <button
                  type="button"
                  onClick={() => onInstantPrintLetter(selectedResident, 'sktm')}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileCheck className="h-3.5 w-3.5 text-teal-700" />
                  SK Tidak Mampu (SKTM)
                </button>
              </div>
            </div>

            {/* Biodata + Berkas + Bantuan */}
            <div className="flex-1 space-y-6 px-5 py-5 sm:px-6">
              <div>
                <h4 className="text-xs font-semibold text-slate-500">
                  Identitas & Kependudukan
                </h4>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Tempat, Tanggal Lahir</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.tempatLahir},{' '}
                      {formatIndonesianDate(selectedResident.tanggalLahir)} (
                      {calculateAge(selectedResident.tanggalLahir)} thn)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Jenis Kelamin</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.jenisKelamin}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Agama</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.agama}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Golongan Darah</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.golonganDarah}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pendidikan Terakhir</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.pendidikan}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Pekerjaan</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.pekerjaan}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status Perkawinan</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.statusPerkawinan}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">SHDK</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.hubunganKeluarga}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Nama Ayah / Ibu</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.namaAyah} / {selectedResident.namaIbu}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">No. Telepon / HP</dt>
                    <dd className="mt-0.5 font-mono-tabular font-medium text-slate-900">
                      {selectedResident.noHp || '-'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="border-t border-slate-200 pt-5">
                <h4 className="text-xs font-semibold text-slate-500">
                  Alamat & Kewilayahan
                </h4>
                <p className="mt-2 text-sm text-slate-900">
                  {selectedResident.alamat}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  {territoryMap.get(selectedResident.dusunId)?.namaDusun || 'Dusun Krajan'}{' '}
                  · RT {selectedResident.rt} / RW {selectedResident.rw}
                </p>
              </div>

              {/* Data Hunian & Kelayakan RTLH */}
              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <Home className="h-3.5 w-3.5" />
                    <span>Data Hunian & Kelayakan RTLH</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedResident)}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    Ubah Hunian
                  </button>
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-500">Status Tempat Tinggal</dt>
                    <dd
                      className={`mt-0.5 font-semibold ${
                        (selectedResident.statusRumah || 'Milik Sendiri') === 'Menumpang'
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {selectedResident.statusRumah || 'Milik Sendiri'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Konstruksi Bangunan</dt>
                    <dd className="mt-0.5 font-medium text-slate-900">
                      {selectedResident.kondisiRumah || 'Permanen (Tembok)'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Status RTLH</dt>
                    <dd
                      className={`mt-0.5 font-semibold ${
                        selectedResident.statusRtlh === 'Penerima RTLH' ||
                        selectedResident.statusRtlh === 'Calon Penerima RTLH'
                          ? 'text-red-700'
                          : 'text-emerald-700'
                      }`}
                    >
                      {selectedResident.statusRtlh || 'Layak Huni'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Berkas KTP & KK */}
              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <ImageIcon className="h-3.5 w-3.5" />
                    <span>Berkas Kependudukan (KTP & KK)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedResident)}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    Kelola Berkas
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(
                    [
                      {
                        label: 'KTP-el',
                        docType: 'KTP' as const,
                        url: selectedResident.ktpFileUrl,
                        name: selectedResident.ktpFileName,
                      },
                      {
                        label: 'Kartu Keluarga (KK)',
                        docType: 'KK' as const,
                        url: selectedResident.kkFileUrl,
                        name: selectedResident.kkFileName,
                      },
                    ] as const
                  ).map((doc) => (
                    <div
                      key={doc.docType}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs"
                    >
                      <p className="font-semibold text-slate-800">{doc.label}</p>
                      {doc.url ? (
                        <div className="mt-2 space-y-2">
                          {isPdfDataUrl(doc.url) ? (
                            <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white p-2.5">
                              <FileText className="h-5 w-5 shrink-0 text-teal-700" />
                              <span className="truncate text-[11px] font-medium text-slate-700">
                                {doc.name || `${doc.docType}.pdf`}
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setDocPreviewModal({
                                  title: `${doc.label} — ${selectedResident.nama}`,
                                  url: doc.url!,
                                  fileName: doc.name || `${doc.docType}.png`,
                                })
                              }
                              className="block w-full overflow-hidden rounded-md border border-slate-200 bg-white"
                            >
                              <img
                                src={doc.url}
                                alt={doc.label}
                                className="h-24 w-full object-cover"
                              />
                            </button>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setDocPreviewModal({
                                  title: `${doc.label} — ${selectedResident.nama}`,
                                  url: doc.url!,
                                  fileName: doc.name || `${doc.docType}`,
                                })
                              }
                              className="text-[11px] font-medium text-teal-700 hover:underline"
                            >
                              Pratinjau
                            </button>
                            <span className="text-slate-300">·</span>
                            <a
                              href={doc.url}
                              download={doc.name || `${doc.docType}_${selectedResident.nik}`}
                              className="text-[11px] font-medium text-slate-700 hover:underline"
                            >
                              Unduh
                            </a>
                            {isGoogleConnected && onUploadDocToDrive && (
                              <>
                                <span className="text-slate-300">·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUploadDocToDrive(
                                      selectedResident,
                                      doc.docType,
                                      doc.url!,
                                      doc.name || `${doc.docType}.png`
                                    )
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline"
                                >
                                  <CloudUpload className="h-3 w-3" />
                                  Drive
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          Belum diunggah
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Program Bantuan yang Diperoleh */}
              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <HandHeart className="h-3.5 w-3.5" />
                    <span>
                      Penerima Bantuan Sosial ({(selectedResident.bantuanList || []).length})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedResident)}
                    className="text-xs font-medium text-teal-700 hover:underline"
                  >
                    + Kelola Bantuan
                  </button>
                </div>

                {!selectedResident.bantuanList ||
                selectedResident.bantuanList.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Warga ini belum tercatat sebagai penerima program bantuan sosial.
                  </p>
                ) : (
                  <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-slate-50/70">
                    {selectedResident.bantuanList.map((b) => (
                      <li key={b.id} className="p-3 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">
                            {b.namaProgram}
                          </span>
                          <span
                            className={`font-semibold ${
                              b.status === 'Aktif'
                                ? 'text-emerald-700'
                                : 'text-slate-500'
                            }`}
                          >
                            {b.status} · {b.tahun}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-700">
                          Bentuk / Nominal: <strong>{b.nominalAtauBentuk}</strong>
                        </p>
                        {b.keterangan && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {b.keterangan}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Family Members */}
              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Anggota Satu Kartu Keluarga ({familyMembers.length})</span>
                </div>
                {familyMembers.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Tidak ada anggota keluarga lain terdaftar pada No. KK ini.
                  </p>
                ) : (
                  <ul className="mt-2.5 divide-y divide-slate-100">
                    {familyMembers.map((member) => (
                      <li
                        key={member.id}
                        className="flex items-center justify-between py-2 text-xs"
                      >
                        <div>
                          <button
                            type="button"
                            onClick={() => setSelectedResident(member)}
                            className="font-medium text-teal-700 hover:underline"
                          >
                            {member.nama}
                          </button>
                          <p className="text-slate-500">
                            {member.hubunganKeluarga} · {calculateAge(member.tanggalLahir)} thn
                          </p>
                        </div>
                        <span className="font-mono-tabular text-slate-500">
                          {member.nik}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => onDeleteResident(selectedResident)}
                className="rounded-lg border border-red-200 px-3.5 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
              >
                Hapus Warga
              </button>
              <button
                type="button"
                onClick={() => openEditModal(selectedResident)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Perbarui Biodata
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Document Lightbox Modal */}
      {docPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-[2px]"
          onClick={() => setDocPreviewModal(null)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-slate-900">
                  {docPreviewModal.title}
                </h4>
                <p className="truncate text-xs text-slate-500">
                  {docPreviewModal.fileName}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={docPreviewModal.url}
                  download={docPreviewModal.fileName}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </a>
                <button
                  type="button"
                  onClick={() => setDocPreviewModal(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center">
              {isPdfDataUrl(docPreviewModal.url) ? (
                <iframe
                  src={docPreviewModal.url}
                  title={docPreviewModal.title}
                  className="h-[70vh] w-full rounded border border-slate-200 bg-white"
                />
              ) : (
                <img
                  src={docPreviewModal.url}
                  alt={docPreviewModal.title}
                  className="max-h-[75vh] w-auto rounded-lg object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Resident Modal */}
      {formModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-2 sm:p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5 sm:px-6 sm:py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editingResident ? 'Perbarui Data Penduduk' : 'Tambah Data Penduduk Baru'}
                </h3>
                <p className="text-xs text-slate-500">
                  Lengkapi biodata, berkas KTP/KK, dan program bantuan yang diterima warga.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6">
              {formError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    NIK (16 Digit) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={formData.nik}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        nik: e.target.value.replace(/\D/g, ''),
                      }))
                    }
                    placeholder="320412xxxxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nomor Kartu Keluarga (16 Digit) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={16}
                    value={formData.noKk}
                    onChange={(e) => {
                      const nextKk = e.target.value.replace(/\D/g, '');
                      setFormData((prev) => {
                        const base = { ...prev, noKk: nextKk };
                        if (!editingResident && !housingTouched && nextKk.length === 16) {
                          const match = residents.find((r) => r.noKk === nextKk);
                          if (match) {
                            return {
                              ...base,
                              statusRumah: match.statusRumah || 'Milik Sendiri',
                              kondisiRumah: match.kondisiRumah || 'Permanen (Tembok)',
                              statusRtlh: match.statusRtlh || 'Layak Huni',
                            };
                          }
                        }
                        return base;
                      });
                    }}
                    placeholder="320412xxxxxxxxxx"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.nama}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, nama: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Jenis Kelamin
                  </label>
                  <select
                    value={formData.jenisKelamin}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        jenisKelamin: e.target.value as Gender,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Status Kependudukan
                  </label>
                  <select
                    value={formData.statusKependudukan}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        statusKependudukan: e.target.value as ResidentStatus,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Tetap">Tetap</option>
                    <option value="Pendatang">Pendatang</option>
                    <option value="Pindah">Pindah</option>
                    <option value="Meninggal">Meninggal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tempat Lahir *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.tempatLahir}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tempatLahir: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tanggal Lahir *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.tanggalLahir}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, tanggalLahir: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">Agama</label>
                  <select
                    value={formData.agama}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        agama: e.target.value as Religion,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {(['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'] as const).map(
                      (ag) => (
                        <option key={ag} value={ag}>
                          {ag}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Pendidikan Terakhir
                  </label>
                  <select
                    value={formData.pendidikan}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        pendidikan: e.target.value as EducationLevel,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {(
                      [
                        'Tidak/Belum Sekolah',
                        'SD/Sederajat',
                        'SMP/Sederajat',
                        'SMA/Sederajat',
                        'Diploma (D1-D3)',
                        'Sarjana (S1/D4)',
                        'Pascasarjana (S2/S3)',
                      ] as const
                    ).map((ed) => (
                      <option key={ed} value={ed}>
                        {ed}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Pekerjaan *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.pekerjaan}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, pekerjaan: e.target.value }))
                    }
                    placeholder="Contoh: Petani, Pedagang, Wiraswasta"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Status Perkawinan
                  </label>
                  <select
                    value={formData.statusPerkawinan}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        statusPerkawinan: e.target.value as MaritalStatus,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Belum Kawin">Belum Kawin</option>
                    <option value="Kawin">Kawin</option>
                    <option value="Cerai Hidup">Cerai Hidup</option>
                    <option value="Cerai Mati">Cerai Mati</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Hubungan dalam Keluarga (SHDK)
                  </label>
                  <select
                    value={formData.hubunganKeluarga}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        hubunganKeluarga: e.target.value as Resident['hubunganKeluarga'],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Kepala Keluarga">Kepala Keluarga</option>
                    <option value="Istri">Istri</option>
                    <option value="Anak">Anak</option>
                    <option value="Orang Tua">Orang Tua</option>
                    <option value="Famili Lain">Famili Lain</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Golongan Darah
                  </label>
                  <select
                    value={formData.golonganDarah}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        golonganDarah: e.target.value as Resident['golonganDarah'],
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="AB">AB</option>
                    <option value="O">O</option>
                    <option value="Tidak Tahu">Tidak Tahu</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Wilayah (Dusun / RW / RT) *
                  </label>
                  <select
                    value={formData.dusunId}
                    onChange={(e) => handleTerritorySelect(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    {territories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.namaDusun} — RT {t.rt} / RW {t.rw}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    No. Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formData.noHp}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, noHp: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Alamat Lengkap (Jalan / Kampung / Blok) *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.alamat}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, alamat: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Ayah Kandung
                  </label>
                  <input
                    type="text"
                    value={formData.namaAyah}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, namaAyah: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Ibu Kandung
                  </label>
                  <input
                    type="text"
                    value={formData.namaIbu}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, namaIbu: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Status Rumah, Konstruksi & Data RTLH */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-slate-900">
                      Status Tempat Tinggal, Konstruksi Rumah & Data RTLH
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Membedakan jumlah KK dengan jumlah rumah fisik (misal KK menumpang) serta pendataan rumah kayu/RTLH.
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Status Kepemilikan Rumah
                    </label>
                    <select
                      value={formData.statusRumah || 'Milik Sendiri'}
                      onChange={(e) => {
                        setHousingTouched(true);
                        setFormData((prev) => ({
                          ...prev,
                          statusRumah: e.target.value as HouseOwnershipStatus,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="Milik Sendiri">Milik Sendiri</option>
                      <option value="Menumpang">Menumpang</option>
                      <option value="Sewa / Kontrak">Sewa / Kontrak</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Konstruksi / Kondisi Rumah
                    </label>
                    <select
                      value={formData.kondisiRumah || 'Permanen (Tembok)'}
                      onChange={(e) => {
                        setHousingTouched(true);
                        setFormData((prev) => ({
                          ...prev,
                          kondisiRumah: e.target.value as HouseConditionType,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="Permanen (Tembok)">Permanen (Tembok)</option>
                      <option value="Semi Permanen">Semi Permanen</option>
                      <option value="Kayu / Papan / Bilik">Kayu / Papan / Bilik</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Status Kelayakan / RTLH
                    </label>
                    <select
                      value={formData.statusRtlh || 'Layak Huni'}
                      onChange={(e) => {
                        setHousingTouched(true);
                        setFormData((prev) => ({
                          ...prev,
                          statusRtlh: e.target.value as RtlhStatus,
                        }));
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                      <option value="Layak Huni">Layak Huni</option>
                      <option value="Calon Penerima RTLH">Calon Penerima RTLH</option>
                      <option value="Penerima RTLH">Penerima RTLH</option>
                    </select>
                  </div>
                </div>

                {formData.statusRumah === 'Menumpang' && (
                  <p className="mt-2.5 text-[11px] font-medium text-amber-700">
                    Catatan: KK dengan status Menumpang tetap terhitung sebagai Kepala Keluarga, namun tidak menambah hitungan unit Jumlah Rumah pada Dashboard desa.
                  </p>
                )}

                {formData.kondisiRumah === 'Kayu / Papan / Bilik' &&
                  formData.statusRtlh === 'Layak Huni' && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                      <span>
                        Rumah konstruksi kayu/papan dapat diusulkan masuk daftar penerima bantuan RTLH.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setHousingTouched(true);
                          setFormData((prev) => ({
                            ...prev,
                            statusRtlh: 'Calon Penerima RTLH',
                          }));
                        }}
                        className="font-semibold text-amber-900 underline hover:text-amber-700"
                      >
                        Tandai Calon Penerima RTLH
                      </button>
                    </div>
                  )}

                <label className="mt-3 flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncKkHousing}
                    onChange={(e) => setSyncKkHousing(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  />
                  <span>
                    Terapkan status rumah, konstruksi, dan status RTLH ke seluruh anggota satu No. KK yang sama
                  </span>
                </label>
              </div>

              {/* Upload KTP & KK Section */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h4 className="text-xs font-semibold text-slate-900">
                  Unggah Berkas KTP & Kartu Keluarga (KK)
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Mendukung foto/scan JPG, PNG, WebP, atau dokumen PDF (maks. 2,5 MB).
                </p>

                {docUploadError && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {docUploadError}
                  </p>
                )}

                <input
                  ref={ktpInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleUploadDoc('KTP', e)}
                  className="hidden"
                />
                <input
                  ref={kkInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => handleUploadDoc('KK', e)}
                  className="hidden"
                />

                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* KTP Card */}
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">Scan / Foto KTP</span>
                      {formData.ktpFileUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              ktpFileUrl: '',
                              ktpFileName: '',
                            }))
                          }
                          className="text-[11px] font-medium text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {formData.ktpFileUrl ? (
                      <div className="mt-2 space-y-2">
                        {isPdfDataUrl(formData.ktpFileUrl) ? (
                          <div className="flex items-center gap-2 rounded border border-slate-200 bg-white p-2">
                            <FileText className="h-4 w-4 text-teal-700" />
                            <span className="truncate text-[11px]">
                              {formData.ktpFileName || 'Berkas KTP.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={formData.ktpFileUrl}
                            alt="Pratinjau KTP"
                            className="h-28 w-full rounded border border-slate-200 bg-white object-contain"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => ktpInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Upload className="h-3 w-3" />
                          Ganti Berkas KTP
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => ktpInputRef.current?.click()}
                        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Upload className="h-3.5 w-3.5 text-teal-700" />
                        Pilih Berkas KTP
                      </button>
                    )}
                  </div>

                  {/* KK Card */}
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">
                        Scan / Foto Kartu Keluarga (KK)
                      </span>
                      {formData.kkFileUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              kkFileUrl: '',
                              kkFileName: '',
                            }))
                          }
                          className="text-[11px] font-medium text-red-600 hover:underline"
                        >
                          Hapus
                        </button>
                      )}
                    </div>

                    {formData.kkFileUrl ? (
                      <div className="mt-2 space-y-2">
                        {isPdfDataUrl(formData.kkFileUrl) ? (
                          <div className="flex items-center gap-2 rounded border border-slate-200 bg-white p-2">
                            <FileText className="h-4 w-4 text-teal-700" />
                            <span className="truncate text-[11px]">
                              {formData.kkFileName || 'Berkas KK.pdf'}
                            </span>
                          </div>
                        ) : (
                          <img
                            src={formData.kkFileUrl}
                            alt="Pratinjau KK"
                            className="h-28 w-full rounded border border-slate-200 bg-white object-contain"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => kkInputRef.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Upload className="h-3 w-3" />
                          Ganti Berkas KK
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => kkInputRef.current?.click()}
                        className="mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Upload className="h-3.5 w-3.5 text-teal-700" />
                        Pilih Berkas KK
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Penerima Bantuan yang Diperoleh Section */}
              <div className="mt-6 border-t border-slate-200 pt-5">
                <h4 className="text-xs font-semibold text-slate-900">
                  Program Bantuan Sosial yang Diperoleh
                </h4>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Catat bantuan pemerintah atau desa yang sedang/pernah diterima warga ini.
                </p>

                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-700">
                        Nama Program Bantuan
                      </label>
                      <select
                        value={bantuanDraft.namaProgram}
                        onChange={(e) =>
                          setBantuanDraft((prev) => ({
                            ...prev,
                            namaProgram: e.target.value,
                          }))
                        }
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                      >
                        {ASSISTANCE_PRESETS.map((prog) => (
                          <option key={prog} value={prog}>
                            {prog}
                          </option>
                        ))}
                      </select>
                    </div>

                    {bantuanDraft.namaProgram === 'Program Bantuan Lainnya' ? (
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700">
                          Tulis Nama Program *
                        </label>
                        <input
                          type="text"
                          value={bantuanDraft.customNama}
                          onChange={(e) =>
                            setBantuanDraft((prev) => ({
                              ...prev,
                              customNama: e.target.value,
                            }))
                          }
                          placeholder="Contoh: Bantuan Pangan Cadangan Beras"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">
                            Tahun
                          </label>
                          <input
                            type="text"
                            maxLength={4}
                            value={bantuanDraft.tahun}
                            onChange={(e) =>
                              setBantuanDraft((prev) => ({
                                ...prev,
                                tahun: e.target.value.replace(/\D/g, ''),
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono-tabular text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-700">
                            Status
                          </label>
                          <select
                            value={bantuanDraft.status}
                            onChange={(e) =>
                              setBantuanDraft((prev) => ({
                                ...prev,
                                status: e.target.value as 'Aktif' | 'Selesai',
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                          >
                            <option value="Aktif">Aktif</option>
                            <option value="Selesai">Selesai</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-medium text-slate-700">
                        Nominal / Bentuk Bantuan
                      </label>
                      <input
                        type="text"
                        value={bantuanDraft.nominalAtauBentuk}
                        onChange={(e) =>
                          setBantuanDraft((prev) => ({
                            ...prev,
                            nominalAtauBentuk: e.target.value,
                          }))
                        }
                        placeholder="Contoh: Rp 300.000 / bulan atau Beras 10 Kg"
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-slate-700">
                          Keterangan (Opsional)
                        </label>
                        <input
                          type="text"
                          value={bantuanDraft.keterangan}
                          onChange={(e) =>
                            setBantuanDraft((prev) => ({
                              ...prev,
                              keterangan: e.target.value,
                            }))
                          }
                          placeholder="Bank penyalur / catatan..."
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBantuan}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 whitespace-nowrap shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Tambah
                      </button>
                    </div>
                  </div>

                  {formData.bantuanList && formData.bantuanList.length > 0 && (
                    <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                      {formData.bantuanList.map((b) => (
                        <li
                          key={b.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">
                              {b.namaProgram} ·{' '}
                              <span className="font-mono-tabular text-slate-500">
                                {b.tahun}
                              </span>{' '}
                              ·{' '}
                              <span
                                className={
                                  b.status === 'Aktif'
                                    ? 'text-emerald-700'
                                    : 'text-slate-500'
                                }
                              >
                                {b.status}
                              </span>
                            </p>
                            <p className="truncate text-[11px] text-slate-600">
                              {b.nominalAtauBentuk}
                              {b.keterangan ? ` — ${b.keterangan}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveBantuan(b.id)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Hapus bantuan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  {editingResident ? 'Simpan Perubahan' : 'Simpan Penduduk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
