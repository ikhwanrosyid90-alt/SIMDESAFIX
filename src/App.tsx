import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BarChart3,
  Cloud,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  MapPin,
  Menu,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveTab,
  DriveFileItem,
  DusunUnit,
  LetterCustomFields,
  LetterRecord,
  LetterTemplate,
  LetterType,
  Resident,
  RwUnit,
  SheetTabMapping,
  SyncLogEntry,
  TerritoryUnit,
  VillageProfile,
} from './types/village';
import {
  DEFAULT_PEMDA_LOGO,
  INITIAL_DUSUNS,
  INITIAL_LETTERS,
  INITIAL_RESIDENTS,
  INITIAL_RWS,
  INITIAL_TEMPLATES,
  INITIAL_TERRITORIES,
  INITIAL_VILLAGE_PROFILE,
} from './data/seedData';
import {
  clearCachedToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  createVillageSpreadsheet,
  fetchSpreadsheetMetadata,
  listArchivedDriveFiles,
  listDriveSpreadsheets,
  pullFromGoogleSheets,
  pushToGoogleSheets,
  shareSpreadsheetWithEmail,
  SpreadsheetMetadata,
  uploadFileToDrive,
} from './services/googleSheetsSync';
import { DashboardView } from './components/DashboardView';
import { ResidentsView } from './components/ResidentsView';
import { LettersView } from './components/LettersView';
import { TerritoryView } from './components/TerritoryView';
import { StatisticsView } from './components/StatisticsView';
import { GoogleWorkspaceView } from './components/GoogleWorkspaceView';
import { VillageMapView } from './components/VillageMapView';
import { LetterPreviewModal } from './components/LetterPreviewModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

