import React, { useMemo, useState } from 'react';
import {
  Check,
  CloudUpload,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import {
  LetterCustomFields,
  LetterRecord,
  LetterTemplate,
  Resident,
  TerritoryUnit,
  VillageProfile,
} from '../types/village';
import {
  formatIndonesianDate,
  generateLetterNumber,
  interpolateTemplateText,
} from '../utils/villageHelpers';
import { DEFAULT_PEMDA_LOGO } from '../data/seedData';

interface LetterPreviewModalProps {
  open: boolean;
  resident: Resident | null;
  template: LetterTemplate;
  profile: VillageProfile;
  territory?: TerritoryUnit;
  existingRecord?: LetterRecord | null;
  nextSequenceNumber: number;
  initialCustomFields?: LetterCustomFields;
  isGoogleConnected: boolean;
  onClose: () => void;
  onSaveRecord: (record: LetterRecord) => void;
  onArchiveToDrive?: (record: LetterRecord, htmlContent: string) => void;
}

export const LetterPreviewModal: React.FC<LetterPreviewModalProps> = ({
  open,
  resident,
  template,
  profile,
  territory,
  existingRecord,
  nextSequenceNumber,
  initialCustomFields,
  isGoogleConnected,
  onClose,
  onSaveRecord,
  onArchiveToDrive,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [tanggalTerbit, setTanggalTerbit] = useState(
    existingRecord?.tanggalTerbit || todayStr
  );
  const [customFields, setCustomFields] = useState<LetterCustomFields>(
    existingRecord?.customFields ||
      initialCustomFields || {
        keperluan:
          template.type === 'pengantar'
            ? 'Pengurusan Administrasi Kependudukan / SKCK'
            : template.type === 'domisili'
            ? 'Persyaratan Administrasi Pekerjaan / Perbankan'
            : template.type === 'usaha'
            ? 'Persyaratan Pengajuan Kredit Usaha Rakyat (KUR)'
            : 'Pengajuan Keringanan Biaya Pendidikan / Kesehatan',
        jenisPengantar: 'Pengantar Umum & Kependudukan',
        namaUsaha: 'Usaha Dagang Mandiri',
        jenisUsaha: 'Perdagangan Sembako & Retail',
        alamatUsaha: resident?.alamat || '',
        lamaUsaha: '3 Tahun',
        penghasilan: 'Rp 1.200.000 / bulan',
        jumlahTanggungan: '3',
      }
  );

  const [nomorManual, setNomorManual] = useState(
    existingRecord?.nomorSurat ||
      generateLetterNumber(template, nextSequenceNumber, profile, tanggalTerbit)
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const logoSrc = profile.logoPemdaUrl || DEFAULT_PEMDA_LOGO;

  const renderedContent = useMemo(() => {
    if (!resident) return null;
    const pembuka = interpolateTemplateText(
      template.kalimatPembuka,
      resident,
      profile,
      territory,
      customFields
    );
    const isi = interpolateTemplateText(
      template.kalimatIsi,
      resident,
      profile,
      territory,
      customFields
    );
    const penutup = interpolateTemplateText(
      template.kalimatPenutup,
      resident,
      profile,
      territory,
      customFields
    );
    const jabatan = interpolateTemplateText(
      template.jabatanPenandatangan,
      resident,
      profile,
      territory,
      customFields
    );
    return { pembuka, isi, penutup, jabatan };
  }, [resident, template, profile, territory, customFields]);

  if (!open || !resident || !renderedContent) return null;

  const buildLetterRecord = (): LetterRecord => ({
    id: existingRecord?.id || `srt-${Date.now()}`,
    nomorSurat: nomorManual,
    type: template.type,
    judulSurat: template.judulSurat,
    residentId: resident.id,
    residentNik: resident.nik,
    residentNama: resident.nama,
    tanggalTerbit,
    keperluan: customFields.keperluan,
    penandatangan: profile.namaKepalaDesa,
    customFields,
    driveFileId: existingRecord?.driveFileId,
  });

  const handleSaveAndPrint = () => {
    const rec = buildLetterRecord();
    if (!existingRecord) {
      onSaveRecord(rec);
      setSavedNotice(true);
    }
    setTimeout(() => {
      window.print();
    }, 120);
  };

  const handleSaveOnly = () => {
    const rec = buildLetterRecord();
    onSaveRecord(rec);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleArchiveDrive = () => {
    if (!onArchiveToDrive) return;
    const rec = buildLetterRecord();
    const sheetEl = document.getElementById('printable-letter-a4');
    const htmlDocument = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${rec.judulSurat} - ${rec.residentNama}</title><style>body{font-family:Georgia,serif;padding:40px;max-width:780px;margin:auto;color:#111;line-height:1.5}</style></head><body>${
      sheetEl?.innerHTML || ''
    }</body></html>`;
    onArchiveToDrive(rec, htmlDocument);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-3 md:p-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-2xl">
        {/* Modal Toolbar (hidden on print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pratinjau & Cetak {template.label}
              </h3>
              <p className="text-xs text-slate-500">
                Pemohon: {resident.nama} · NIK {resident.nik}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                Tersimpan di arsip
              </span>
            )}
            {!existingRecord && (
              <button
                type="button"
                onClick={handleSaveOnly}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Simpan Arsip
              </button>
            )}
            {isGoogleConnected && onArchiveToDrive && (
              <button
                type="button"
                onClick={handleArchiveDrive}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <CloudUpload className="h-3.5 w-3.5 text-teal-700" />
                Simpan ke Drive
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveAndPrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Printer className="h-3.5 w-3.5" />
              Cetak Sekarang (A4)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Tutup pratinjau surat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body: Left Quick Inputs + Right A4 Document */}
        <div className="flex flex-1 flex-col overflow-y-auto lg:overflow-hidden lg:flex-row">
          {/* Quick Editor Sidebar (no-print) */}
          <div className="no-print w-full shrink-0 lg:overflow-y-auto border-b border-slate-200 bg-white p-4 sm:p-5 lg:w-80 lg:border-b-0 lg:border-r">
            <h4 className="text-xs font-semibold tracking-wide text-slate-700">
              Parameter Surat Cepat
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Sesuaikan nomor dan detail isi sebelum mencetak ke kertas A4.
            </p>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Nomor Surat
                </label>
                <input
                  type="text"
                  value={nomorManual}
                  onChange={(e) => setNomorManual(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Tanggal Terbit
                </label>
                <input
                  type="date"
                  value={tanggalTerbit}
                  onChange={(e) => setTanggalTerbit(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              {template.type === 'pengantar' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Jenis Pengantar
                  </label>
                  <select
                    value={customFields.jenisPengantar || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomFields((prev) => ({
                        ...prev,
                        jenisPengantar: val,
                        keperluan:
                          val === 'Pengantar SKCK'
                            ? 'Pengurusan Surat Keterangan Catatan Kepolisian (SKCK) di Kepolisian'
                            : val === 'Pengantar KTP / KK'
                            ? 'Pengurusan Dokumen Kependudukan (KTP-el / Kartu Keluarga) di Disdukcapil'
                            : val === 'Pengantar Nikah (N1-N4)'
                            ? 'Pengurusan Administrasi Pernikahan di KUA Kecamatan'
                            : prev.keperluan,
                      }));
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  >
                    <option value="Pengantar Umum & Kependudukan">
                      Pengantar Umum & Kependudukan
                    </option>
                    <option value="Pengantar SKCK">Pengantar SKCK</option>
                    <option value="Pengantar KTP / KK">Pengantar KTP / KK</option>
                    <option value="Pengantar Nikah (N1-N4)">
                      Pengantar Nikah (N1-N4)
                    </option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Keperluan / Tujuan Surat
                </label>
                <textarea
                  rows={3}
                  value={customFields.keperluan}
                  onChange={(e) =>
                    setCustomFields((prev) => ({ ...prev, keperluan: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>

              {template.type === 'usaha' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Nama Usaha
                    </label>
                    <input
                      type="text"
                      value={customFields.namaUsaha || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          namaUsaha: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Bidang / Jenis Usaha
                    </label>
                    <input
                      type="text"
                      value={customFields.jenisUsaha || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          jenisUsaha: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Lokasi / Alamat Usaha
                    </label>
                    <input
                      type="text"
                      value={customFields.alamatUsaha || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          alamatUsaha: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Lama Usaha Berjalan
                    </label>
                    <input
                      type="text"
                      value={customFields.lamaUsaha || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          lamaUsaha: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </>
              )}

              {template.type === 'sktm' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Perkiraan Penghasilan
                    </label>
                    <input
                      type="text"
                      value={customFields.penghasilan || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          penghasilan: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Jumlah Tanggungan Keluarga
                    </label>
                    <input
                      type="text"
                      value={customFields.jumlahTanggungan || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          jumlahTanggungan: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* A4 Printable Sheet Area */}
          <div className="flex-1 overflow-y-auto bg-slate-200/70 p-4 md:p-8">
            <div
              id="printable-letter-a4"
              className="print-only-sheet font-letter-serif mx-auto w-full max-w-[794px] bg-white px-10 py-10 text-slate-950 shadow-sm md:px-14 md:py-12"
            >
              {/* Kop Surat Resmi */}
              <div className="flex items-center gap-5 border-b-[3px] border-slate-950 pb-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden bg-white flex items-center justify-center">
                  <img
                    src={logoSrc}
                    alt={`Logo Pemerintah Daerah ${profile.kabupaten}`}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = DEFAULT_PEMDA_LOGO;
                    }}
                  />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-sm font-bold tracking-wider uppercase">
                    PEMERINTAH KABUPATEN {profile.kabupaten.toUpperCase()}
                  </p>
                  <p className="text-sm font-bold tracking-wider uppercase">
                    KECAMATAN {profile.kecamatan.toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xl font-bold tracking-wide uppercase">
                    PEMERINTAH DESA {profile.namaDesa.toUpperCase()}
                  </p>
                  <p className="mt-1 font-sans text-[11px] text-slate-700">
                    {profile.alamatKantor} · Kode Pos {profile.kodePos} · Telp.{' '}
                    {profile.telepon}
                  </p>
                </div>
                <div className="hidden w-12 shrink-0 sm:block" />
              </div>
              <div className="mt-[2px] border-b border-slate-950" />

              {/* Judul Surat */}
              <div className="mt-7 text-center">
                <h2 className="inline-block border-b-2 border-slate-950 pb-0.5 text-base font-bold tracking-wide uppercase">
                  {template.judulSurat}
                </h2>
                <p className="mt-1 font-sans text-xs font-medium text-slate-800">
                  Nomor : {nomorManual}
                </p>
              </div>

              {/* Pembuka */}
              <p className="mt-6 text-justify text-[13.5px] leading-relaxed">
                {renderedContent.pembuka}
              </p>

              {/* Tabel Data Pemohon */}
              <table className="mt-4 w-full text-[13.5px] leading-snug">
                <tbody>
                  <tr>
                    <td className="w-44 py-1 align-top">Nama Lengkap</td>
                    <td className="w-4 py-1 align-top">:</td>
                    <td className="py-1 font-bold uppercase">{resident.nama}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">NIK</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1 font-mono-tabular text-[13px]">{resident.nik}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Nomor Kartu Keluarga</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1 font-mono-tabular text-[13px]">{resident.noKk}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Tempat / Tanggal Lahir</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">
                      {resident.tempatLahir}, {formatIndonesianDate(resident.tanggalLahir)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Jenis Kelamin</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">{resident.jenisKelamin}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Agama / Kewarganegaraan</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">
                      {resident.agama} / {resident.kewarganegaraan}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Status Perkawinan</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">{resident.statusPerkawinan}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Pekerjaan</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">{resident.pekerjaan}</td>
                  </tr>
                  <tr>
                    <td className="py-1 align-top">Alamat</td>
                    <td className="py-1 align-top">:</td>
                    <td className="py-1">
                      {resident.alamat}, RT {resident.rt} / RW {resident.rw},{' '}
                      {territory?.namaDusun || 'Dusun Krajan'}, Desa {profile.namaDesa},
                      Kec. {profile.kecamatan}, Kab. {profile.kabupaten}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Isi Keterangan */}
              <div className="mt-5 whitespace-pre-line text-justify text-[13.5px] leading-relaxed">
                {renderedContent.isi}
              </div>

              {/* Penutup */}
              <p className="mt-4 text-justify text-[13.5px] leading-relaxed">
                {renderedContent.penutup}
              </p>

              {template.tampilkanMasaBerlaku && (
                <p className="mt-3 font-sans text-[11px] italic text-slate-600">
                  Catatan: Surat ini berlaku selama {template.masaBerlakuHari} hari sejak
                  tanggal diterbitkan.
                </p>
              )}

              {/* Blok Tanda Tangan */}
              <div className="mt-10 flex justify-end">
                <div className="w-64 text-center text-[13.5px]">
                  <p>
                    {profile.namaDesa}, {formatIndonesianDate(tanggalTerbit)}
                  </p>
                  <p className="mt-0.5 font-semibold">{renderedContent.jabatan}</p>
                  <div className="h-20" />
                  <p className="font-bold underline">{profile.namaKepalaDesa}</p>
                  {profile.nipKepalaDesa && (
                    <p className="mt-0.5 font-sans text-[11px] text-slate-700">
                      NIP/NIAP. {profile.nipKepalaDesa}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
