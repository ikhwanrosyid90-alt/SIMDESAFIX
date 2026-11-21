import {
  DriveFileItem,
  DusunCommitteeMember,
  DusunUnit,
  LetterRecord,
  LetterTemplate,
  Resident,
  RwUnit,
  SheetTabMapping,
  TerritoryUnit,
  VillageProfile,
} from '../types/village';

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTitles: string[];
}

export const DEFAULT_TAB_NAMES: Required<SheetTabMapping> = {
  penduduk: 'Penduduk',
  kewilayahan: 'Kewilayahan',
  dusun: 'Dusun_Pengurus',
  rw: 'RW_Unit',
  arsipSurat: 'Arsip_Surat',
  profilDesa: 'Profil_Desa',
  templates: 'Template_Surat',
};

const PENDUDUK_HEADERS = [
  'ID',
  'NIK',
  'No_KK',
  'Nama_Lengkap',
  'Jenis_Kelamin',
  'Tempat_Lahir',
  'Tanggal_Lahir',
  'Agama',
  'Pendidikan',
  'Pekerjaan',
  'Status_Perkawinan',
  'SHDK',
  'Gol_Darah',
  'Status_Kependudukan',
  'Kewarganegaraan',
  'Nama_Ayah',
  'Nama_Ibu',
  'Dusun_ID',
  'RW',
  'RT',
  'Alamat',
  'No_HP',
  'Status_Rumah',
  'Konstruksi_Rumah',
  'Status_RTLH',
  'Bantuan_Sosial_JSON',
  'Berkas_KTP',
  'Berkas_KK',
  'Updated_At',
];

const KEWILAYAHAN_HEADERS = [
  'ID',
  'Kode',
  'Nama_Dusun',
  'RW',
  'RT',
  'Kepala_Wilayah',
  'Jabatan',
  'No_HP',
  'Luas_Wilayah',
  'Keterangan',
  'Latitude',
  'Longitude',
];

const DUSUN_HEADERS = [
  'ID',
  'Kode',
  'Nama_Dusun',
  'Kepala_Dusun',
  'No_HP_Kadus',
  'Luas_Wilayah',
  'Keterangan',
  'Kepengurusan_JSON',
];

const RW_HEADERS = [
  'ID',
  'Dusun_Kode',
  'Nama_Dusun',
  'RW',
  'Ketua_RW',
  'No_HP_RW',
  'Keterangan',
];

const ARSIP_SURAT_HEADERS = [
  'ID',
  'Nomor_Surat',
  'Jenis_Surat',
  'Judul_Surat',
  'Resident_ID',
  'NIK',
  'Nama_Warga',
  'Tanggal_Terbit',
  'Keperluan',
  'Penandatangan',
  'Detail_JSON',
  'Drive_File_ID',
];

const PROFIL_DESA_HEADERS = ['Field', 'Value'];

const TEMPLATE_SURAT_HEADERS = [
  'Type',
  'Label',
  'Kode_Klasifikasi',
  'Format_Nomor',
  'Judul_Surat',
  'Sub_Judul',
  'Kalimat_Pembuka',
  'Kalimat_Isi',
  'Kalimat_Penutup',
  'Jabatan_Penandatangan',
  'Tampilkan_Masa_Berlaku',
  'Masa_Berlaku_Hari',
];

async function googleFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let message = `Permintaan Google API gagal (${response.status})`;
    try {
      const errBody = await response.json();
      if (errBody?.error?.message) {
        message = errBody.error.message;
      }
    } catch {
      // ignore json parse error
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function listDriveSpreadsheets(
  accessToken: string,
  searchTerm = ''
): Promise<DriveFileItem[]> {
  const safeSearch = searchTerm.replace(/'/g, "\\'").trim();
  const baseQuery =
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
  const q = safeSearch ? `${baseQuery} and name contains '${safeSearch}'` : baseQuery;

  const params = new URLSearchParams({
    q,
    pageSize: '30',
    orderBy: 'modifiedTime desc',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
  });

  const data = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return (data.files || []) as DriveFileItem[];
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  if (/^[a-zA-Z0-9-_]{15,}$/.test(trimmed)) return trimmed;
  return null;
}

export async function shareSpreadsheetWithEmail(
  accessToken: string,
  spreadsheetId: string,
  emailAddress: string,
  role: 'writer' | 'reader' = 'writer'
): Promise<void> {
  await googleFetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
      spreadsheetId
    )}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'user',
        role,
        emailAddress: emailAddress.trim(),
      }),
    }
  );
}

