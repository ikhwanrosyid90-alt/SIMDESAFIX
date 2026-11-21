export type Gender = 'Laki-laki' | 'Perempuan';

export type ResidentStatus = 'Tetap' | 'Pendatang' | 'Pindah' | 'Meninggal';

export type Religion = 'Islam' | 'Kristen' | 'Katolik' | 'Hindu' | 'Buddha' | 'Konghucu';

export type MaritalStatus = 'Belum Kawin' | 'Kawin' | 'Cerai Hidup' | 'Cerai Mati';

export type EducationLevel =
  | 'Tidak/Belum Sekolah'
  | 'SD/Sederajat'
  | 'SMP/Sederajat'
  | 'SMA/Sederajat'
  | 'Diploma (D1-D3)'
  | 'Sarjana (S1/D4)'
  | 'Pascasarjana (S2/S3)';

export type HouseOwnershipStatus = 'Milik Sendiri' | 'Menumpang' | 'Sewa / Kontrak';

export type HouseConditionType =
  | 'Permanen (Tembok)'
  | 'Semi Permanen'
  | 'Kayu / Papan / Bilik';

export type RtlhStatus = 'Layak Huni' | 'Calon Penerima RTLH' | 'Penerima RTLH';

export interface AssistanceProgram {
  id: string;
  namaProgram: string;
  tahun: string;
  nominalAtauBentuk: string;
  status: 'Aktif' | 'Selesai';
  keterangan?: string;
}

export interface Resident {
  id: string;
  nik: string;
  noKk: string;
  nama: string;
  jenisKelamin: Gender;
  tempatLahir: string;
  tanggalLahir: string; // YYYY-MM-DD
  agama: Religion;
  pendidikan: EducationLevel;
  pekerjaan: string;
  statusPerkawinan: MaritalStatus;
  hubunganKeluarga: 'Kepala Keluarga' | 'Istri' | 'Anak' | 'Orang Tua' | 'Famili Lain';
  golonganDarah: 'A' | 'B' | 'AB' | 'O' | 'Tidak Tahu';
  statusKependudukan: ResidentStatus;
  kewarganegaraan: 'WNI' | 'WNA';
  namaAyah: string;
  namaIbu: string;
  dusunId: string;
  rw: string;
  rt: string;
  alamat: string;
  noHp: string;
  statusRumah?: HouseOwnershipStatus;
  kondisiRumah?: HouseConditionType;
  statusRtlh?: RtlhStatus;
  ktpFileUrl?: string;
  ktpFileName?: string;
  kkFileUrl?: string;
  kkFileName?: string;
  bantuanList?: AssistanceProgram[];
  updatedAt: string;
}

export interface DusunCommitteeMember {
  id: string;
  nama: string;
  jabatan: string;
  noHp: string;
  periode: string;
}

export interface DusunUnit {
  id: string;
  kode: string;
  namaDusun: string;
  kepalaDusun: string;
  noHpKadus: string;
  luasWilayah: string;
  keterangan: string;
  kepengurusan: DusunCommitteeMember[];
}

export interface RwUnit {
  id: string;
  dusunKode: string;
  namaDusun: string;
  rw: string;
  ketuaRw: string;
  noHpRw: string;
  keterangan: string;
}

export interface TerritoryUnit {
  id: string;
  kode: string;
  namaDusun: string;
  rw: string;
  rt: string;
  kepalaWilayah: string; // Ketua RT
  jabatan: 'Kepala Dusun' | 'Ketua RW' | 'Ketua RT';
  noHp: string;
  luasWilayah: string;
  keterangan: string;
  latitude?: number;
  longitude?: number;
}

export interface VillageProfile {
  namaDesa: string;
  kodeDesa: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  alamatKantor: string;
  kodePos: string;
  telepon: string;
  email: string;
  website: string;
  namaKepalaDesa: string;
  nipKepalaDesa: string;
  logoPemdaUrl: string;
  kantorLat?: number;
  kantorLng?: number;
  updatedAt: string;
}

export type LetterType = 'pengantar' | 'domisili' | 'usaha' | 'sktm';

export interface LetterTemplate {
  type: LetterType;
  label: string;
  kodeKlasifikasi: string;
  formatNomor: string;
  judulSurat: string;
  subJudul: string;
  kalimatPembuka: string;
  kalimatIsi: string;
  kalimatPenutup: string;
  jabatanPenandatangan: string;
  tampilkanMasaBerlaku: boolean;
  masaBerlakuHari: number;
}

export interface LetterCustomFields {
  keperluan: string;
  jenisPengantar?: string;
  namaUsaha?: string;
  jenisUsaha?: string;
  alamatUsaha?: string;
  lamaUsaha?: string;
  penghasilan?: string;
  jumlahTanggungan?: string;
  keteranganTambahan?: string;
}

export interface LetterRecord {
  id: string;
  nomorSurat: string;
  type: LetterType;
  judulSurat: string;
  residentId: string;
  residentNik: string;
  residentNama: string;
  tanggalTerbit: string;
  keperluan: string;
  penandatangan: string;
  customFields: LetterCustomFields;
  driveFileId?: string;
}

export interface SheetTabMapping {
  penduduk: string;
  kewilayahan: string;
  arsipSurat: string;
  profilDesa: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  action: 'pull' | 'push' | 'create' | 'drive_archive';
  summary: string;
  status: 'success' | 'error';
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export type ActiveTab =
  | 'dashboard'
  | 'penduduk'
  | 'surat'
  | 'kewilayahan'
  | 'peta'
  | 'statistik'
  | 'sinkronisasi';
