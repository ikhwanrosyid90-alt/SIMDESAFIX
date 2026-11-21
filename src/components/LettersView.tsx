import React, { useMemo, useState } from 'react';
import {
  FileText,
  Pencil,
  Printer,
  RotateCcw,
  Save,
  Search,
} from 'lucide-react';
import {
  LetterCustomFields,
  LetterRecord,
  LetterTemplate,
  LetterType,
  Resident,
  TerritoryUnit,
  VillageProfile,
} from '../types/village';
import { INITIAL_TEMPLATES } from '../data/seedData';
import { formatIndonesianDate } from '../utils/villageHelpers';

interface LettersViewProps {
  residents: Resident[];
  territories: TerritoryUnit[];
  profile: VillageProfile;
  templates: LetterTemplate[];
  letters: LetterRecord[];
  onUpdateTemplate: (updated: LetterTemplate) => void;
  onOpenLetterPreview: (
    resident: Resident,
    type: LetterType,
    customFields?: LetterCustomFields,
    existingRecord?: LetterRecord
  ) => void;
}

const VARIABLE_TOKENS = [
  '{{nama_desa}}',
  '{{kecamatan}}',
  '{{kabupaten}}',
  '{{nama}}',
  '{{nik}}',
  '{{ttl}}',
  '{{alamat}}',
  '{{rt}}',
  '{{rw}}',
  '{{dusun}}',
  '{{keperluan}}',
  '{{nama_usaha}}',
  '{{jenis_usaha}}',
  '{{alamat_usaha}}',
  '{{lama_usaha}}',
  '{{penghasilan}}',
  '{{jumlah_tanggungan}}',
];

