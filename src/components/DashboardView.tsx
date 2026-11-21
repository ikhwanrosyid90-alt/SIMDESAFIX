import React, { useRef, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  Cloud,
  FileText,
  Home,
  MapPin,
  Pencil,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  DusunUnit,
  LetterRecord,
  Resident,
  RwUnit,
  TerritoryUnit,
  VillageProfile,
} from '../types/village';
import { DEFAULT_KADES_AVATAR, DEFAULT_PEMDA_LOGO } from '../data/seedData';
import {
  formatIndonesianDate,
  resizeImageFileToDataUrl,
  summarizeVillageHousing,
} from '../utils/villageHelpers';
import { GoogleSignInButton } from './GoogleSignInButton';

interface DashboardViewProps {
  profile: VillageProfile;
  residents: Resident[];
  dusuns?: DusunUnit[];
  rws?: RwUnit[];
  territories: TerritoryUnit[];
  letters: LetterRecord[];
  isGoogleConnected: boolean;
  connectedSpreadsheetTitle: string | null;
  lastSyncedAt: string | null;
  onUpdateProfile: (nextProfile: VillageProfile) => void;
  onNavigate: (tab: ActiveTab) => void;
  onQuickAddResident: () => void;
  onGoogleLogin: () => void;
  onSyncNow: () => void;
  onUploadLogoToDrive?: (dataUrl: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  residents,
  dusuns = [],
  rws = [],
  territories,
  letters,
  isGoogleConnected,
  connectedSpreadsheetTitle,
  lastSyncedAt,
  onUpdateProfile,
  onNavigate,
  onQuickAddResident,
  onGoogleLogin,
  onSyncNow,
  onUploadLogoToDrive,
}) => {
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [draft, setDraft] = useState<VillageProfile>(profile);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeResidents = residents.filter(
    (r) => r.statusKependudukan === 'Tetap' || r.statusKependudukan === 'Pendatang'
  );
  const housing = summarizeVillageHousing(activeResidents);
  const maleCount = activeResidents.filter((r) => r.jenisKelamin === 'Laki-laki').length;
  const femaleCount = activeResidents.filter((r) => r.jenisKelamin === 'Perempuan').length;
  const uniqueDusunCount = dusuns.length > 0 ? dusuns.length : new Set(territories.map((t) => t.namaDusun)).size;
  const uniqueRwCount = rws.length > 0 ? rws.length : new Set(territories.map((t) => `${t.namaDusun}-${t.rw}`)).size;
  const activeAssistanceCount = activeResidents.filter((r) =>
    (r.bantuanList || []).some((b) => b.status === 'Aktif')
  ).length;
  const docsCompleteCount = activeResidents.filter(
    (r) => Boolean(r.ktpFileUrl) && Boolean(r.kkFileUrl)
  ).length;

  const openEditor = () => {
    setDraft(profile);
    setUploadError(null);
    setIsEditingIdentity(true);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const optimizedUrl = await resizeImageFileToDataUrl(file, 360);
      setDraft((prev) => ({ ...prev, logoPemdaUrl: optimizedUrl }));
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal memproses berkas logo.'
      );
    }
  };

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...draft,
      updatedAt: new Date().toISOString(),
    });
    setIsEditingIdentity(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Breakdown by Dusun for quick overview
  const dusunSummary = Array.from(
    territories.reduce((acc, t) => {
      const key = t.namaDusun;
      if (!acc.has(key)) {
        acc.set(key, { namaDusun: key, rtCount: 0, ids: new Set<string>() });
      }
      const entry = acc.get(key)!;
      entry.rtCount += 1;
      entry.ids.add(t.id);
      return acc;
    }, new Map<string, { namaDusun: string; rtCount: number; ids: Set<string> }>())
  ).map(([, info]) => {
    const warga = activeResidents.filter((r) => info.ids.has(r.dusunId));
    const dusunHousing = summarizeVillageHousing(warga);
    return {
      namaDusun: info.namaDusun,
      rtCount: info.rtCount,
      totalWarga: warga.length,
      totalKk: dusunHousing.totalKk,
      totalRumah: dusunHousing.totalRumah,
      rtlhCount: dusunHousing.rtlhCount,
    };
  });

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Village Identity & Leadership Card (Direct Edit Nama Desa, Kepala Desa & Logo Pemda) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
          <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5">
              <img
                src={profile.logoPemdaUrl || DEFAULT_PEMDA_LOGO}
                alt={`Logo Pemerintah Daerah Kabupaten ${profile.kabupaten}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_PEMDA_LOGO;
                }}
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Pemerintah Kabupaten {profile.kabupaten}</span>
                <span aria-hidden="true">·</span>
                <span>Kecamatan {profile.kecamatan}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">Kode {profile.kodeDesa}</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 text-balance">
                Desa {profile.namaDesa}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {profile.alamatKantor} · Kode Pos {profile.kodePos}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <img
                    src={DEFAULT_KADES_AVATAR}
                    alt={profile.namaKepalaDesa}
                    referrerPolicy="no-referrer"
                    className="h-6 w-6 rounded-full object-cover border border-slate-200"
                  />
                  <span>
                    Kepala Desa:{' '}
                    <strong className="font-semibold text-slate-900">
                      {profile.namaKepalaDesa}
                    </strong>
                  </span>
                </div>
                {profile.nipKepalaDesa && (
                  <span className="font-mono-tabular text-slate-500">
                    NIP/NIAP {profile.nipKepalaDesa}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <Check className="h-4 w-4" />
                Identitas desa diperbarui
              </span>
            )}
            <button
              type="button"
              onClick={openEditor}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 text-teal-700" />
              Edit Desa, Kades & Logo Pemda
            </button>
            <button
              type="button"
              onClick={onQuickAddResident}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              + Tambah Warga Baru
            </button>
          </div>
        </div>

        {/* Inline Expandable Editor for Nama Desa, Kepala Desa & Logo Pemda */}
        {isEditingIdentity && (
          <form
            onSubmit={handleSaveIdentity}
            className="mt-6 border-t border-slate-200 pt-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Pengaturan Identitas Desa, Kepala Desa & Logo Pemerintah Daerah
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Perubahan otomatis diterapkan pada Kop Surat dan seluruh laporan resmi.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingIdentity(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Logo Upload Column */}
              <div className="lg:col-span-4">
                <label className="block text-xs font-medium text-slate-700">
                  Logo Pemerintah Daerah (Kop Surat)
                </label>
                <div className="mt-2 flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center">
                  <div className="h-24 w-24 overflow-hidden rounded-lg border border-slate-200 bg-white p-2">
                    <img
                      src={draft.logoPemdaUrl || DEFAULT_PEMDA_LOGO}
                      alt="Pratinjau Logo Pemda"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileChange}
                    className="hidden"
                  />
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Unggah Logo
                    </button>
                    {draft.logoPemdaUrl !== DEFAULT_PEMDA_LOGO && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            logoPemdaUrl: DEFAULT_PEMDA_LOGO,
                          }))
                        }
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
                      >
                        Reset Default
                      </button>
                    )}
                    {isGoogleConnected && onUploadLogoToDrive && (
                      <button
                        type="button"
                        onClick={() => onUploadLogoToDrive(draft.logoPemdaUrl)}
                        className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-medium text-teal-800 hover:bg-teal-100"
                      >
                        Simpan ke Drive
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Format PNG/JPG transparan disarankan (maks. otomatis dioptimasi).
                  </p>
                  {uploadError && (
                    <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>
                  )}
                </div>
              </div>

              {/* Fields Column */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-8">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Desa
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.namaDesa}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, namaDesa: e.target.value }))
                    }
                    placeholder="Contoh: Sukamaju"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kode Wilayah Desa
                  </label>
                  <input
                    type="text"
                    value={draft.kodeDesa}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, kodeDesa: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Nama Kepala Desa
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.namaKepalaDesa}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        namaKepalaDesa: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    NIP / NIAP Kepala Desa
                  </label>
                  <input
                    type="text"
                    value={draft.nipKepalaDesa}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        nipKepalaDesa: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.kecamatan}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, kecamatan: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kabupaten / Kota
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.kabupaten}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, kabupaten: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Alamat Kantor Desa
                  </label>
                  <input
                    type="text"
                    required
                    value={draft.alamatKantor}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        alamatKantor: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Kode Pos
                  </label>
                  <input
                    type="text"
                    value={draft.kodePos}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, kodePos: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Telepon Kantor
                  </label>
                  <input
                    type="text"
                    value={draft.telepon}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, telepon: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsEditingIdentity(false)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
              >
                Simpan Perubahan Desa
              </button>
            </div>
          </form>
        )}
      </section>

      {/* 5-Column KPI Strip */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Penduduk Aktif</span>
            <Users className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900">
            {activeResidents.length}
          </p>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {maleCount} L · {femaleCount} P · {docsCompleteCount} berkas lengkap
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kepala Keluarga (KK)</span>
            <Building2 className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900">
            {housing.totalKk}
          </p>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {housing.menumpangCount} menumpang · {activeAssistanceCount} bansos aktif
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Jumlah Rumah</span>
            <Home className="h-4 w-4 text-teal-700" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900">
            {housing.totalRumah}
          </p>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {housing.milikSendiriCount} milik sendiri · {housing.sewaCount} sewa
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Konstruksi & RTLH</span>
            <FileText className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900">
            {housing.rtlhCount} RTLH
          </p>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {housing.permanenCount} tembok · {housing.semiPermanenCount} semi · {housing.kayuCount} kayu
          </p>
        </div>

        <div className="col-span-2 md:col-span-1 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Wilayah & Surat</span>
            <MapPin className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 font-mono-tabular text-2xl sm:text-3xl font-semibold text-slate-900">
            {uniqueDusunCount} Dusun
          </p>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-500 tabular-nums">
            {uniqueRwCount} RW · {territories.length} RT · {letters.length} surat
          </p>
        </div>
      </section>

      {/* Main Split: Google Sheets Real-Time Sync Banner + Dusun Summary & Recent Letters */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Sebaran Kewilayahan */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Rekapitulasi Penduduk, Rumah & RTLH per Dusun
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Jumlah rumah tidak menghitung KK berstatus menumpang; RTLH mencakup calon & penerima bantuan.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('statistik')}
              className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 whitespace-nowrap shrink-0"
            >
              Lihat Statistik Lengkap
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">Wilayah Dusun</th>
                  <th className="py-2.5 px-2.5 text-right">RT</th>
                  <th className="py-2.5 px-2.5 text-right">KK</th>
                  <th className="py-2.5 px-2.5 text-right">Rumah</th>
                  <th className="py-2.5 px-2.5 text-right">RTLH</th>
                  <th className="py-2.5 pl-2.5 text-right">Penduduk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dusunSummary.map((row) => (
                  <tr key={row.namaDusun} className="hover:bg-slate-50/70">
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {row.namaDusun}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono-tabular text-slate-600">
                      {row.rtCount}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono-tabular text-slate-600">
                      {row.totalKk}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono-tabular font-medium text-teal-800">
                      {row.totalRumah}
                    </td>
                    <td className="py-3 px-2.5 text-right font-mono-tabular font-medium text-amber-700">
                      {row.rtlhCount}
                    </td>
                    <td className="py-3 pl-2.5 text-right font-mono-tabular font-semibold text-slate-900">
                      {row.totalWarga}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Recent Letters */}
          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-900">
                Arsip Surat Terbaru
              </h4>
              <button
                type="button"
                onClick={() => onNavigate('surat')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800"
              >
                Kelola Surat
              </button>
            </div>
            {letters.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Belum ada surat yang diterbitkan.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {letters.slice(0, 4).map((ltr) => (
                  <div
                    key={ltr.id}
                    className="flex items-center justify-between gap-4 py-2.5 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {ltr.judulSurat} — {ltr.residentNama}
                      </p>
                      <p className="mt-0.5 truncate text-slate-500">
                        <span className="font-mono-tabular">{ltr.nomorSurat}</span> ·{' '}
                        {ltr.keperluan}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono-tabular text-slate-500">
                      {formatIndonesianDate(ltr.tanggalTerbit)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right: Google Sheets & Drive Real-Time Connection Card */}
        <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-teal-700">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Integrasi Google Sheets & Drive
                </h3>
                <p className="text-xs text-slate-500">
                  {isGoogleConnected
                    ? 'Akun Google Workspace terhubung'
                    : 'Belum terhubung ke Google Workspace'}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Status Koneksi</span>
                <span
                  className={`font-semibold ${
                    isGoogleConnected ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isGoogleConnected ? 'Terhubung' : 'Perlu Masuk Akun Google'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Spreadsheet Aktif</span>
                <span className="truncate font-medium text-slate-900 max-w-[180px]">
                  {connectedSpreadsheetTitle || 'Belum dipilih'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">Sinkronisasi Terakhir</span>
                <span className="font-mono-tabular text-slate-700">
                  {lastSyncedAt
                    ? new Date(lastSyncedAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '-'}
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-slate-600">
              Hubungkan spreadsheet Google Sheets desa untuk menyinkronkan data warga,
              kewilayahan, dan arsip surat secara real-time lintas perangkat desa.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5">
            {!isGoogleConnected ? (
              <GoogleSignInButton
                onClick={onGoogleLogin}
                label="Sign in with Google"
                className="w-full"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onSyncNow}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Sinkronkan Sheets
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('sinkronisasi')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Pengaturan Sync
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