const STORAGE_KEYS = {
  profile: 'simdesa_profile_v1',
  residents: 'simdesa_residents_v1',
  dusuns: 'simdesa_dusuns_v1',
  rws: 'simdesa_rws_v1',
  territories: 'simdesa_territories_v1',
  templates: 'simdesa_templates_v1',
  letters: 'simdesa_letters_v1',
  spreadsheetId: 'simdesa_spreadsheet_id_v1',
  spreadsheetMeta: 'simdesa_spreadsheet_meta_v1',
  tabMapping: 'simdesa_tab_mapping_v1',
  autoSync: 'simdesa_autosync_v1',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface PendingConfirm {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  variant: 'primary' | 'danger';
  action: () => Promise<void> | void;
}

const NAV_ITEMS: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard Desa', icon: LayoutDashboard },
  { id: 'penduduk', label: 'Data Penduduk', icon: Users },
  { id: 'surat', label: 'Administrasi Surat', icon: FileText },
  { id: 'kewilayahan', label: 'Kewilayahan', icon: MapPin },
  { id: 'peta', label: 'Peta Desa', icon: MapIcon },
  { id: 'statistik', label: 'Laporan Statistik', icon: BarChart3 },
  { id: 'sinkronisasi', label: 'Google Sheets Sync', icon: Cloud },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Village Domain State
  const [profile, setProfile] = useState<VillageProfile>(() =>
    loadJson(STORAGE_KEYS.profile, INITIAL_VILLAGE_PROFILE)
  );
  const [residents, setResidents] = useState<Resident[]>(() =>
    loadJson(STORAGE_KEYS.residents, INITIAL_RESIDENTS)
  );
  const [dusuns, setDusuns] = useState<DusunUnit[]>(() =>
    loadJson(STORAGE_KEYS.dusuns, INITIAL_DUSUNS)
  );
  const [rws, setRws] = useState<RwUnit[]>(() =>
    loadJson(STORAGE_KEYS.rws, INITIAL_RWS)
  );
  const [territories, setTerritories] = useState<TerritoryUnit[]>(() =>
    loadJson(STORAGE_KEYS.territories, INITIAL_TERRITORIES)
  );
  const [templates, setTemplates] = useState<LetterTemplate[]>(() =>
    loadJson(STORAGE_KEYS.templates, INITIAL_TEMPLATES)
  );
  const [letters, setLetters] = useState<LetterRecord[]>(() =>
    loadJson(STORAGE_KEYS.letters, INITIAL_LETTERS)
  );

  // Google Auth & Workspace State (token strictly in memory inside googleAuth.ts)
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isWorkspaceBusy, setIsWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [driveSpreadsheets, setDriveSpreadsheets] = useState<DriveFileItem[]>([]);
  const [archivedDriveFiles, setArchivedDriveFiles] = useState<DriveFileItem[]>([]);
  const [savedSpreadsheetId, setSavedSpreadsheetId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEYS.spreadsheetId)
  );
  const [connectedSpreadsheet, setConnectedSpreadsheet] =
    useState<SpreadsheetMetadata | null>(() =>
      loadJson<SpreadsheetMetadata | null>(STORAGE_KEYS.spreadsheetMeta, null)
    );
  const [tabMapping, setTabMapping] = useState<SheetTabMapping>(() =>
    loadJson(STORAGE_KEYS.tabMapping, {
      penduduk: 'Penduduk',
      kewilayahan: 'Kewilayahan',
      arsipSurat: 'Arsip_Surat',
      profilDesa: 'Profil_Desa',
    })
  );
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.autoSync);
    return saved === null ? true : saved === 'true';
  });
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Resident Add Modal external trigger
  const [addResidentTrigger, setAddResidentTrigger] = useState(0);
  const [selectedMapTerritoryId, setSelectedMapTerritoryId] = useState<string | null>(
    null
  );
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Letter Preview Modal State
  const [letterModalState, setLetterModalState] = useState<{
    open: boolean;
    resident: Resident | null;
    type: LetterType;
    customFields?: LetterCustomFields;
    existingRecord?: LetterRecord | null;
  }>({
    open: false,
    resident: null,
    type: 'pengantar',
  });

  // Explicit Confirmation Dialog State
  const [confirmState, setConfirmState] = useState<PendingConfirm | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Persist domain state locally
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch {
      // ignore quota error
    }
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.residents, JSON.stringify(residents));
    } catch {
      // ignore localStorage quota overflow for large attachments
    }
  }, [residents]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.dusuns, JSON.stringify(dusuns));
  }, [dusuns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rws, JSON.stringify(rws));
  }, [rws]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.territories, JSON.stringify(territories));
  }, [territories]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
  }, [templates]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.letters, JSON.stringify(letters));
  }, [letters]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.tabMapping, JSON.stringify(tabMapping));
  }, [tabMapping]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.autoSync, String(autoSyncEnabled));
  }, [autoSyncEnabled]);

  useEffect(() => {
    try {
      if (connectedSpreadsheet) {
        localStorage.setItem(
          STORAGE_KEYS.spreadsheetMeta,
          JSON.stringify(connectedSpreadsheet)
        );
      } else {
        localStorage.removeItem(STORAGE_KEYS.spreadsheetMeta);
      }
    } catch {
      // ignore storage error
    }
  }, [connectedSpreadsheet]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((cur) => (cur === msg ? null : cur)), 3500);
  }, []);

  const addSyncLog = useCallback(
    (action: SyncLogEntry['action'], summary: string, status: 'success' | 'error') => {
      setSyncLogs((prev) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          action,
          summary,
          status,
        },
        ...prev.slice(0, 24),
      ]);
    },
    []
  );

  const loadDriveFilesAndMeta = useCallback(
    async (token: string, searchTerm = '') => {
      setIsWorkspaceBusy(true);
      setWorkspaceError(null);
      try {
        const [sheetsList, archiveList] = await Promise.all([
          listDriveSpreadsheets(token, searchTerm),
          listArchivedDriveFiles(token),
        ]);
        setDriveSpreadsheets(sheetsList);
        setArchivedDriveFiles(archiveList);

        if (savedSpreadsheetId) {
          try {
            const meta = await fetchSpreadsheetMetadata(token, savedSpreadsheetId);
            setConnectedSpreadsheet(meta);
            setTabMapping((prev) => ({
              penduduk: meta.sheetTitles.includes(prev.penduduk)
                ? prev.penduduk
                : meta.sheetTitles[0] || 'Penduduk',
              kewilayahan: meta.sheetTitles.includes(prev.kewilayahan)
                ? prev.kewilayahan
                : '',
              arsipSurat: meta.sheetTitles.includes(prev.arsipSurat)
                ? prev.arsipSurat
                : '',
              profilDesa: meta.sheetTitles.includes(prev.profilDesa)
                ? prev.profilDesa
                : '',
            }));
          } catch {
            // spreadsheet might not be accessible
          }
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Gagal memuat daftar file Google Drive.';
        setWorkspaceError(msg);
      } finally {
        setIsWorkspaceBusy(false);
      }
    },
    [savedSpreadsheetId]
  );

  // Initialize Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = initAuth(
      async (user, token) => {
        setGoogleUser(user);
        setNeedsAuth(false);
        await loadDriveFilesAndMeta(token);
      },
      (user) => {
        setGoogleUser(user);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, [loadDriveFilesAndMeta]);

  const handleGoogleSignIn = async (forceAccountSelect = false) => {
    setIsWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      const result = await googleSignIn({
        loginHint: !forceAccountSelect ? googleUser?.email || undefined : undefined,
        forceAccountSelect: forceAccountSelect || !googleUser,
      });
      if (result) {
        setGoogleUser(result.user);
        setNeedsAuth(false);
        await loadDriveFilesAndMeta(result.accessToken);
        showToast('Sesi Google Sheets & Drive aktif.');
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal masuk dengan akun Google. Pastikan pop-up tidak diblokir.';
      setWorkspaceError(msg);
      showToast(msg);
    } finally {
      setIsWorkspaceBusy(false);
    }
  };

  const ensureWorkspaceToken = useCallback(async (): Promise<string | null> => {
    const existing = await getAccessToken();
    if (existing) return existing;

    const result = await googleSignIn({
      loginHint: googleUser?.email || undefined,
      forceAccountSelect: !googleUser,
    });
    if (result) {
      setGoogleUser(result.user);
      setNeedsAuth(false);
      await loadDriveFilesAndMeta(result.accessToken);
      return result.accessToken;
    }
    return null;
  }, [googleUser, loadDriveFilesAndMeta]);

  const handleGoogleSignOut = async () => {
    await logout();
    setGoogleUser(null);
    setNeedsAuth(true);
    setConnectedSpreadsheet(null);
    setSavedSpreadsheetId(null);
    localStorage.removeItem(STORAGE_KEYS.spreadsheetId);
    localStorage.removeItem(STORAGE_KEYS.spreadsheetMeta);
    setDriveSpreadsheets([]);
    setArchivedDriveFiles([]);
    showToast('Akun Google telah keluar.');
  };

  const handleSelectSpreadsheet = async (spreadsheetId: string) => {
    const token = await ensureWorkspaceToken();
    if (!token) {
      setNeedsAuth(true);
      return;
    }
    setIsWorkspaceBusy(true);
    setWorkspaceError(null);
    try {
      const meta = await fetchSpreadsheetMetadata(token, spreadsheetId);
      setConnectedSpreadsheet(meta);
      setSavedSpreadsheetId(spreadsheetId);
      localStorage.setItem(STORAGE_KEYS.spreadsheetId, spreadsheetId);

      const nextMapping: SheetTabMapping = {
        penduduk: meta.sheetTitles.includes('Penduduk')
          ? 'Penduduk'
          : meta.sheetTitles[0] || '',
        kewilayahan: meta.sheetTitles.includes('Kewilayahan') ? 'Kewilayahan' : '',
        arsipSurat: meta.sheetTitles.includes('Arsip_Surat') ? 'Arsip_Surat' : '',
        profilDesa: meta.sheetTitles.includes('Profil_Desa') ? 'Profil_Desa' : '',
      };
      setTabMapping(nextMapping);

      // Immediately pull latest shared data so multi-device / other Google account syncs right away
      try {
        const pulled = await pullFromGoogleSheets(token, spreadsheetId, nextMapping);
        if (pulled.residents && pulled.residents.length > 0) {
          setResidents((prevResidents) =>
            pulled.residents!.map((incoming) => {
              const localMatch = prevResidents.find(
                (p) => p.id === incoming.id || p.nik === incoming.nik
              );
              return localMatch
                ? {
                    ...incoming,
                    ktpFileUrl: localMatch.ktpFileUrl,
                    ktpFileName: localMatch.ktpFileName,
                    kkFileUrl: localMatch.kkFileUrl,
                    kkFileName: localMatch.kkFileName,
                    bantuanList:
                      incoming.bantuanList && incoming.bantuanList.length > 0
                        ? incoming.bantuanList
                        : localMatch.bantuanList,
                  }
                : incoming;
            })
          );
        }
        if (pulled.territories && pulled.territories.length > 0) {
          setTerritories(pulled.territories);
        }
        if (pulled.letters && pulled.letters.length > 0) {
          setLetters(pulled.letters);
        }
        if (pulled.profilePatch && Object.keys(pulled.profilePatch).length > 0) {
          setProfile((prev) => ({
            ...prev,
            ...pulled.profilePatch,
            logoPemdaUrl: prev.logoPemdaUrl || DEFAULT_PEMDA_LOGO,
          }));
        }
        setLastSyncedAt(new Date().toISOString());
        addSyncLog(
          'pull',
          `Terhubung & menarik data dari "${meta.title}" (${pulled.residents?.length ?? 0} warga).`,
          'success'
        );
      } catch {
        // Sheet might be empty or custom format; still stays connected
      }

      showToast(`Terhubung ke spreadsheet "${meta.title}".`);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal membaca metadata spreadsheet.';
      setWorkspaceError(msg);
    } finally {
      setIsWorkspaceBusy(false);
    }
  };

  const handlePullFromSheets = useCallback(
    async (silent = false) => {
      let token = await getAccessToken();
      if (!token && !silent) {
        try {
          token = await ensureWorkspaceToken();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Gagal menyegarkan sesi Google.';
          setWorkspaceError(msg);
          return;
        }
      }
      if (!token || !connectedSpreadsheet) {
        if (!silent) setNeedsAuth(true);
        return;
      }
      if (!silent) setIsWorkspaceBusy(true);
      setWorkspaceError(null);
      try {
        const pulled = await pullFromGoogleSheets(
          token,
          connectedSpreadsheet.spreadsheetId,
          tabMapping
        );
        if (pulled.residents && pulled.residents.length > 0) {
          setResidents((prevResidents) =>
            pulled.residents!.map((incoming) => {
              const localMatch = prevResidents.find(
                (p) => p.id === incoming.id || p.nik === incoming.nik
              );
              return localMatch
                ? {
                    ...incoming,
                    ktpFileUrl: localMatch.ktpFileUrl,
                    ktpFileName: localMatch.ktpFileName,
                    kkFileUrl: localMatch.kkFileUrl,
                    kkFileName: localMatch.kkFileName,
                    bantuanList:
                      incoming.bantuanList && incoming.bantuanList.length > 0
                        ? incoming.bantuanList
                        : localMatch.bantuanList,
                  }
                : incoming;
            })
          );
        }
        if (pulled.territories && pulled.territories.length > 0) {
          setTerritories(pulled.territories);
        }
        if (pulled.letters && pulled.letters.length > 0) {
          setLetters(pulled.letters);
        }
        if (pulled.profilePatch && Object.keys(pulled.profilePatch).length > 0) {
          setProfile((prev) => ({
            ...prev,
            ...pulled.profilePatch,
            logoPemdaUrl: prev.logoPemdaUrl || DEFAULT_PEMDA_LOGO,
          }));
        }
        const nowIso = new Date().toISOString();
        setLastSyncedAt(nowIso);
        addSyncLog(
          'pull',
          `Menarik data terbaru dari "${connectedSpreadsheet.title}" (${
            pulled.residents?.length ?? 0
          } warga).`,
          'success'
        );
        if (!silent) {
          showToast('Data berhasil ditarik dari Google Sheets.');
        }
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 401) {
          clearCachedToken();
          setNeedsAuth(true);
        }
        const msg =
          status === 401
            ? 'Sesi Google Sheets berakhir. Klik "Aktifkan Sesi Sync" untuk melanjutkan.'
            : err instanceof Error
            ? err.message
            : 'Gagal menarik data dari Google Sheets.';
        if (!silent) setWorkspaceError(msg);
        addSyncLog('pull', msg, 'error');
      } finally {
        if (!silent) setIsWorkspaceBusy(false);
      }
    },
    [connectedSpreadsheet, tabMapping, ensureWorkspaceToken, addSyncLog, showToast]
  );

  // Real-time auto-sync polling (read-only pull every 20s when enabled)
  useEffect(() => {
    if (!autoSyncEnabled || needsAuth || !connectedSpreadsheet) return;
    const timer = setInterval(() => {
      handlePullFromSheets(true);
    }, 20000);
    return () => clearInterval(timer);
  }, [autoSyncEnabled, needsAuth, connectedSpreadsheet, handlePullFromSheets]);

  // Mandatory Confirmation Dialog before sharing spreadsheet Editor access with another Google account
  const requestShareSpreadsheetWithEmail = (email: string) => {
    if (!connectedSpreadsheet) return;
    setConfirmState({
      title: 'Bagikan Akses Editor Spreadsheet?',
      description: `Aplikasi akan memberikan izin akses Editor pada Google Sheets "${connectedSpreadsheet.title}" kepada akun Google ${email}.`,
      details: [
        `Email Penerima: ${email}`,
        `Peran Akses: Editor (dapat melihat dan menyinkronkan data warga)`,
      ],
      confirmLabel: 'Bagikan Akses',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        setIsWorkspaceBusy(true);
        try {
          await shareSpreadsheetWithEmail(
            token,
            connectedSpreadsheet.spreadsheetId,
            email,
            'writer'
          );
          addSyncLog(
            'push',
            `Membagikan akses Editor "${connectedSpreadsheet.title}" ke ${email}.`,
            'success'
          );
          showToast(`Akses Editor berhasil dibagikan ke ${email}.`);
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.message
              : 'Gagal membagikan akses. Anda juga dapat membagikan langsung lewat tombol Share di Google Sheets.';
          setWorkspaceError(msg);
          addSyncLog('push', msg, 'error');
        } finally {
          setIsWorkspaceBusy(false);
        }
      },
    });
  };

  // Mandatory Confirmation Dialog before creating a spreadsheet in Google Sheets/Drive
  const requestCreateSpreadsheet = () => {
    setConfirmState({
      title: 'Buat Spreadsheet Baru di Google Drive?',
      description: `Aplikasi akan membuat spreadsheet baru berjudul "SIMDESA Data Penduduk - Desa ${profile.namaDesa}" di Google Drive Anda dan mengisi seluruh data awal.`,
      details: [
        `Tab Penduduk: ${residents.length} data warga`,
        `Tab Kewilayahan: ${territories.length} unit RT/RW`,
        `Tab Arsip_Surat: ${letters.length} riwayat surat`,
        `Tab Profil_Desa: identitas desa & kepala desa`,
      ],
      confirmLabel: 'Buat & Isi Spreadsheet',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        setIsWorkspaceBusy(true);
        setWorkspaceError(null);
        try {
          const meta = await createVillageSpreadsheet(
            token,
            profile,
            residents,
            territories,
            letters
          );
          setConnectedSpreadsheet(meta);
          setSavedSpreadsheetId(meta.spreadsheetId);
          localStorage.setItem(STORAGE_KEYS.spreadsheetId, meta.spreadsheetId);
          setTabMapping({
            penduduk: 'Penduduk',
            kewilayahan: 'Kewilayahan',
            arsipSurat: 'Arsip_Surat',
            profilDesa: 'Profil_Desa',
          });
          setLastSyncedAt(new Date().toISOString());
          addSyncLog(
            'create',
            `Membuat spreadsheet baru "${meta.title}" dan mengunggah ${residents.length} data warga.`,
            'success'
          );
          await loadDriveFilesAndMeta(token);
          showToast('Spreadsheet baru berhasil dibuat dan disinkronkan.');
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Gagal membuat spreadsheet baru.';
          setWorkspaceError(msg);
          addSyncLog('create', msg, 'error');
        } finally {
          setIsWorkspaceBusy(false);
        }
      },
    });
  };

  // Mandatory Confirmation Dialog before pushing/overwriting Google Sheets data
  const requestPushToSheets = () => {
    if (!connectedSpreadsheet) {
      setActiveTab('sinkronisasi');
      showToast('Pilih atau buat spreadsheet terlebih dahulu.');
      return;
    }

    setConfirmState({
      title: 'Perbarui & Sinkronkan Data ke Google Sheets?',
      description: `Operasi ini akan memperbarui isi spreadsheet "${connectedSpreadsheet.title}" dengan seluruh perubahan data terbaru di aplikasi.`,
      details: [
        `Tab "${tabMapping.penduduk}": ${residents.length} baris penduduk`,
        tabMapping.kewilayahan
          ? `Tab "${tabMapping.kewilayahan}": ${territories.length} unit wilayah`
          : 'Tab Kewilayahan tidak dipetakan',
        tabMapping.arsipSurat
          ? `Tab "${tabMapping.arsipSurat}": ${letters.length} arsip surat`
          : 'Tab Arsip Surat tidak dipetakan',
      ],
      confirmLabel: 'Konfirmasi Sinkronisasi',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        setIsWorkspaceBusy(true);
        setWorkspaceError(null);
        try {
          await pushToGoogleSheets(
            token,
            connectedSpreadsheet.spreadsheetId,
            tabMapping,
            { profile, residents, territories, letters }
          );
          setLastSyncedAt(new Date().toISOString());
          addSyncLog(
            'push',
            `Berhasil memperbarui "${connectedSpreadsheet.title}" (${residents.length} warga, ${letters.length} surat).`,
            'success'
          );
          showToast('Data berhasil disinkronkan ke Google Sheets.');
        } catch (err) {
          const status = (err as { status?: number })?.status;
          if (status === 401) {
            clearCachedToken();
            setNeedsAuth(true);
          }
          const msg =
            err instanceof Error
              ? err.message
              : 'Gagal memperbarui spreadsheet Google Sheets.';
          setWorkspaceError(msg);
          addSyncLog('push', msg, 'error');
        } finally {
          setIsWorkspaceBusy(false);
        }
      },
    });
  };

  // Mandatory Confirmation Dialog before archiving letter to Google Drive
  const requestArchiveLetterToDrive = (record: LetterRecord, htmlContent: string) => {
    setConfirmState({
      title: 'Arsipkan Surat ke Google Drive?',
      description: `Berkas surat "${record.judulSurat}" atas nama ${record.residentNama} akan disimpan ke Google Drive Anda.`,
      details: [
        `Nomor Surat: ${record.nomorSurat}`,
        `Nama Berkas: Surat_${record.type}_${record.residentNama.replace(/\s+/g, '_')}.html`,
      ],
      confirmLabel: 'Unggah ke Google Drive',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        setIsWorkspaceBusy(true);
        try {
          const fileName = `Surat_${record.type}_${record.residentNama.replace(
            /\s+/g,
            '_'
          )}_${record.tanggalTerbit}.html`;
          const uploaded = await uploadFileToDrive(
            token,
            fileName,
            'text/html',
            htmlContent
          );
          setLetters((prev) => {
            const exists = prev.some((l) => l.id === record.id);
            const updatedRec = { ...record, driveFileId: uploaded.id };
            return exists
              ? prev.map((l) => (l.id === record.id ? updatedRec : l))
              : [updatedRec, ...prev];
          });
          addSyncLog(
            'drive_archive',
            `Mengarsipkan "${fileName}" ke Google Drive.`,
            'success'
          );
          await loadDriveFilesAndMeta(token);
          showToast('Surat berhasil diarsipkan ke Google Drive.');
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Gagal mengunggah ke Google Drive.';
          addSyncLog('drive_archive', msg, 'error');
          showToast(msg);
        } finally {
          setIsWorkspaceBusy(false);
        }
      },
    });
  };

  // Mandatory Confirmation Dialog before uploading Pemda logo to Google Drive
  const requestUploadLogoToDrive = (dataUrl: string) => {
    setConfirmState({
      title: 'Simpan Logo Pemerintah Daerah ke Google Drive?',
      description: `Logo Pemerintah Daerah Desa ${profile.namaDesa} akan dicadangkan ke Google Drive Anda.`,
      confirmLabel: 'Simpan Logo ke Drive',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const fileName = `Logo_Pemda_Desa_${profile.namaDesa.replace(/\s+/g, '_')}.png`;
          await uploadFileToDrive(token, fileName, blob.type || 'image/png', blob);
          addSyncLog('drive_archive', `Menyimpan logo "${fileName}" ke Google Drive.`, 'success');
          await loadDriveFilesAndMeta(token);
          showToast('Logo Pemda berhasil dicadangkan ke Google Drive.');
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Gagal menyimpan logo ke Google Drive.';
          showToast(msg);
        }
      },
    });
  };

  // Mandatory Confirmation Dialog before uploading resident KTP/KK document to Google Drive
  const requestUploadResidentDocToDrive = (
    resident: Resident,
    docType: 'KTP' | 'KK',
    dataUrl: string,
    fileName: string
  ) => {
    setConfirmState({
      title: `Simpan Berkas ${docType} ke Google Drive?`,
      description: `Berkas ${docType} atas nama ${resident.nama} (NIK ${resident.nik}) akan dicadangkan ke Google Drive Anda.`,
      details: [`Nama Berkas: SIMDESA_${docType}_${resident.nama.replace(/\s+/g, '_')}_${fileName}`],
      confirmLabel: 'Simpan ke Drive',
      variant: 'primary',
      action: async () => {
        const token = await ensureWorkspaceToken();
        if (!token) {
          setNeedsAuth(true);
          return;
        }
        try {
          const res = await fetch(dataUrl);
          const blob = await res.blob();
          const safeName = `SIMDESA_${docType}_${resident.nama.replace(/\s+/g, '_')}_${fileName}`;
          await uploadFileToDrive(token, safeName, blob.type || 'image/png', blob);
          addSyncLog('drive_archive', `Mencadangkan berkas "${safeName}" ke Google Drive.`, 'success');
          await loadDriveFilesAndMeta(token);
          showToast(`Berkas ${docType} berhasil disimpan ke Google Drive.`);
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : `Gagal mengunggah berkas ${docType} ke Google Drive.`;
          showToast(msg);
        }
      },
    });
  };

  // Resident CRUD handlers
  const handleSaveResident = (
    saved: Resident,
    isNew: boolean,
    syncKkHousing = false
  ) => {
    setResidents((prev) => {
      const nextList = isNew
        ? [saved, ...prev]
        : prev.map((r) => (r.id === saved.id ? saved : r));

      if (!syncKkHousing) return nextList;

      return nextList.map((r) =>
        r.noKk === saved.noKk && r.id !== saved.id
          ? {
              ...r,
              statusRumah: saved.statusRumah,
              kondisiRumah: saved.kondisiRumah,
              statusRtlh: saved.statusRtlh,
              updatedAt: saved.updatedAt,
            }
          : r
      );
    });
    showToast(
      isNew
        ? `Penduduk "${saved.nama}" ditambahkan.`
        : `Biodata "${saved.nama}" diperbarui.`
    );
  };

  const handleDeleteResident = (resident: Resident) => {
    setConfirmState({
      title: 'Hapus Data Penduduk?',
      description: `Apakah Anda yakin ingin menghapus data kependudukan atas nama ${resident.nama}? Tindakan ini tidak dapat dibatalkan.`,
      details: [
        `NIK: ${resident.nik}`,
        `No. KK: ${resident.noKk}`,
        `Alamat: ${resident.alamat}`,
      ],
      confirmLabel: 'Hapus Permanen',
      variant: 'danger',
      action: () => {
        setResidents((prev) => prev.filter((r) => r.id !== resident.id));
        showToast(`Data warga "${resident.nama}" telah dihapus.`);
      },
    });
  };

  // Dusun & Kepengurusan CRUD handlers
  const handleSaveDusun = (dusun: DusunUnit, isNew: boolean) => {
    setDusuns((prev) =>
      isNew ? [...prev, dusun] : prev.map((d) => (d.id === dusun.id ? dusun : d))
    );
    showToast(
      isNew
        ? `Wilayah ${dusun.namaDusun} ditambahkan.`
        : `Data ${dusun.namaDusun} & kepengurusan diperbarui.`
    );
  };

  const handleDeleteDusun = (dusun: DusunUnit, rtCount: number) => {
    if (rtCount > 0) {
      showToast(
        `Tidak dapat menghapus ${dusun.namaDusun} karena masih membawahi ${rtCount} unit RT.`
      );
      return;
    }
    setConfirmState({
      title: 'Hapus Wilayah Dusun?',
      description: `Hapus ${dusun.namaDusun} (${dusun.kode}) beserta daftar kepengurusannya?`,
      confirmLabel: 'Hapus Dusun',
      variant: 'danger',
      action: () => {
        setDusuns((prev) => prev.filter((d) => d.id !== dusun.id));
        showToast(`${dusun.namaDusun} telah dihapus.`);
      },
    });
  };

  // RW CRUD handlers
  const handleSaveRw = (rw: RwUnit, isNew: boolean) => {
    setRws((prev) =>
      isNew ? [...prev, rw] : prev.map((item) => (item.id === rw.id ? rw : item))
    );
    showToast(
      isNew
        ? `RW ${rw.rw} (${rw.namaDusun}) ditambahkan.`
        : `Data RW ${rw.rw} (${rw.ketuaRw}) diperbarui.`
    );
  };

  const handleDeleteRw = (rw: RwUnit, rtCount: number) => {
    if (rtCount > 0) {
      showToast(
        `Tidak dapat menghapus RW ${rw.rw} (${rw.namaDusun}) karena masih memiliki ${rtCount} unit RT.`
      );
      return;
    }
    setConfirmState({
      title: 'Hapus Data RW?',
      description: `Hapus RW ${rw.rw} (${rw.namaDusun}) yang diketuai ${rw.ketuaRw}?`,
      confirmLabel: 'Hapus RW',
      variant: 'danger',
      action: () => {
        setRws((prev) => prev.filter((item) => item.id !== rw.id));
        showToast(`RW ${rw.rw} dihapus.`);
      },
    });
  };

  // Territory (RT) CRUD handlers
  const handleSaveTerritory = (unit: TerritoryUnit, isNew: boolean) => {
    setTerritories((prev) =>
      isNew ? [...prev, unit] : prev.map((t) => (t.id === unit.id ? unit : t))
    );
    showToast(
      isNew
        ? `Wilayah ${unit.namaDusun} RT ${unit.rt}/RW ${unit.rw} ditambahkan.`
        : `Wilayah ${unit.namaDusun} RT ${unit.rt}/RW ${unit.rw} diperbarui.`
    );
  };

  const handleDeleteTerritory = (unit: TerritoryUnit, assignedCount: number) => {
    if (assignedCount > 0) {
      showToast(
        `Tidak dapat menghapus ${unit.namaDusun} RT ${unit.rt}/RW ${unit.rw} karena masih ada ${assignedCount} warga terdaftar.`
      );
      return;
    }
    setConfirmState({
      title: 'Hapus Satuan RT?',
      description: `Hapus RT ${unit.rt} / RW ${unit.rw} (${unit.namaDusun}) dari daftar wilayah desa?`,
      confirmLabel: 'Hapus RT',
      variant: 'danger',
      action: () => {
        setTerritories((prev) => prev.filter((t) => t.id !== unit.id));
        showToast(`RT ${unit.rt} / RW ${unit.rw} (${unit.namaDusun}) dihapus.`);
      },
    });
  };

  // Letter handlers
  const handleOpenLetterPreview = (
    resident: Resident,
    type: LetterType,
    customFields?: LetterCustomFields,
    existingRecord?: LetterRecord
  ) => {
    setLetterModalState({
      open: true,
      resident,
      type,
      customFields,
      existingRecord: existingRecord || null,
    });
  };

  const handleSaveLetterRecord = (record: LetterRecord) => {
    setLetters((prev) => {
      const exists = prev.some((l) => l.id === record.id);
      return exists
        ? prev.map((l) => (l.id === record.id ? record : l))
        : [record, ...prev];
    });
  };

  const activeTemplate =
    templates.find((t) => t.type === letterModalState.type) || templates[0];

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeTab)?.label || 'Dashboard';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {mapsQuotaExceeded && (
        <div className="no-print bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Desktop Sidebar (no-print) */}
      <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-0.5">
            <img
              src={profile.logoPemdaUrl || DEFAULT_PEMDA_LOGO}
              alt="Logo Desa"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_PEMDA_LOGO;
              }}
            />
          </div>
          <div className="min-w-0">
            <p className="font-display truncate text-sm font-bold tracking-tight text-slate-900">
              SIMDESA
            </p>
            <p className="truncate text-xs text-slate-500">
              Desa {profile.namaDesa}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-800 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Google Connection Box */}
        <div className="border-t border-slate-200 p-4">
          {!googleUser ? (
            <div className="space-y-2.5">
              <p className="text-[11px] leading-relaxed text-slate-500">
                Hubungkan akun Google untuk sinkronisasi Sheets real-time.
              </p>
              <GoogleSignInButton
                onClick={() => handleGoogleSignIn(true)}
                disabled={isWorkspaceBusy}
                label="Sign in with Google"
                className="w-full"
              />
            </div>
          ) : needsAuth ? (
            <div className="space-y-2">
              <div className="text-xs">
                <p className="truncate font-medium text-slate-900">
                  {googleUser.displayName || googleUser.email || 'Akun Tersimpan'}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {connectedSpreadsheet
                    ? connectedSpreadsheet.title
                    : googleUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={isWorkspaceBusy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isWorkspaceBusy ? 'animate-spin' : ''}`}
                />
                Aktifkan Sesi Sync
              </button>
              <button
                type="button"
                onClick={handleGoogleSignOut}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-800"
              >
                Keluar / Ganti Akun
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs">
                <p className="truncate font-medium text-slate-900">
                  {googleUser.displayName || 'Google Terhubung'}
                </p>
                <p className="truncate text-[11px] text-slate-500">
                  {connectedSpreadsheet
                    ? connectedSpreadsheet.title
                    : 'Belum memilih spreadsheet'}
                </p>
              </div>
              <button
                type="button"
                onClick={requestPushToSheets}
                disabled={isWorkspaceBusy}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-teal-700 ${
                    isWorkspaceBusy ? 'animate-spin' : ''
                  }`}
                />
                Sinkronkan Sheets
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            className="flex h-full w-64 flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <span className="font-display text-sm font-bold text-slate-900">
                SIMDESA · Desa {profile.namaDesa}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-medium ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 p-4">
              {!googleUser ? (
                <GoogleSignInButton
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleGoogleSignIn(true);
                  }}
                  disabled={isWorkspaceBusy}
                  label="Sign in with Google"
                  className="w-full"
                />
              ) : needsAuth ? (
                <div className="space-y-2">
                  <p className="truncate text-xs font-medium text-slate-900">
                    {googleUser.displayName || googleUser.email || 'Akun Tersimpan'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleGoogleSignIn(false);
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-xs font-medium text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Aktifkan Sesi Sync
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleGoogleSignOut();
                    }}
                    className="w-full text-center text-[11px] text-slate-500"
                  >
                    Keluar / Ganti Akun
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="truncate text-xs font-medium text-slate-900">
                    {googleUser.displayName || 'Google Terhubung'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      requestPushToSheets();
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-teal-700" />
                    Sinkronkan Sheets
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar (compact <=15% height on mobile) */}
        <header className="no-print sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-200 bg-white/95 px-3 py-2.5 sm:px-6 sm:py-3.5 backdrop-blur-xs md:px-8">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden text-slate-400 sm:inline whitespace-nowrap">
                Desa {profile.namaDesa}
              </span>
              <span className="hidden text-slate-300 sm:inline">/</span>
              <h1 className="truncate font-display text-sm sm:text-base font-semibold text-slate-900">
                {activeNavLabel}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <PWAInstallButton compact />
            {!googleUser ? (
              <GoogleSignInButton
                onClick={() => handleGoogleSignIn(true)}
                disabled={isWorkspaceBusy}
                label="Sign in"
              />
            ) : needsAuth ? (
              <button
                type="button"
                onClick={() => handleGoogleSignIn(false)}
                disabled={isWorkspaceBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 hover:bg-teal-100 whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isWorkspaceBusy ? 'animate-spin' : ''}`} />
                Aktifkan Sync
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveTab('penduduk');
                  setAddResidentTrigger((n) => n + 1);
                }}
                className="rounded-lg bg-teal-700 px-3 sm:px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-teal-800 whitespace-nowrap shrink-0"
              >
                + Penduduk
              </button>
            )}
          </div>
        </header>

        {/* Active Viewport */}
        <main className="mx-auto w-full max-w-7xl flex-1 p-3 sm:p-5 md:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              profile={profile}
              residents={residents}
              dusuns={dusuns}
              rws={rws}
              territories={territories}
              letters={letters}
              googleUserEmail={googleUser?.email || null}
              isGoogleConnected={!needsAuth}
              connectedSpreadsheetTitle={connectedSpreadsheet?.title || null}
              lastSyncedAt={lastSyncedAt}
              onUpdateProfile={(next) => {
                setProfile(next);
                showToast(`Identitas Desa ${next.namaDesa} berhasil disimpan.`);
              }}
              onNavigate={setActiveTab}
              onQuickAddResident={() => {
                setActiveTab('penduduk');
                setAddResidentTrigger((n) => n + 1);
              }}
              onGoogleLogin={() => handleGoogleSignIn(!googleUser)}
              onSyncNow={requestPushToSheets}
              onUploadLogoToDrive={requestUploadLogoToDrive}
            />
          )}

          {activeTab === 'penduduk' && (
            <ResidentsView
              residents={residents}
              territories={territories}
              isGoogleConnected={!needsAuth}
              onSaveResident={handleSaveResident}
              onDeleteResident={handleDeleteResident}
              onInstantPrintLetter={(res, type) =>
                handleOpenLetterPreview(res, type)
              }
              onUploadDocToDrive={requestUploadResidentDocToDrive}
              externalAddTrigger={addResidentTrigger}
            />
          )}

          {activeTab === 'surat' && (
            <LettersView
              residents={residents}
              territories={territories}
              profile={profile}
              templates={templates}
              letters={letters}
              onUpdateTemplate={(updated) => {
                setTemplates((prev) =>
                  prev.map((t) => (t.type === updated.type ? updated : t))
                );
                showToast(`Template ${updated.label} diperbarui.`);
              }}
              onOpenLetterPreview={handleOpenLetterPreview}
            />
          )}

          {activeTab === 'kewilayahan' && (
            <TerritoryView
              dusuns={dusuns}
              rws={rws}
              territories={territories}
              residents={residents}
              onSaveDusun={handleSaveDusun}
              onDeleteDusun={handleDeleteDusun}
              onSaveRw={handleSaveRw}
              onDeleteRw={handleDeleteRw}
              onSaveTerritory={handleSaveTerritory}
              onDeleteTerritory={handleDeleteTerritory}
              onOpenOnMap={(territoryId) => {
                setSelectedMapTerritoryId(territoryId);
                setActiveTab('peta');
              }}
            />
          )}

          {activeTab === 'peta' && (
            <VillageMapView
              profile={profile}
              territories={territories}
              residents={residents}
              initialSelectedTerritoryId={selectedMapTerritoryId}
              onUpdateKantorCoords={(lat, lng) => {
                setProfile((prev) => ({
                  ...prev,
                  kantorLat: lat,
                  kantorLng: lng,
                  updatedAt: new Date().toISOString(),
                }));
                showToast(`Koordinat Kantor Desa ${profile.namaDesa} disimpan.`);
              }}
              onUpdateTerritoryCoords={(territoryId, lat, lng) => {
                setTerritories((prev) =>
                  prev.map((t) =>
                    t.id === territoryId
                      ? { ...t, latitude: lat, longitude: lng }
                      : t
                  )
                );
                showToast(
                  lat !== undefined
                    ? 'Titik koordinat wilayah berhasil ditandai di peta.'
                    : 'Pin koordinat wilayah dihapus.'
                );
              }}
            />
          )}

          {activeTab === 'statistik' && (
            <StatisticsView
              profile={profile}
              residents={residents}
              territories={territories}
            />
          )}

          {activeTab === 'sinkronisasi' && (
            <GoogleWorkspaceView
              user={googleUser}
              isGoogleConnected={!needsAuth}
              isBusy={isWorkspaceBusy}
              errorMessage={workspaceError}
              driveSpreadsheets={driveSpreadsheets}
              archivedDriveFiles={archivedDriveFiles}
              connectedSpreadsheet={connectedSpreadsheet}
              tabMapping={tabMapping}
              autoSyncEnabled={autoSyncEnabled}
              syncLogs={syncLogs}
              onSignIn={() => handleGoogleSignIn(!googleUser)}
              onSignOut={handleGoogleSignOut}
              onRefreshDriveList={async (search) => {
                const token = await getAccessToken();
                if (token) await loadDriveFilesAndMeta(token, search);
              }}
              onSelectSpreadsheet={handleSelectSpreadsheet}
              onCreateSpreadsheet={requestCreateSpreadsheet}
              onUpdateTabMapping={setTabMapping}
              onPullFromSheets={() => handlePullFromSheets(false)}
              onRequestPushToSheets={requestPushToSheets}
              onToggleAutoSync={setAutoSyncEnabled}
              onShareSpreadsheetWithEmail={requestShareSpreadsheetWithEmail}
            />
          )}
        </main>
      </div>

      {/* Instant Letter Preview & Print Modal */}
      {letterModalState.open && letterModalState.resident && (
        <LetterPreviewModal
          key={`${letterModalState.resident.id}-${letterModalState.type}-${
            letterModalState.existingRecord?.id || 'new'
          }`}
          open={letterModalState.open}
          resident={letterModalState.resident}
          template={activeTemplate}
          profile={profile}
          territory={territories.find(
            (t) => t.id === letterModalState.resident?.dusunId
          )}
          existingRecord={letterModalState.existingRecord}
          nextSequenceNumber={letters.length + 1}
          initialCustomFields={letterModalState.customFields}
          isGoogleConnected={!needsAuth}
          onClose={() =>
            setLetterModalState((prev) => ({ ...prev, open: false }))
          }
          onSaveRecord={handleSaveLetterRecord}
          onArchiveToDrive={requestArchiveLetterToDrive}
        />
      )}

      {/* Mandatory Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        details={confirmState?.details}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant || 'primary'}
        isLoading={confirmBusy}
        onCancel={() => {
          if (!confirmBusy) setConfirmState(null);
        }}
        onConfirm={async () => {
          if (!confirmState) return;
          setConfirmBusy(true);
          try {
            await confirmState.action();
          } finally {
            setConfirmBusy(false);
            setConfirmState(null);
          }
        }}
      />

      {/* Offline Mode Status Banner */}
      <OfflineIndicator />

      {/* Non-intrusive Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="no-print fixed bottom-5 right-5 z-50 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg"
        >
          {toastMessage}
        </div>
      )}
      </div>
    </div>
  );
}