export async function listArchivedDriveFiles(
  accessToken: string
): Promise<DriveFileItem[]> {
  const q =
    "trashed=false and (name contains 'SIMDESA_' or name contains 'Surat_' or name contains 'Logo_Pemda_')";
  const params = new URLSearchParams({
    q,
    pageSize: '20',
    orderBy: 'modifiedTime desc',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
    fields: 'files(id,name,mimeType,modifiedTime,webViewLink)',
  });

  const data = await googleFetch(
    `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
    accessToken
  );

  return (data.files || []) as DriveFileItem[];
}

export async function fetchSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string
): Promise<SpreadsheetMetadata> {
  const data = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    accessToken
  );

  const sheetTitles: string[] = (data.sheets || []).map(
    (s: { properties?: { title?: string } }) => s.properties?.title || 'Sheet1'
  );

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Spreadsheet Desa',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheetTitles,
  };
}

export function resolveTabMapping(
  sheetTitles: string[],
  current?: Partial<SheetTabMapping>
): SheetTabMapping {
  const pick = (preferred: string | undefined, standard: string, fallback = '') => {
    if (preferred && sheetTitles.includes(preferred)) return preferred;
    if (sheetTitles.includes(standard)) return standard;
    return fallback;
  };

  return {
    penduduk: pick(current?.penduduk, DEFAULT_TAB_NAMES.penduduk, sheetTitles[0] || DEFAULT_TAB_NAMES.penduduk),
    kewilayahan: pick(current?.kewilayahan, DEFAULT_TAB_NAMES.kewilayahan),
    dusun: pick(current?.dusun, DEFAULT_TAB_NAMES.dusun),
    rw: pick(current?.rw, DEFAULT_TAB_NAMES.rw),
    arsipSurat: pick(current?.arsipSurat, DEFAULT_TAB_NAMES.arsipSurat),
    profilDesa: pick(current?.profilDesa, DEFAULT_TAB_NAMES.profilDesa),
    templates: pick(current?.templates, DEFAULT_TAB_NAMES.templates),
  };
}

async function ensureSheetTabsExist(
  accessToken: string,
  spreadsheetId: string,
  desiredTitles: string[]
): Promise<string[]> {
  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const missing = desiredTitles.filter(
    (title) => Boolean(title) && !meta.sheetTitles.includes(title)
  );

  if (missing.length > 0) {
    await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: missing.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
  }

  return [...meta.sheetTitles, ...missing];
}

function encodeDocCell(url?: string, fileName?: string): string {
  if (!url) return 'Belum';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return `${url}|${fileName || 'berkas'}`;
  }
  return `Ada (${fileName || 'berkas'})`;
}

function decodeDocCell(cellValue?: string): { url?: string; fileName?: string } {
  const trimmed = String(cellValue || '').trim();
  if (!trimmed || trimmed === 'Belum') return {};
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const [url, fileName] = trimmed.split('|');
    return { url, fileName: fileName || 'berkas' };
  }
  return {};
}

function residentToRow(r: Resident): string[] {
  return [
    r.id,
    r.nik,
    r.noKk,
    r.nama,
    r.jenisKelamin,
    r.tempatLahir,
    r.tanggalLahir,
    r.agama,
    r.pendidikan,
    r.pekerjaan,
    r.statusPerkawinan,
    r.hubunganKeluarga,
    r.golonganDarah,
    r.statusKependudukan,
    r.kewarganegaraan,
    r.namaAyah,
    r.namaIbu,
    r.dusunId,
    r.rw,
    r.rt,
    r.alamat,
    r.noHp,
    r.statusRumah || 'Milik Sendiri',
    r.kondisiRumah || 'Permanen (Tembok)',
    r.statusRtlh || 'Layak Huni',
    JSON.stringify(r.bantuanList || []),
    encodeDocCell(r.ktpFileUrl, r.ktpFileName),
    encodeDocCell(r.kkFileUrl, r.kkFileName),
    r.updatedAt,
  ];
}

function rowToResident(row: string[], index: number): Resident | null {
  if (!row || row.length < 4 || !row[3]) return null;

  // Backward-compatible across 23-col legacy, 26-col v2, and 29-col v3 sheets
  const isV3 = row.length >= 29;
  const isV2 = !isV3 && (row.length >= 26 || (row[22] && row[22].trim().startsWith('[')));

  const bantuanColIdx = isV3 ? 25 : isV2 ? 22 : -1;
  const updatedColIdx = isV3 ? 28 : isV2 ? 25 : 22;

  let bantuanList: Resident['bantuanList'] = [];
  if (bantuanColIdx >= 0 && row[bantuanColIdx]) {
    try {
      const parsed = JSON.parse(row[bantuanColIdx]);
      if (Array.isArray(parsed)) {
        bantuanList = parsed;
      }
    } catch {
      bantuanList = [];
    }
  }

  const ktpDoc = isV3 ? decodeDocCell(row[26]) : {};
  const kkDoc = isV3 ? decodeDocCell(row[27]) : {};

  return {
    id: row[0] || `res-sheet-${index + 1}`,
    nik: String(row[1] || '').trim(),
    noKk: String(row[2] || '').trim(),
    nama: String(row[3] || '').trim(),
    jenisKelamin: row[4] === 'Perempuan' ? 'Perempuan' : 'Laki-laki',
    tempatLahir: row[5] || '-',
    tanggalLahir: row[6] || '1990-01-01',
    agama: (row[7] as Resident['agama']) || 'Islam',
    pendidikan: (row[8] as Resident['pendidikan']) || 'SMA/Sederajat',
    pekerjaan: row[9] || 'Wiraswasta',
    statusPerkawinan: (row[10] as Resident['statusPerkawinan']) || 'Kawin',
    hubunganKeluarga: (row[11] as Resident['hubunganKeluarga']) || 'Kepala Keluarga',
    golonganDarah: (row[12] as Resident['golonganDarah']) || 'Tidak Tahu',
    statusKependudukan: (row[13] as Resident['statusKependudukan']) || 'Tetap',
    kewarganegaraan: row[14] === 'WNA' ? 'WNA' : 'WNI',
    namaAyah: row[15] || '-',
    namaIbu: row[16] || '-',
    dusunId: row[17] || 'wil-1',
    rw: row[18] || '001',
    rt: row[19] || '001',
    alamat: row[20] || '-',
    noHp: row[21] || '-',
    statusRumah: (isV3 && (row[22] as Resident['statusRumah'])) || 'Milik Sendiri',
    kondisiRumah: (isV3 && (row[23] as Resident['kondisiRumah'])) || 'Permanen (Tembok)',
    statusRtlh: (isV3 && (row[24] as Resident['statusRtlh'])) || 'Layak Huni',
    bantuanList,
    ktpFileUrl: ktpDoc.url,
    ktpFileName: ktpDoc.fileName,
    kkFileUrl: kkDoc.url,
    kkFileName: kkDoc.fileName,
    updatedAt: row[updatedColIdx] || new Date().toISOString(),
  };
}

function territoryToRow(t: TerritoryUnit): string[] {
  return [
    t.id,
    t.kode,
    t.namaDusun,
    t.rw,
    t.rt,
    t.kepalaWilayah,
    t.jabatan,
    t.noHp,
    t.luasWilayah,
    t.keterangan,
    t.latitude !== undefined ? String(t.latitude) : '',
    t.longitude !== undefined ? String(t.longitude) : '',
  ];
}

function rowToTerritory(row: string[], index: number): TerritoryUnit | null {
  if (!row || row.length < 3 || !row[2]) return null;
  const lat = row[10] ? Number(row[10]) : undefined;
  const lng = row[11] ? Number(row[11]) : undefined;
  return {
    id: row[0] || `wil-sheet-${index + 1}`,
    kode: row[1] || `DSN-0${index + 1}`,
    namaDusun: row[2],
    rw: row[3] || '001',
    rt: row[4] || '001',
    kepalaWilayah: row[5] || '-',
    jabatan: (row[6] as TerritoryUnit['jabatan']) || 'Ketua RT',
    noHp: row[7] || '-',
    luasWilayah: row[8] || '-',
    keterangan: row[9] || '-',
    latitude: lat !== undefined && !Number.isNaN(lat) ? lat : undefined,
    longitude: lng !== undefined && !Number.isNaN(lng) ? lng : undefined,
  };
}

function dusunToRow(d: DusunUnit): string[] {
  return [
    d.id,
    d.kode,
    d.namaDusun,
    d.kepalaDusun,
    d.noHpKadus,
    d.luasWilayah,
    d.keterangan,
    JSON.stringify(d.kepengurusan || []),
  ];
}

function rowToDusun(row: string[], index: number): DusunUnit | null {
  if (!row || row.length < 3 || !row[2]) return null;
  let kepengurusan: DusunCommitteeMember[] = [];
  if (row[7]) {
    try {
      const parsed = JSON.parse(row[7]);
      if (Array.isArray(parsed)) kepengurusan = parsed;
    } catch {
      kepengurusan = [];
    }
  }
  return {
    id: row[0] || `dsn-sheet-${index + 1}`,
    kode: row[1] || `DSN-0${index + 1}`,
    namaDusun: row[2],
    kepalaDusun: row[3] || '-',
    noHpKadus: row[4] || '-',
    luasWilayah: row[5] || '-',
    keterangan: row[6] || '-',
    kepengurusan,
  };
}

function rwToRow(r: RwUnit): string[] {
  return [
    r.id,
    r.dusunKode,
    r.namaDusun,
    r.rw,
    r.ketuaRw,
    r.noHpRw,
    r.keterangan,
  ];
}

function rowToRw(row: string[], index: number): RwUnit | null {
  if (!row || row.length < 4 || !row[3]) return null;
  return {
    id: row[0] || `rw-sheet-${index + 1}`,
    dusunKode: row[1] || 'DSN-01',
    namaDusun: row[2] || 'Dusun',
    rw: row[3] || '001',
    ketuaRw: row[4] || '-',
    noHpRw: row[5] || '-',
    keterangan: row[6] || '-',
  };
}

function letterToRow(l: LetterRecord): string[] {
  return [
    l.id,
    l.nomorSurat,
    l.type,
    l.judulSurat,
    l.residentId,
    l.residentNik,
    l.residentNama,
    l.tanggalTerbit,
    l.keperluan,
    l.penandatangan,
    JSON.stringify(l.customFields || {}),
    l.driveFileId || '',
  ];
}

function rowToLetter(row: string[], index: number): LetterRecord | null {
  if (!row || row.length < 4 || !row[1]) return null;
  let customFields = { keperluan: row[8] || '' };
  try {
    if (row[10]) customFields = JSON.parse(row[10]);
  } catch {
    // fallback
  }
  return {
    id: row[0] || `srt-sheet-${index + 1}`,
    nomorSurat: row[1],
    type: (row[2] as LetterRecord['type']) || 'pengantar',
    judulSurat: row[3] || 'SURAT PENGANTAR',
    residentId: row[4] || '',
    residentNik: row[5] || '',
    residentNama: row[6] || '',
    tanggalTerbit: row[7] || new Date().toISOString().slice(0, 10),
    keperluan: row[8] || '',
    penandatangan: row[9] || '',
    customFields,
    driveFileId: row[11] || undefined,
  };
}

function templateToRow(t: LetterTemplate): string[] {
  return [
    t.type,
    t.label,
    t.kodeKlasifikasi,
    t.formatNomor,
    t.judulSurat,
    t.subJudul,
    t.kalimatPembuka,
    t.kalimatIsi,
    t.kalimatPenutup,
    t.jabatanPenandatangan,
    t.tampilkanMasaBerlaku ? 'TRUE' : 'FALSE',
    String(t.masaBerlakuHari ?? 30),
  ];
}

function rowToTemplate(row: string[]): LetterTemplate | null {
  if (!row || row.length < 5 || !row[0]) return null;
  const type = row[0] as LetterTemplate['type'];
  if (!['pengantar', 'domisili', 'usaha', 'sktm'].includes(type)) return null;
  return {
    type,
    label: row[1] || 'Surat Desa',
    kodeKlasifikasi: row[2] || '470',
    formatNomor: row[3] || '470/{{NO}}/DS/{{BULAN_ROMAWI}}/{{TAHUN}}',
    judulSurat: row[4] || 'SURAT KETERANGAN',
    subJudul: row[5] || '',
    kalimatPembuka: row[6] || '',
    kalimatIsi: row[7] || '',
    kalimatPenutup: row[8] || '',
    jabatanPenandatangan: row[9] || 'Kepala Desa {{nama_desa}}',
    tampilkanMasaBerlaku: String(row[10]).toUpperCase() !== 'FALSE',
    masaBerlakuHari: Number(row[11]) || 30,
  };
}

function profileToRows(p: VillageProfile): string[][] {
  // Google Sheets single cell limit is 50,000 chars; safely omit oversized base64 logo if > 45,000 chars
  const safeLogo =
    p.logoPemdaUrl && p.logoPemdaUrl.length <= 45000 ? p.logoPemdaUrl : '';

  return [
    PROFIL_DESA_HEADERS,
    ['namaDesa', p.namaDesa],
    ['kodeDesa', p.kodeDesa],
    ['kecamatan', p.kecamatan],
    ['kabupaten', p.kabupaten],
    ['provinsi', p.provinsi],
    ['alamatKantor', p.alamatKantor],
    ['kodePos', p.kodePos],
    ['telepon', p.telepon],
    ['email', p.email],
    ['website', p.website],
    ['namaKepalaDesa', p.namaKepalaDesa],
    ['nipKepalaDesa', p.nipKepalaDesa],
    ['logoPemdaUrl', safeLogo],
    ['kantorLat', p.kantorLat !== undefined ? String(p.kantorLat) : ''],
    ['kantorLng', p.kantorLng !== undefined ? String(p.kantorLng) : ''],
    ['updatedAt', p.updatedAt],
  ];
}

function quoteSheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export async function createVillageSpreadsheet(
  accessToken: string,
  profile: VillageProfile,
  residents: Resident[],
  territories: TerritoryUnit[],
  letters: LetterRecord[],
  dusuns: DusunUnit[] = [],
  rws: RwUnit[] = [],
  templates: LetterTemplate[] = []
): Promise<SpreadsheetMetadata> {
  const title = `SIMDESA Data Penduduk - Desa ${profile.namaDesa}`;

  const created = await googleFetch(
    'https://sheets.googleapis.com/v4/spreadsheets',
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          { properties: { title: DEFAULT_TAB_NAMES.penduduk } },
          { properties: { title: DEFAULT_TAB_NAMES.kewilayahan } },
          { properties: { title: DEFAULT_TAB_NAMES.dusun } },
          { properties: { title: DEFAULT_TAB_NAMES.rw } },
          { properties: { title: DEFAULT_TAB_NAMES.arsipSurat } },
          { properties: { title: DEFAULT_TAB_NAMES.profilDesa } },
          { properties: { title: DEFAULT_TAB_NAMES.templates } },
        ],
      }),
    }
  );

  const meta: SpreadsheetMetadata = {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheetTitles: [
      DEFAULT_TAB_NAMES.penduduk,
      DEFAULT_TAB_NAMES.kewilayahan,
      DEFAULT_TAB_NAMES.dusun,
      DEFAULT_TAB_NAMES.rw,
      DEFAULT_TAB_NAMES.arsipSurat,
      DEFAULT_TAB_NAMES.profilDesa,
      DEFAULT_TAB_NAMES.templates,
    ],
  };

  await pushToGoogleSheets(
    accessToken,
    meta.spreadsheetId,
    DEFAULT_TAB_NAMES,
    { profile, residents, territories, dusuns, rws, letters, templates }
  );

  return meta;
}

export async function pushToGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  tabMapping: SheetTabMapping,
  payload: {
    profile: VillageProfile;
    residents: Resident[];
    territories: TerritoryUnit[];
    dusuns?: DusunUnit[];
    rws?: RwUnit[];
    letters: LetterRecord[];
    templates?: LetterTemplate[];
  }
): Promise<SheetTabMapping> {
  // Ensure every active/standard tab exists on the spreadsheet (upgrades legacy 4-tab sheets cleanly)
  const effectiveMapping: SheetTabMapping = {
    penduduk: tabMapping.penduduk || DEFAULT_TAB_NAMES.penduduk,
    kewilayahan: tabMapping.kewilayahan || DEFAULT_TAB_NAMES.kewilayahan,
    dusun: tabMapping.dusun || DEFAULT_TAB_NAMES.dusun,
    rw: tabMapping.rw || DEFAULT_TAB_NAMES.rw,
    arsipSurat: tabMapping.arsipSurat || DEFAULT_TAB_NAMES.arsipSurat,
    profilDesa: tabMapping.profilDesa || DEFAULT_TAB_NAMES.profilDesa,
    templates: tabMapping.templates || DEFAULT_TAB_NAMES.templates,
  };

  const tabsToEnsure = [
    effectiveMapping.penduduk,
    effectiveMapping.kewilayahan,
    effectiveMapping.dusun,
    effectiveMapping.rw,
    effectiveMapping.arsipSurat,
    effectiveMapping.profilDesa,
    effectiveMapping.templates,
  ].filter(Boolean) as string[];

  await ensureSheetTabsExist(accessToken, spreadsheetId, tabsToEnsure);

  const rangesToClear = [
    `${quoteSheetName(effectiveMapping.penduduk)}!A:AD`,
    effectiveMapping.kewilayahan
      ? `${quoteSheetName(effectiveMapping.kewilayahan)}!A:L`
      : null,
    effectiveMapping.dusun ? `${quoteSheetName(effectiveMapping.dusun)}!A:H` : null,
    effectiveMapping.rw ? `${quoteSheetName(effectiveMapping.rw)}!A:G` : null,
    effectiveMapping.arsipSurat
      ? `${quoteSheetName(effectiveMapping.arsipSurat)}!A:L`
      : null,
    effectiveMapping.profilDesa
      ? `${quoteSheetName(effectiveMapping.profilDesa)}!A:B`
      : null,
    effectiveMapping.templates
      ? `${quoteSheetName(effectiveMapping.templates)}!A:L`
      : null,
  ].filter(Boolean) as string[];

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchClear`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ranges: rangesToClear }),
    }
  );

  const data: { range: string; values: string[][] }[] = [
    {
      range: `${quoteSheetName(effectiveMapping.penduduk)}!A1`,
      values: [PENDUDUK_HEADERS, ...payload.residents.map(residentToRow)],
    },
  ];

  if (effectiveMapping.kewilayahan) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.kewilayahan)}!A1`,
      values: [KEWILAYAHAN_HEADERS, ...payload.territories.map(territoryToRow)],
    });
  }

  if (effectiveMapping.dusun && payload.dusuns) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.dusun)}!A1`,
      values: [DUSUN_HEADERS, ...payload.dusuns.map(dusunToRow)],
    });
  }

  if (effectiveMapping.rw && payload.rws) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.rw)}!A1`,
      values: [RW_HEADERS, ...payload.rws.map(rwToRow)],
    });
  }

  if (effectiveMapping.arsipSurat) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.arsipSurat)}!A1`,
      values: [ARSIP_SURAT_HEADERS, ...payload.letters.map(letterToRow)],
    });
  }

  if (effectiveMapping.profilDesa) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.profilDesa)}!A1`,
      values: profileToRows(payload.profile),
    });
  }

  if (effectiveMapping.templates && payload.templates) {
    data.push({
      range: `${quoteSheetName(effectiveMapping.templates)}!A1`,
      values: [TEMPLATE_SURAT_HEADERS, ...payload.templates.map(templateToRow)],
    });
  }

  await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data,
      }),
    }
  );

  return effectiveMapping;
}

export async function pullFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  tabMapping: SheetTabMapping
): Promise<{
  residents?: Resident[];
  territories?: TerritoryUnit[];
  dusuns?: DusunUnit[];
  rws?: RwUnit[];
  letters?: LetterRecord[];
  templates?: LetterTemplate[];
  profilePatch?: Partial<VillageProfile>;
  resolvedMapping: SheetTabMapping;
  spreadsheetTitle: string;
}> {
  // Always inspect actual tabs first so legacy or partially mapped sheets never fail batchGet
  const meta = await fetchSpreadsheetMetadata(accessToken, spreadsheetId);
  const resolved = resolveTabMapping(meta.sheetTitles, tabMapping);

  type RangeKey =
    | 'penduduk'
    | 'kewilayahan'
    | 'dusun'
    | 'rw'
    | 'arsipSurat'
    | 'profilDesa'
    | 'templates';

  const queries: { key: RangeKey; range: string }[] = [];

  if (resolved.penduduk && meta.sheetTitles.includes(resolved.penduduk)) {
    queries.push({
      key: 'penduduk',
      range: `${quoteSheetName(resolved.penduduk)}!A1:AD2000`,
    });
  }
  if (resolved.kewilayahan && meta.sheetTitles.includes(resolved.kewilayahan)) {
    queries.push({
      key: 'kewilayahan',
      range: `${quoteSheetName(resolved.kewilayahan)}!A1:L500`,
    });
  }
  if (resolved.dusun && meta.sheetTitles.includes(resolved.dusun)) {
    queries.push({
      key: 'dusun',
      range: `${quoteSheetName(resolved.dusun)}!A1:H200`,
    });
  }
  if (resolved.rw && meta.sheetTitles.includes(resolved.rw)) {
    queries.push({
      key: 'rw',
      range: `${quoteSheetName(resolved.rw)}!A1:G300`,
    });
  }
  if (resolved.arsipSurat && meta.sheetTitles.includes(resolved.arsipSurat)) {
    queries.push({
      key: 'arsipSurat',
      range: `${quoteSheetName(resolved.arsipSurat)}!A1:L1000`,
    });
  }
  if (resolved.profilDesa && meta.sheetTitles.includes(resolved.profilDesa)) {
    queries.push({
      key: 'profilDesa',
      range: `${quoteSheetName(resolved.profilDesa)}!A1:B50`,
    });
  }
  if (resolved.templates && meta.sheetTitles.includes(resolved.templates)) {
    queries.push({
      key: 'templates',
      range: `${quoteSheetName(resolved.templates)}!A1:L50`,
    });
  }

  const result: {
    residents?: Resident[];
    territories?: TerritoryUnit[];
    dusuns?: DusunUnit[];
    rws?: RwUnit[];
    letters?: LetterRecord[];
    templates?: LetterTemplate[];
    profilePatch?: Partial<VillageProfile>;
    resolvedMapping: SheetTabMapping;
    spreadsheetTitle: string;
  } = {
    resolvedMapping: resolved,
    spreadsheetTitle: meta.title,
  };

  if (queries.length === 0) return result;

  const params = new URLSearchParams();
  for (const q of queries) {
    params.append('ranges', q.range);
  }

  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${params.toString()}`,
    accessToken
  );

  const valueRanges: { range: string; values?: string[][] }[] = res.valueRanges || [];

  queries.forEach((query, idx) => {
    const rows = valueRanges[idx]?.values || [];
    if (rows.length <= 1) return;

    switch (query.key) {
      case 'penduduk':
        result.residents = rows
          .slice(1)
          .map((row, i) => rowToResident(row, i))
          .filter((r): r is Resident => r !== null);
        break;
      case 'kewilayahan':
        result.territories = rows
          .slice(1)
          .map((row, i) => rowToTerritory(row, i))
          .filter((t): t is TerritoryUnit => t !== null);
        break;
      case 'dusun':
        result.dusuns = rows
          .slice(1)
          .map((row, i) => rowToDusun(row, i))
          .filter((d): d is DusunUnit => d !== null);
        break;
      case 'rw':
        result.rws = rows
          .slice(1)
          .map((row, i) => rowToRw(row, i))
          .filter((r): r is RwUnit => r !== null);
        break;
      case 'arsipSurat':
        result.letters = rows
          .slice(1)
          .map((row, i) => rowToLetter(row, i))
          .filter((l): l is LetterRecord => l !== null);
        break;
      case 'templates':
        result.templates = rows
          .slice(1)
          .map((row) => rowToTemplate(row))
          .filter((t): t is LetterTemplate => t !== null);
        break;
      case 'profilDesa': {
        const patch: Record<string, string | number | undefined> = {};
        for (const row of rows.slice(1)) {
          if (row[0] && row[1] !== undefined) {
            if (row[0] === 'kantorLat' || row[0] === 'kantorLng') {
              const num = Number(row[1]);
              patch[row[0]] = row[1] !== '' && !Number.isNaN(num) ? num : undefined;
            } else if (row[0] === 'logoPemdaUrl') {
              if (row[1].trim()) {
                patch[row[0]] = row[1];
              }
            } else {
              patch[row[0]] = row[1];
            }
          }
        }
        result.profilePatch = patch as Partial<VillageProfile>;
        break;
      }
    }
  });

  return result;
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  content: Blob | string
): Promise<DriveFileItem> {
  const metadata = {
    name: fileName,
    mimeType,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append(
    'file',
    typeof content === 'string' ? new Blob([content], { type: mimeType }) : content
  );

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: form,
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gagal mengunggah ke Google Drive: ${errText}`);
  }

  return response.json();
}