export const LettersView: React.FC<LettersViewProps> = ({
  residents,
  territories,
  templates,
  letters,
  onUpdateTemplate,
  onOpenLetterPreview,
}) => {
  const [subTab, setSubTab] = useState<'buat' | 'kustomisasi' | 'arsip'>('buat');

  // Create letter form state
  const [residentSearch, setResidentSearch] = useState('');
  const [selectedResidentId, setSelectedResidentId] = useState(
    residents[0]?.id || ''
  );
  const [selectedType, setSelectedType] = useState<LetterType>('domisili');
  const [customFields, setCustomFields] = useState<LetterCustomFields>({
    keperluan: 'Persyaratan Administrasi Pekerjaan / Bank',
    jenisPengantar: 'Pengantar Umum & Kependudukan',
    namaUsaha: 'Warung Sembako Berkah',
    jenisUsaha: 'Perdagangan Eceran',
    alamatUsaha: residents[0]?.alamat || '',
    lamaUsaha: '2 Tahun',
    penghasilan: 'Rp 1.250.000 / bulan',
    jumlahTanggungan: '3',
  });

  // Template customization state
  const [editingTemplateType, setEditingTemplateType] =
    useState<LetterType>('domisili');
  const activeTemplate = useMemo(
    () =>
      templates.find((t) => t.type === editingTemplateType) || templates[0],
    [templates, editingTemplateType]
  );
  const [templateDraft, setTemplateDraft] =
    useState<LetterTemplate>(activeTemplate);
  const [templateSavedMsg, setTemplateSavedMsg] = useState(false);

  // Archive search
  const [archiveSearch, setArchiveSearch] = useState('');

  React.useEffect(() => {
    setTemplateDraft(activeTemplate);
  }, [activeTemplate]);

  const matchingResidents = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    if (!q) return residents;
    return residents.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.nik.includes(q) ||
        r.noKk.includes(q)
    );
  }, [residents, residentSearch]);

  const selectedResident = useMemo(
    () =>
      residents.find((r) => r.id === selectedResidentId) || residents[0] || null,
    [residents, selectedResidentId]
  );

  const filteredArchive = useMemo(() => {
    const q = archiveSearch.trim().toLowerCase();
    if (!q) return letters;
    return letters.filter(
      (l) =>
        l.nomorSurat.toLowerCase().includes(q) ||
        l.residentNama.toLowerCase().includes(q) ||
        l.residentNik.includes(q) ||
        l.judulSurat.toLowerCase().includes(q) ||
        l.keperluan.toLowerCase().includes(q)
    );
  }, [letters, archiveSearch]);

  const territoryMap = useMemo(
    () => new Map(territories.map((t) => [t.id, t])),
    [territories]
  );

  const handleTemplateSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateTemplate(templateDraft);
    setTemplateSavedMsg(true);
    setTimeout(() => setTemplateSavedMsg(false), 2500);
  };

  const handleResetTemplate = () => {
    const def = INITIAL_TEMPLATES.find((t) => t.type === editingTemplateType);
    if (def) {
      setTemplateDraft(def);
      onUpdateTemplate(def);
    }
  };

  const appendToken = (token: string) => {
    setTemplateDraft((prev) => ({
      ...prev,
      kalimatIsi: `${prev.kalimatIsi} ${token}`.trim(),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Segmented Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
        <div className="flex w-full sm:w-auto items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab('buat')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'buat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buat & Cetak Surat
          </button>
          <button
            type="button"
            onClick={() => setSubTab('kustomisasi')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'kustomisasi'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Kustomisasi Template Surat
          </button>
          <button
            type="button"
            onClick={() => setSubTab('arsip')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'arsip'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Arsip Surat Keluar ({letters.length})
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Mendukung Surat Pengantar, Domisili, Usaha, dan Tidak Mampu (SKTM)
        </p>
      </div>

      {/* TAB 1: BUAT SURAT BARU */}
      {subTab === 'buat' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Resident Selector & Letter Type */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <h3 className="text-base font-semibold text-slate-900">
              1. Pilih Jenis Surat & Pemohon
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Data identitas pemohon otomatis terisi dari buku induk penduduk.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Jenis Layanan Surat
                </label>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.type}
                      type="button"
                      onClick={() => setSelectedType(tpl.type)}
                      className={`rounded-lg border px-3.5 py-2.5 text-left transition-colors ${
                        selectedType === tpl.type
                          ? 'border-teal-700 bg-teal-50/70 text-teal-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <p className="text-xs font-semibold">{tpl.label}</p>
                      <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500">
                        Kode {tpl.kodeKlasifikasi}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Cari Warga Pemohon (NIK / Nama)
                </label>
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={residentSearch}
                    onChange={(e) => setResidentSearch(e.target.value)}
                    placeholder="Ketik nama atau NIK warga..."
                    className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>
                <select
                  size={5}
                  value={selectedResident?.id || ''}
                  onChange={(e) => setSelectedResidentId(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                >
                  {matchingResidents.map((r) => (
                    <option key={r.id} value={r.id} className="rounded px-2 py-1.5">
                      {r.nama} — NIK {r.nik} ({territoryMap.get(r.dusunId)?.namaDusun || 'Desa'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Right: Letter Parameters & Launch Preview */}
          <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                2. Lengkapi Keterangan Khusus Surat
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Sesuaikan keperluan dan rincian sesuai jenis surat yang dipilih.
              </p>

              {selectedResident && (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">
                      {selectedResident.nama}
                    </span>
                    <span className="font-mono-tabular text-slate-600">
                      NIK {selectedResident.nik}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-600">
                    {selectedResident.alamat}, RT {selectedResident.rt} / RW{' '}
                    {selectedResident.rw} · Pekerjaan: {selectedResident.pekerjaan}
                  </p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {selectedType === 'pengantar' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Kategori Surat Pengantar
                    </label>
                    <select
                      value={customFields.jenisPengantar || ''}
                      onChange={(e) =>
                        setCustomFields((prev) => ({
                          ...prev,
                          jenisPengantar: e.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
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

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700">
                    Keperluan / Tujuan Pengajuan Surat *
                  </label>
                  <textarea
                    rows={2}
                    value={customFields.keperluan}
                    onChange={(e) =>
                      setCustomFields((prev) => ({
                        ...prev,
                        keperluan: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                  />
                </div>

                {selectedType === 'usaha' && (
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Alamat Lokasi Usaha
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {selectedType === 'sktm' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Perkiraan Penghasilan Keluarga
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Jumlah Tanggungan (Jiwa)
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
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => {
                  setEditingTemplateType(selectedType);
                  setSubTab('kustomisasi');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <Pencil className="h-3.5 w-3.5" />
                Kustomisasi Redaksi Template Ini
              </button>

              <button
                type="button"
                disabled={!selectedResident}
                onClick={() =>
                  selectedResident &&
                  onOpenLetterPreview(selectedResident, selectedType, customFields)
                }
                className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-5 py-2.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Printer className="h-4 w-4" />
                Pratinjau & Cetak Surat
              </button>
            </div>
          </section>
        </div>
      )}

      {/* TAB 2: KUSTOMISASI TEMPLATE SURAT */}
      {subTab === 'kustomisasi' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Kustomisasi Redaksi & Format Surat Desa
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Sesuaikan format nomor, judul, paragraf pembuka, isi, dan penutup sesuai
                peraturan desa setempat.
              </p>
            </div>
            <div className="flex w-full lg:w-auto items-center gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
              {templates.map((tpl) => (
                <button
                  key={tpl.type}
                  type="button"
                  onClick={() => setEditingTemplateType(tpl.type)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    editingTemplateType === tpl.type
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleTemplateSave} className="mt-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Judul Surat (di Cetakan)
                </label>
                <input
                  type="text"
                  required
                  value={templateDraft.judulSurat}
                  onChange={(e) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      judulSurat: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Format Penomoran Otomatis
                </label>
                <input
                  type="text"
                  required
                  value={templateDraft.formatNomor}
                  onChange={(e) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      formatNomor: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono-tabular text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Jabatan Penandatangan
                </label>
                <input
                  type="text"
                  required
                  value={templateDraft.jabatanPenandatangan}
                  onChange={(e) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      jabatanPenandatangan: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Paragraf Pembuka
              </label>
              <textarea
                rows={2}
                required
                value={templateDraft.kalimatPembuka}
                onChange={(e) =>
                  setTemplateDraft((prev) => ({
                    ...prev,
                    kalimatPembuka: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-700">
                  Paragraf Isi & Keterangan Utama
                </label>
                <span className="text-[11px] text-slate-500">
                  Klik variabel di bawah untuk menyisipkan data otomatis:
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {VARIABLE_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => appendToken(token)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono-tabular text-[11px] text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <textarea
                rows={5}
                required
                value={templateDraft.kalimatIsi}
                onChange={(e) =>
                  setTemplateDraft((prev) => ({
                    ...prev,
                    kalimatIsi: e.target.value,
                  }))
                }
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700">
                Paragraf Penutup
              </label>
              <textarea
                rows={2}
                required
                value={templateDraft.kalimatPenutup}
                onChange={(e) =>
                  setTemplateDraft((prev) => ({
                    ...prev,
                    kalimatPenutup: e.target.value,
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs">
              <label className="flex items-center gap-2 font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={templateDraft.tampilkanMasaBerlaku}
                  onChange={(e) =>
                    setTemplateDraft((prev) => ({
                      ...prev,
                      tampilkanMasaBerlaku: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                Tampilkan catatan masa berlaku surat
              </label>
              {templateDraft.tampilkanMasaBerlaku && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">Durasi berlaku:</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={templateDraft.masaBerlakuHari}
                    onChange={(e) =>
                      setTemplateDraft((prev) => ({
                        ...prev,
                        masaBerlakuHari: Number(e.target.value) || 30,
                      }))
                    }
                    className="w-20 rounded border border-slate-300 bg-white px-2.5 py-1 font-mono-tabular text-xs text-slate-900"
                  />
                  <span className="text-slate-600">hari</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={handleResetTemplate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset ke Standar
              </button>
              <div className="flex items-center gap-3">
                {templateSavedMsg && (
                  <span className="text-xs font-medium text-emerald-700">
                    Template berhasil disimpan
                  </span>
                )}
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800"
                >
                  <Save className="h-3.5 w-3.5" />
                  Simpan Template Surat
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: ARSIP SURAT KELUAR */}
      {subTab === 'arsip' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Buku Agenda & Arsip Surat Keluar
              </h3>
              <p className="text-xs text-slate-500">
                Seluruh surat yang diterbitkan tercatat otomatis dan dapat dicetak ulang.
              </p>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                placeholder="Cari nomor surat atau nama warga..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredArchive.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Belum ada arsip surat yang cocok.
              </div>
            ) : (
              filteredArchive.map((ltr) => {
                const res = residents.find((r) => r.id === ltr.residentId);
                return (
                  <div key={ltr.id} className="space-y-2 p-4 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {ltr.judulSurat}
                        </p>
                        <p className="mt-0.5 font-mono-tabular text-[11px] text-teal-800">
                          {ltr.nomorSurat}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-[11px] text-slate-500 shrink-0">
                        {formatIndonesianDate(ltr.tanggalTerbit)}
                      </span>
                    </div>
                    <p className="text-slate-700">
                      Pemohon: <strong>{ltr.residentNama}</strong> ({ltr.residentNik})
                    </p>
                    <p className="text-slate-500 line-clamp-2">{ltr.keperluan}</p>
                    <button
                      type="button"
                      disabled={!res}
                      onClick={() =>
                        res &&
                        onOpenLetterPreview(res, ltr.type, ltr.customFields, ltr)
                      }
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Cetak Ulang
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pl-5 pr-3">Nomor Surat</th>
                  <th className="py-2.5 px-3">Jenis Surat</th>
                  <th className="py-2.5 px-3">Pemohon</th>
                  <th className="py-2.5 px-3">Keperluan</th>
                  <th className="py-2.5 px-3">Tanggal Terbit</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredArchive.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                      Belum ada arsip surat yang cocok.
                    </td>
                  </tr>
                ) : (
                  filteredArchive.map((ltr) => {
                    const res = residents.find((r) => r.id === ltr.residentId);
                    return (
                      <tr key={ltr.id} className="hover:bg-slate-50">
                        <td className="py-3 pl-5 pr-3 font-mono-tabular text-xs font-medium text-slate-900">
                          {ltr.nomorSurat}
                        </td>
                        <td className="py-3 px-3 text-xs font-medium text-slate-800">
                          <span className="inline-flex items-center gap-1.5">
                            <FileText className="h-3.5 w-3.5 text-teal-700" />
                            {ltr.judulSurat}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <p className="font-medium text-slate-900">{ltr.residentNama}</p>
                          <p className="font-mono-tabular text-[11px] text-slate-500">
                            NIK {ltr.residentNik}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                          {ltr.keperluan}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular text-xs text-slate-600">
                          {formatIndonesianDate(ltr.tanggalTerbit)}
                        </td>
                        <td className="py-3 pl-3 pr-5 text-right">
                          <button
                            type="button"
                            disabled={!res}
                            onClick={() =>
                              res &&
                              onOpenLetterPreview(
                                res,
                                ltr.type,
                                ltr.customFields,
                                ltr
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                          >
                            <Printer className="h-3.5 w-3.5" />
                            Cetak Ulang
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
