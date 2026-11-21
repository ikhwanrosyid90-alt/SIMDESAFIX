import React, { useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import { Resident, TerritoryUnit, VillageProfile } from '../types/village';
import { calculateAge, exportResidentsToCsv, summarizeVillageHousing } from '../utils/villageHelpers';
import { DEFAULT_PEMDA_LOGO } from '../data/seedData';

interface StatisticsViewProps {
  profile: VillageProfile;
  residents: Resident[];
  territories: TerritoryUnit[];
}

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  profile,
  residents,
  territories,
}) => {
  const activeResidents = useMemo(
    () =>
      residents.filter(
        (r) => r.statusKependudukan === 'Tetap' || r.statusKependudukan === 'Pendatang'
      ),
    [residents]
  );

  const stats = useMemo(() => {
    const total = activeResidents.length;
    const male = activeResidents.filter((r) => r.jenisKelamin === 'Laki-laki').length;
    const female = activeResidents.filter((r) => r.jenisKelamin === 'Perempuan').length;
    const kk = new Set(activeResidents.map((r) => r.noKk)).size;

    const ageGroups = [
      { label: 'Balita (0–4 thn)', min: 0, max: 4 },
      { label: 'Anak (5–14 thn)', min: 5, max: 14 },
      { label: 'Pemuda (15–24 thn)', min: 15, max: 24 },
      { label: 'Produktif (25–44 thn)', min: 25, max: 44 },
      { label: 'Pra-Lansia (45–59 thn)', min: 45, max: 59 },
      { label: 'Lansia (60+ thn)', min: 60, max: 150 },
    ].map((grp) => {
      const inGroup = activeResidents.filter((r) => {
        const age = calculateAge(r.tanggalLahir);
        return age >= grp.min && age <= grp.max;
      });
      const l = inGroup.filter((r) => r.jenisKelamin === 'Laki-laki').length;
      const p = inGroup.filter((r) => r.jenisKelamin === 'Perempuan').length;
      return { ...grp, l, p, total: inGroup.length };
    });

    const countBy = (getter: (r: Resident) => string) => {
      const map = new Map<string, number>();
      for (const r of activeResidents) {
        const key = getter(r) || 'Lainnya';
        map.set(key, (map.get(key) || 0) + 1);
      }
      return Array.from(map.entries())
        .map(([label, count]) => ({
          label,
          count,
          pct: total > 0 ? Math.round((count / total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count);
    };

    const education = countBy((r) => r.pendidikan);
    const religion = countBy((r) => r.agama);
    const occupation = countBy((r) => r.pekerjaan);
    const marital = countBy((r) => r.statusPerkawinan);

    const housing = summarizeVillageHousing(activeResidents);

    const territoryRows = territories.map((t) => {
      const list = activeResidents.filter((r) => r.dusunId === t.id);
      const l = list.filter((r) => r.jenisKelamin === 'Laki-laki').length;
      const p = list.filter((r) => r.jenisKelamin === 'Perempuan').length;
      const tHousing = summarizeVillageHousing(list);
      return {
        ...t,
        l,
        p,
        total: list.length,
        kkCount: tHousing.totalKk,
        rumahCount: tHousing.totalRumah,
        rtlhCount: tHousing.rtlhCount,
      };
    });

    const ktpUploaded = activeResidents.filter((r) => Boolean(r.ktpFileUrl)).length;
    const kkUploaded = activeResidents.filter((r) => Boolean(r.kkFileUrl)).length;
    const bantuanMap = new Map<string, { aktif: number; selesai: number }>();
    let totalPenerimaAktif = 0;

    for (const r of activeResidents) {
      const list = r.bantuanList || [];
      if (list.some((b) => b.status === 'Aktif')) {
        totalPenerimaAktif += 1;
      }
      for (const b of list) {
        const entry = bantuanMap.get(b.namaProgram) || { aktif: 0, selesai: 0 };
        if (b.status === 'Aktif') entry.aktif += 1;
        else entry.selesai += 1;
        bantuanMap.set(b.namaProgram, entry);
      }
    }

    const assistancePrograms = Array.from(bantuanMap.entries())
      .map(([program, counts]) => ({
        program,
        aktif: counts.aktif,
        selesai: counts.selesai,
        total: counts.aktif + counts.selesai,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      total,
      male,
      female,
      kk,
      sexRatio: female > 0 ? Math.round((male / female) * 100) : 0,
      ageGroups,
      education,
      religion,
      occupation,
      marital,
      territoryRows,
      ktpUploaded,
      kkUploaded,
      totalPenerimaAktif,
      assistancePrograms,
      housing,
    };
  }, [activeResidents, territories]);

  const territoryMap = useMemo(
    () => new Map(territories.map((t) => [t.id, t])),
    [territories]
  );

  const maxAgeGroup = Math.max(1, ...stats.ageGroups.map((g) => g.total));

  const handleExportCsv = () => {
    const csv = exportResidentsToCsv(activeResidents, territories);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `statistik-penduduk-${profile.namaDesa.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar (no-print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Laporan Statistik Kependudukan Otomatis
          </h3>
          <p className="text-xs text-slate-500">
            Agregasi real-time dari {stats.total} penduduk aktif dan {stats.kk} Kartu
            Keluarga Desa {profile.namaDesa}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Unduh CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <Printer className="h-3.5 w-3.5" />
            Cetak Laporan Resmi
          </button>
        </div>
      </div>

      {/* Printable Report Area */}
      <div className="print-only-sheet space-y-6">
        {/* Print-only Official Letterhead */}
        <div className="hidden print:flex items-center gap-4 border-b-2 border-slate-900 pb-4">
          <img
            src={profile.logoPemdaUrl || DEFAULT_PEMDA_LOGO}
            alt="Logo Daerah"
            className="h-16 w-16 object-contain"
          />
          <div className="flex-1 text-center">
            <p className="text-xs font-bold uppercase">
              Pemerintah Kabupaten {profile.kabupaten} · Kecamatan {profile.kecamatan}
            </p>
            <p className="text-lg font-bold uppercase">
              Laporan Statistik Kependudukan Desa {profile.namaDesa}
            </p>
            <p className="text-[11px] text-slate-600">
              Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}
            </p>
          </div>
        </div>

        {/* Summary KPI Grid */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Penduduk Aktif</p>
            <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
              {stats.total}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Laki-laki / Perempuan</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold text-slate-900">
              {stats.male} / {stats.female}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              Rasio {stats.sexRatio} L / 100 P
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Kepala Keluarga (KK)</p>
            <p className="mt-1 font-mono-tabular text-2xl font-semibold text-slate-900">
              {stats.housing.totalKk}
            </p>
            <p className="mt-0.5 text-[11px] text-amber-700 tabular-nums">
              {stats.housing.menumpangCount} KK menumpang
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Jumlah Rumah</p>
            <p className="mt-1 font-mono-tabular text-2xl font-semibold text-teal-800">
              {stats.housing.totalRumah}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {stats.housing.milikSendiriCount} milik · {stats.housing.sewaCount} sewa
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Konstruksi Rumah</p>
            <p className="mt-1 font-mono-tabular text-xl font-semibold text-slate-900">
              {stats.housing.permanenCount} Tembok
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
              {stats.housing.semiPermanenCount} semi · {stats.housing.kayuCount} kayu
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Data RTLH</p>
            <p className="mt-1 font-mono-tabular text-2xl font-semibold text-red-700">
              {stats.housing.rtlhCount}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Calon & penerima RTLH
            </p>
          </div>
        </div>

        {/* Charts Grid: Age Groups & Education */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Kelompok Umur */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Distribusi Kelompok Umur & Jenis Kelamin
            </h4>
            <div className="mt-4 space-y-3.5">
              {stats.ageGroups.map((grp) => {
                const lPct = Math.round((grp.l / maxAgeGroup) * 100);
                const pPct = Math.round((grp.p / maxAgeGroup) * 100);
                return (
                  <div key={grp.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{grp.label}</span>
                      <span className="font-mono-tabular text-slate-600">
                        L {grp.l} · P {grp.p} · <strong>{grp.total}</strong>
                      </span>
                    </div>
                    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        style={{ width: `${lPct}%` }}
                        className="bg-teal-700"
                        title={`Laki-laki: ${grp.l}`}
                      />
                      <div
                        style={{ width: `${pPct}%` }}
                        className="bg-amber-500"
                        title={`Perempuan: ${grp.p}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-teal-700" />
                Laki-laki
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" />
                Perempuan
              </span>
            </div>
          </section>

          {/* Pendidikan Terakhir */}
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Tingkat Pendidikan Terakhir
            </h4>
            <div className="mt-4 space-y-3">
              {stats.education.map((item) => (
                <div key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-800">{item.label}</span>
                    <span className="font-mono-tabular text-slate-600">
                      {item.count} ({item.pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${item.pct}%` }}
                      className="h-full bg-slate-800"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Secondary Breakdowns: Pekerjaan, Agama, Status Perkawinan */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Komposisi Pekerjaan
            </h4>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {stats.occupation.map((o) => (
                <li key={o.label} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{o.label}</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {o.count} ({o.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Pemeluk Agama
            </h4>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {stats.religion.map((ag) => (
                <li key={ag.label} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{ag.label}</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {ag.count} ({ag.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h4 className="text-sm font-semibold text-slate-900">
              Status Perkawinan
            </h4>
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {stats.marital.map((m) => (
                <li key={m.label} className="flex items-center justify-between py-2">
                  <span className="text-slate-700">{m.label}</span>
                  <span className="font-mono-tabular font-medium text-slate-900">
                    {m.count} ({m.pct}%)
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Social Assistance & Document Completeness */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-slate-900">
                Rekapitulasi Penerima Bantuan Sosial
              </h4>
              <span className="font-mono-tabular text-xs font-medium text-teal-800">
                {stats.totalPenerimaAktif} warga penerima aktif
              </span>
            </div>
            {stats.assistancePrograms.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Belum ada data program bantuan tercatat.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Nama Program Bantuan</th>
                      <th className="py-2 px-3 text-right">Aktif</th>
                      <th className="py-2 px-3 text-right">Selesai</th>
                      <th className="py-2 pl-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.assistancePrograms.map((item) => (
                      <tr key={item.program}>
                        <td className="py-2.5 pr-3 font-medium text-slate-900">
                          {item.program}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-emerald-700 font-medium">
                          {item.aktif}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-500">
                          {item.selesai}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono-tabular font-semibold text-slate-900">
                          {item.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Kelengkapan Berkas KTP & Kartu Keluarga
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Persentase unggah dokumen digital warga aktif.
            </p>
            <div className="mt-4 space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">Berkas KTP-el</span>
                  <span className="font-mono-tabular text-slate-700">
                    {stats.ktpUploaded} / {stats.total} (
                    {stats.total > 0
                      ? Math.round((stats.ktpUploaded / stats.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{
                      width: `${
                        stats.total > 0
                          ? Math.round((stats.ktpUploaded / stats.total) * 100)
                          : 0
                      }%`,
                    }}
                    className="h-full bg-teal-700"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-800">
                    Berkas Kartu Keluarga (KK)
                  </span>
                  <span className="font-mono-tabular text-slate-700">
                    {stats.kkUploaded} / {stats.total} (
                    {stats.total > 0
                      ? Math.round((stats.kkUploaded / stats.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    style={{
                      width: `${
                        stats.total > 0
                          ? Math.round((stats.kkUploaded / stats.total) * 100)
                          : 0
                      }%`,
                    }}
                    className="h-full bg-amber-500"
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Housing Status, Construction & RTLH Roster */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-5">
            <h4 className="text-sm font-semibold text-slate-900">
              Kondisi Tempat Tinggal & Konstruksi Rumah
            </h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Perbandingan total {stats.housing.totalKk} KK dengan {stats.housing.totalRumah} unit rumah fisik.
            </p>

            <div className="mt-4 space-y-4 text-xs">
              <div>
                <p className="font-semibold text-slate-700">Status Kepemilikan (Basis KK)</p>
                <ul className="mt-2 space-y-2">
                  {[
                    {
                      label: 'Milik Sendiri',
                      count: stats.housing.milikSendiriCount,
                      color: 'bg-teal-700',
                    },
                    {
                      label: 'Menumpang (Tidak Tambah Unit Rumah)',
                      count: stats.housing.menumpangCount,
                      color: 'bg-amber-500',
                    },
                    {
                      label: 'Sewa / Kontrak',
                      count: stats.housing.sewaCount,
                      color: 'bg-slate-600',
                    },
                  ].map((item) => {
                    const pct =
                      stats.housing.totalKk > 0
                        ? Math.round((item.count / stats.housing.totalKk) * 100)
                        : 0;
                    return (
                      <li key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">{item.label}</span>
                          <span className="font-mono-tabular font-medium text-slate-900">
                            {item.count} KK ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${pct}%` }} className={`h-full ${item.color}`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="font-semibold text-slate-700">Konstruksi Bangunan (Basis Unit Rumah)</p>
                <ul className="mt-2 space-y-2">
                  {[
                    {
                      label: 'Permanen (Tembok)',
                      count: stats.housing.permanenCount,
                      color: 'bg-emerald-700',
                    },
                    {
                      label: 'Semi Permanen',
                      count: stats.housing.semiPermanenCount,
                      color: 'bg-slate-600',
                    },
                    {
                      label: 'Kayu / Papan / Bilik',
                      count: stats.housing.kayuCount,
                      color: 'bg-red-600',
                    },
                  ].map((item) => {
                    const pct =
                      stats.housing.totalRumah > 0
                        ? Math.round((item.count / stats.housing.totalRumah) * 100)
                        : 0;
                    return (
                      <li key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">{item.label}</span>
                          <span className="font-mono-tabular font-medium text-slate-900">
                            {item.count} Rumah ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div style={{ width: `${pct}%` }} className={`h-full ${item.color}`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Daftar Calon & Penerima Bantuan RTLH
                </h4>
                <p className="mt-0.5 text-xs text-slate-500">
                  Rumah Tidak Layak Huni / konstruksi kayu/papan untuk pengajuan bedah rumah desa.
                </p>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-red-700">
                {stats.housing.rtlhHouseholds.length} KK Terdata
              </span>
            </div>

            {stats.housing.rtlhHouseholds.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500">
                Belum ada warga yang ditandai sebagai Calon Penerima atau Penerima RTLH.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">Kepala Keluarga / No. KK</th>
                      <th className="py-2 px-3">Wilayah</th>
                      <th className="py-2 px-3">Konstruksi</th>
                      <th className="py-2 pl-3 text-right">Status RTLH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.housing.rtlhHouseholds.map((hh) => {
                      const terr = territoryMap.get(hh.representative.dusunId);
                      return (
                        <tr key={hh.noKk}>
                          <td className="py-2.5 pr-3">
                            <p className="font-medium text-slate-900">
                              {hh.representative.nama}
                            </p>
                            <p className="font-mono-tabular text-[11px] text-slate-500">
                              KK {hh.noKk} · {hh.statusRumah}
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {terr?.namaDusun || '-'} (RT {hh.representative.rt}/RW{' '}
                            {hh.representative.rw})
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {hh.kondisiRumah}
                          </td>
                          <td
                            className={`py-2.5 pl-3 text-right font-semibold ${
                              hh.statusRtlh === 'Penerima RTLH'
                                ? 'text-emerald-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {hh.statusRtlh}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* Territorial Breakdown Table */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-6 py-4">
            <h4 className="text-sm font-semibold text-slate-900">
              Rekapitulasi Penduduk, Rumah & RTLH per Dusun / RW / RT
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-6 pr-3">Dusun</th>
                  <th className="py-2.5 px-3">RW / RT</th>
                  <th className="py-2.5 px-3">Pengurus Wilayah</th>
                  <th className="py-2.5 px-3 text-right">KK</th>
                  <th className="py-2.5 px-3 text-right">Rumah</th>
                  <th className="py-2.5 px-3 text-right">RTLH</th>
                  <th className="py-2.5 px-3 text-right">Laki-laki</th>
                  <th className="py-2.5 px-3 text-right">Perempuan</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Total Jiwa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {stats.territoryRows.map((row) => (
                  <tr key={row.id}>
                    <td className="py-2.5 pl-6 pr-3 font-medium text-slate-900">
                      {row.namaDusun}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular text-slate-700">
                      RW {row.rw} / RT {row.rt}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{row.kepalaWilayah}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                      {row.kkCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-teal-800">
                      {row.rumahCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-medium text-amber-700">
                      {row.rtlhCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                      {row.l}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                      {row.p}
                    </td>
                    <td className="py-2.5 pl-3 pr-6 text-right font-mono-tabular font-semibold text-slate-900">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
