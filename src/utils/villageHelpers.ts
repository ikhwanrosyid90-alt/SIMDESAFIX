import {
  HouseConditionType,
  HouseOwnershipStatus,
  LetterCustomFields,
  LetterTemplate,
  Resident,
  RtlhStatus,
  TerritoryUnit,
  VillageProfile,
} from '../types/village';

const MONTHS_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
];

export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr) return '-';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  const day = parsed.getDate();
  const month = MONTHS_ID[parsed.getMonth()] || '';
  const year = parsed.getFullYear();
  return `${day} ${month} ${year}`;
}

export function calculateAge(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  const birth = new Date(birthDateStr);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function generateLetterNumber(
  template: LetterTemplate,
  sequenceNumber: number,
  profile: VillageProfile,
  issueDateStr: string
): string {
  const date = issueDateStr ? new Date(issueDateStr) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const paddedNo = String(sequenceNumber).padStart(3, '0');
  const romanMonth = ROMAN_MONTHS[safeDate.getMonth()] || 'XI';
  const year = String(safeDate.getFullYear());
  const shortCode = profile.kodeDesa.split('.').pop() || '2001';

  return template.formatNomor
    .replace(/\{\{NO\}\}/g, paddedNo)
    .replace(/\{\{BULAN_ROMAWI\}\}/g, romanMonth)
    .replace(/\{\{TAHUN\}\}/g, year)
    .replace(/\{\{KODE_DESA\}\}/g, shortCode);
}

export function interpolateTemplateText(
  rawText: string,
  resident: Resident,
  profile: VillageProfile,
  territory: TerritoryUnit | undefined,
  customFields: LetterCustomFields
): string {
  const ttl = `${resident.tempatLahir}, ${formatIndonesianDate(resident.tanggalLahir)}`;
  const dusunName = territory?.namaDusun || 'Dusun Krajan';

  const replacements: Record<string, string> = {
    '{{nama_desa}}': profile.namaDesa,
    '{{kecamatan}}': profile.kecamatan,
    '{{kabupaten}}': profile.kabupaten,
    '{{provinsi}}': profile.provinsi,
    '{{nama_kades}}': profile.namaKepalaDesa,
    '{{nama}}': resident.nama,
    '{{nik}}': resident.nik,
    '{{no_kk}}': resident.noKk,
    '{{ttl}}': ttl,
    '{{jenis_kelamin}}': resident.jenisKelamin,
    '{{agama}}': resident.agama,
    '{{pekerjaan}}': resident.pekerjaan,
    '{{status_perkawinan}}': resident.statusPerkawinan,
    '{{alamat}}': resident.alamat,
    '{{rt}}': resident.rt,
    '{{rw}}': resident.rw,
    '{{dusun}}': dusunName,
    '{{keperluan}}': customFields.keperluan || '-',
    '{{jenis_pengantar}}': customFields.jenisPengantar || 'Pengantar Administrasi',
    '{{nama_usaha}}': customFields.namaUsaha || '-',
    '{{jenis_usaha}}': customFields.jenisUsaha || '-',
    '{{alamat_usaha}}': customFields.alamatUsaha || resident.alamat,
    '{{lama_usaha}}': customFields.lamaUsaha || '-',
    '{{penghasilan}}': customFields.penghasilan || 'Kurang dari Rp 1.500.000 / bulan',
    '{{jumlah_tanggungan}}': customFields.jumlahTanggungan || '1',
  };

  let output = rawText;
  for (const [token, value] of Object.entries(replacements)) {
    output = output.split(token).join(value);
  }
  return output;
}

export function resizeImageFileToDataUrl(
  file: File,
  maxDimension = 360
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Berkas bukan format gambar yang valid.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function readDocumentFileAsDataUrl(
  file: File,
  maxImageDimension = 1080
): Promise<{ dataUrl: string; fileName: string }> {
  if (file.type === 'application/pdf') {
    if (file.size > 2.5 * 1024 * 1024) {
      return Promise.reject(
        new Error('Ukuran berkas PDF maksimal 2,5 MB.')
      );
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Gagal membaca berkas PDF.'));
      reader.onload = () =>
        resolve({ dataUrl: String(reader.result), fileName: file.name });
      reader.readAsDataURL(file);
    });
  }

  return resizeImageFileToDataUrl(file, maxImageDimension).then((dataUrl) => ({
    dataUrl,
    fileName: file.name,
  }));
}

export interface HouseholdHousingEntry {
  noKk: string;
  representative: Resident;
  statusRumah: HouseOwnershipStatus;
  kondisiRumah: HouseConditionType;
  statusRtlh: RtlhStatus;
}

export interface VillageHousingSummary {
  totalKk: number;
  totalRumah: number;
  milikSendiriCount: number;
  menumpangCount: number;
  sewaCount: number;
  permanenCount: number;
  semiPermanenCount: number;
  kayuCount: number;
  rtlhCount: number;
  households: HouseholdHousingEntry[];
  rtlhHouseholds: HouseholdHousingEntry[];
}

export function summarizeVillageHousing(
  residents: Resident[]
): VillageHousingSummary {
  const active = residents.filter(
    (r) => r.statusKependudukan === 'Tetap' || r.statusKependudukan === 'Pendatang'
  );

  const byKk = new Map<string, Resident[]>();
  for (const r of active) {
    const list = byKk.get(r.noKk) || [];
    list.push(r);
    byKk.set(r.noKk, list);
  }

  const households: HouseholdHousingEntry[] = [];
  for (const [noKk, members] of byKk.entries()) {
    const head =
      members.find((m) => m.hubunganKeluarga === 'Kepala Keluarga') || members[0];
    const withStatus = members.find((m) => m.statusRumah) || head;
    const withKondisi = members.find((m) => m.kondisiRumah) || head;
    const withRtlh = members.find((m) => m.statusRtlh) || head;

    const statusRumah: HouseOwnershipStatus =
      withStatus.statusRumah || 'Milik Sendiri';
    const kondisiRumah: HouseConditionType =
      withKondisi.kondisiRumah || 'Permanen (Tembok)';
    const statusRtlh: RtlhStatus = withRtlh.statusRtlh || 'Layak Huni';

    households.push({
      noKk,
      representative: head,
      statusRumah,
      kondisiRumah,
      statusRtlh,
    });
  }

  const physicalHouses = households.filter((h) => h.statusRumah !== 'Menumpang');
  const milikSendiriCount = households.filter(
    (h) => h.statusRumah === 'Milik Sendiri'
  ).length;
  const menumpangCount = households.filter(
    (h) => h.statusRumah === 'Menumpang'
  ).length;
  const sewaCount = households.filter(
    (h) => h.statusRumah === 'Sewa / Kontrak'
  ).length;

  const permanenCount = physicalHouses.filter(
    (h) => h.kondisiRumah === 'Permanen (Tembok)'
  ).length;
  const semiPermanenCount = physicalHouses.filter(
    (h) => h.kondisiRumah === 'Semi Permanen'
  ).length;
  const kayuCount = physicalHouses.filter(
    (h) => h.kondisiRumah === 'Kayu / Papan / Bilik'
  ).length;

  const rtlhHouseholds = households.filter(
    (h) =>
      h.statusRtlh === 'Calon Penerima RTLH' || h.statusRtlh === 'Penerima RTLH'
  );

  return {
    totalKk: households.length,
    totalRumah: physicalHouses.length,
    milikSendiriCount,
    menumpangCount,
    sewaCount,
    permanenCount,
    semiPermanenCount,
    kayuCount,
    rtlhCount: rtlhHouseholds.length,
    households,
    rtlhHouseholds,
  };
}

export function exportResidentsToCsv(
  residents: Resident[],
  territories: TerritoryUnit[]
): string {
  const headers = [
    'NIK',
    'No KK',
    'Nama Lengkap',
    'Jenis Kelamin',
    'Tempat Lahir',
    'Tanggal Lahir',
    'Usia',
    'Agama',
    'Pendidikan',
    'Pekerjaan',
    'Status Perkawinan',
    'SHDK',
    'Status Kependudukan',
    'Dusun',
    'RW',
    'RT',
    'Alamat',
    'No HP',
    'Status Rumah',
    'Konstruksi Rumah',
    'Status RTLH',
    'Program Bantuan',
    'Berkas KTP',
    'Berkas KK',
  ];

  const territoryMap = new Map(territories.map((t) => [t.id, t]));
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = residents.map((r) => {
    const dusun = territoryMap.get(r.dusunId)?.namaDusun || '-';
    const bantuanStr = (r.bantuanList || [])
      .map((b) => `${b.namaProgram} (${b.tahun} - ${b.status})`)
      .join('; ');
    return [
      r.nik,
      r.noKk,
      r.nama,
      r.jenisKelamin,
      r.tempatLahir,
      r.tanggalLahir,
      calculateAge(r.tanggalLahir),
      r.agama,
      r.pendidikan,
      r.pekerjaan,
      r.statusPerkawinan,
      r.hubunganKeluarga,
      r.statusKependudukan,
      dusun,
      r.rw,
      r.rt,
      r.alamat,
      r.noHp,
      r.statusRumah || 'Milik Sendiri',
      r.kondisiRumah || 'Permanen (Tembok)',
      r.statusRtlh || 'Layak Huni',
      bantuanStr || '-',
      r.ktpFileUrl ? 'Ada' : 'Belum',
      r.kkFileUrl ? 'Ada' : 'Belum',
    ]
      .map(escapeCell)
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
