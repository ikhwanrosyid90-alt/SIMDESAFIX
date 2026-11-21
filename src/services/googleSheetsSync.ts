import {
  DriveFileItem,
  LetterRecord,
  Resident,
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
];

const PROFIL_DESA_HEADERS = ['Field', 'Value'];

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
    r.ktpFileUrl ? `Ada (${r.ktpFileName || 'ktp'})` : 'Belum',
    r.kkFileUrl ? `Ada (${r.kkFileName || 'kk'})` : 'Belum',
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
  };
}

function profileToRows(p: VillageProfile): string[][] {
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
  letters: LetterRecord[]
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
          { properties: { title: 'Penduduk' } },
          { properties: { title: 'Kewilayahan' } },
          { properties: { title: 'Arsip_Surat' } },
          { properties: { title: 'Profil_Desa' } },
        ],
      }),
    }
  );

  const meta: SpreadsheetMetadata = {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl: created.spreadsheetUrl,
    sheetTitles: ['Penduduk', 'Kewilayahan', 'Arsip_Surat', 'Profil_Desa'],
  };

  await pushToGoogleSheets(
    accessToken,
    meta.spreadsheetId,
    {
      penduduk: 'Penduduk',
      kewilayahan: 'Kewilayahan',
      arsipSurat: 'Arsip_Surat',
      profilDesa: 'Profil_Desa',
    },
    { profile, residents, territories, letters }
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
    letters: LetterRecord[];
  }
): Promise<void> {
  const rangesToClear = [
    `${quoteSheetName(tabMapping.penduduk)}!A:AD`,
    tabMapping.kewilayahan ? `${quoteSheetName(tabMapping.kewilayahan)}!A:Z` : null,
    tabMapping.arsipSurat ? `${quoteSheetName(tabMapping.arsipSurat)}!A:Z` : null,
    tabMapping.profilDesa ? `${quoteSheetName(tabMapping.profilDesa)}!A:B` : null,
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
      range: `${quoteSheetName(tabMapping.penduduk)}!A1`,
      values: [PENDUDUK_HEADERS, ...payload.residents.map(residentToRow)],
    },
  ];

  if (tabMapping.kewilayahan) {
    data.push({
      range: `${quoteSheetName(tabMapping.kewilayahan)}!A1`,
      values: [KEWILAYAHAN_HEADERS, ...payload.territories.map(territoryToRow)],
    });
  }

  if (tabMapping.arsipSurat) {
    data.push({
      range: `${quoteSheetName(tabMapping.arsipSurat)}!A1`,
      values: [ARSIP_SURAT_HEADERS, ...payload.letters.map(letterToRow)],
    });
  }

  if (tabMapping.profilDesa) {
    data.push({
      range: `${quoteSheetName(tabMapping.profilDesa)}!A1`,
      values: profileToRows(payload.profile),
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
}

export async function pullFromGoogleSheets(
  accessToken: string,
  spreadsheetId: string,
  tabMapping: SheetTabMapping
): Promise<{
  residents?: Resident[];
  territories?: TerritoryUnit[];
  letters?: LetterRecord[];
  profilePatch?: Partial<VillageProfile>;
}> {
  const ranges: string[] = [`${quoteSheetName(tabMapping.penduduk)}!A1:AD2000`];
  if (tabMapping.kewilayahan) {
    ranges.push(`${quoteSheetName(tabMapping.kewilayahan)}!A1:L500`);
  }
  if (tabMapping.arsipSurat) {
    ranges.push(`${quoteSheetName(tabMapping.arsipSurat)}!A1:K1000`);
  }
  if (tabMapping.profilDesa) {
    ranges.push(`${quoteSheetName(tabMapping.profilDesa)}!A1:B50`);
  }

  const params = new URLSearchParams();
  for (const r of ranges) {
    params.append('ranges', r);
  }

  const res = await googleFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${params.toString()}`,
    accessToken
  );

  const valueRanges: { range: string; values?: string[][] }[] = res.valueRanges || [];
  const result: {
    residents?: Resident[];
    territories?: TerritoryUnit[];
    letters?: LetterRecord[];
    profilePatch?: Partial<VillageProfile>;
  } = {};

  let idx = 0;
  const residentRows = valueRanges[idx++]?.values || [];
  if (residentRows.length > 1) {
    result.residents = residentRows
      .slice(1)
      .map((row, i) => rowToResident(row, i))
      .filter((r): r is Resident => r !== null);
  }

  if (tabMapping.kewilayahan) {
    const territoryRows = valueRanges[idx++]?.values || [];
    if (territoryRows.length > 1) {
      result.territories = territoryRows
        .slice(1)
        .map((row, i) => rowToTerritory(row, i))
        .filter((t): t is TerritoryUnit => t !== null);
    }
  }

  if (tabMapping.arsipSurat) {
    const letterRows = valueRanges[idx++]?.values || [];
    if (letterRows.length > 1) {
      result.letters = letterRows
        .slice(1)
        .map((row, i) => rowToLetter(row, i))
        .filter((l): l is LetterRecord => l !== null);
    }
  }

  if (tabMapping.profilDesa) {
    const profileRows = valueRanges[idx++]?.values || [];
    if (profileRows.length > 1) {
      const patch: Record<string, string | number | undefined> = {};
      for (const row of profileRows.slice(1)) {
        if (row[0] && row[1] !== undefined) {
          if (row[0] === 'kantorLat' || row[0] === 'kantorLng') {
            const num = Number(row[1]);
            patch[row[0]] = row[1] !== '' && !Number.isNaN(num) ? num : undefined;
          } else {
            patch[row[0]] = row[1];
          }
        }
      }
      result.profilePatch = patch as Partial<VillageProfile>;
    }
  }

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
