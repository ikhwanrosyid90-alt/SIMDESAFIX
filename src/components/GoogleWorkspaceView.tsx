import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Smartphone,
} from 'lucide-react';
import {
  DriveFileItem,
  SheetTabMapping,
  SyncLogEntry,
} from '../types/village';
import { extractSpreadsheetId, SpreadsheetMetadata } from '../services/googleSheetsSync';
import { GoogleSignInButton } from './GoogleSignInButton';
import { PWAInstallButton } from './PWAInstallButton';

interface GoogleWorkspaceViewProps {
  user: User | null;
  isGoogleConnected: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  driveSpreadsheets: DriveFileItem[];
  archivedDriveFiles: DriveFileItem[];
  connectedSpreadsheet: SpreadsheetMetadata | null;
  tabMapping: SheetTabMapping;
  autoSyncEnabled: boolean;
  syncLogs: SyncLogEntry[];
  onSignIn: () => void;
  onSignOut: () => void;
  onRefreshDriveList: (search?: string) => void;
  onSelectSpreadsheet: (spreadsheetId: string) => void;
  onCreateSpreadsheet: () => void;
  onUpdateTabMapping: (next: SheetTabMapping) => void;
  onPullFromSheets: () => void;
  onRequestPushToSheets: () => void;
  onToggleAutoSync: (enabled: boolean) => void;
  onShareSpreadsheetWithEmail?: (email: string) => void;
}

export const GoogleWorkspaceView: React.FC<GoogleWorkspaceViewProps> = ({
  user,
  isGoogleConnected,
  isBusy,
  errorMessage,
  driveSpreadsheets,
  archivedDriveFiles,
  connectedSpreadsheet,
  tabMapping,
  autoSyncEnabled,
  syncLogs,
  onSignIn,
  onSignOut,
  onRefreshDriveList,
  onSelectSpreadsheet,
  onCreateSpreadsheet,
  onUpdateTabMapping,
  onPullFromSheets,
  onRequestPushToSheets,
  onToggleAutoSync,
  onShareSpreadsheetWithEmail,
}) => {
  const [driveSearch, setDriveSearch] = useState('');
  const [manualSheetInput, setManualSheetInput] = useState('');
  const [manualSheetError, setManualSheetError] = useState<string | null>(null);
  const [shareEmail, setShareEmail] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleManualSheetConnect = (e: React.FormEvent) => {
    e.preventDefault();
    setManualSheetError(null);
    const extracted = extractSpreadsheetId(manualSheetInput);
    if (!extracted) {
      setManualSheetError(
        'Link atau ID Google Sheets tidak valid. Tempel link lengkap Google Sheets atau ID spreadsheet.'
      );
      return;
    }
    onSelectSpreadsheet(extracted);
    setManualSheetInput('');
  };

  const handleCopySheetLink = async () => {
    if (!connectedSpreadsheet?.spreadsheetUrl) return;
    try {
      await navigator.clipboard.writeText(connectedSpreadsheet.spreadsheetUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  if (!isGoogleConnected) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-slate-900">
          Hubungkan Google Sheets & Google Drive
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Masuk dengan akun Google perangkat desa untuk membuat spreadsheet baru,
          menghubungkan spreadsheet yang sudah ada di Google Drive, dan menyinkronkan
          data penduduk secara real-time.
        </p>

        {errorMessage && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <GoogleSignInButton
            onClick={onSignIn}
            disabled={isBusy}
            label={isBusy ? 'Menghubungkan...' : 'Sign in with Google'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connected Account Header */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3.5">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Akun Google'}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-700 text-sm font-semibold text-white">
              {(user?.displayName || user?.email || 'G')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {user?.displayName || 'Perangkat Desa'}
            </p>
            <p className="text-xs text-slate-500">
              {user?.email} · Google Sheets & Drive Aktif
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onCreateSpreadsheet}
            disabled={isBusy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Buat Spreadsheet Desa Baru
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Keluar Akun
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 text-xs font-medium text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Browse & Select Spreadsheet from Google Drive */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Pilih Spreadsheet dari Google Drive
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Pilih file Google Sheets yang ingin dijadikan basis data real-time.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRefreshDriveList(driveSearch)}
              disabled={isBusy}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              Muat Ulang
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onRefreshDriveList(driveSearch);
            }}
            className="mt-4 flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={driveSearch}
                onChange={(e) => setDriveSearch(e.target.value)}
                placeholder="Cari nama spreadsheet di Google Drive..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cari
            </button>
          </form>

          <div className="mt-4 max-h-64 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
            {driveSpreadsheets.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Belum ada spreadsheet yang ditemukan. Klik{' '}
                <strong>Buat Spreadsheet Desa Baru</strong> atau tempel Link Google Sheets bersama di bawah.
              </div>
            ) : (
              driveSpreadsheets.map((file) => {
                const isActive = connectedSpreadsheet?.spreadsheetId === file.id;
                return (
                  <div
                    key={file.id}
                    className={`flex items-center justify-between gap-3 px-4 py-3 text-xs ${
                      isActive ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{file.name}</p>
                      <p className="mt-0.5 font-mono-tabular text-[11px] text-slate-500">
                        Diubah:{' '}
                        {file.modifiedTime
                          ? new Date(file.modifiedTime).toLocaleDateString('id-ID')
                          : '-'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectSpreadsheet(file.id)}
                      disabled={isBusy}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {isActive ? 'Terhubung' : 'Hubungkan'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Connect Shared Spreadsheet directly via URL / ID */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Link2 className="h-3.5 w-3.5 text-teal-700" />
              <span>Hubungkan via Link / ID Google Sheets (Untuk Akun Google Lain)</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Jika perangkat desa lain membagikan file Google Sheets ke akun Anda, tempel link atau ID spreadsheet di sini untuk langsung terhubung ke database yang sama.
            </p>
            <form onSubmit={handleManualSheetConnect} className="mt-2.5 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={manualSheetInput}
                onChange={(e) => setManualSheetInput(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isBusy || !manualSheetInput.trim()}
                className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                Hubungkan Link
              </button>
            </form>
            {manualSheetError && (
              <p className="mt-1.5 text-[11px] font-medium text-red-600">
                {manualSheetError}
              </p>
            )}
          </div>
        </section>

        {/* Right: Active Spreadsheet Mapping & Bidirectional Sync Controls */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Kontrol Sinkronisasi Real-Time
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {connectedSpreadsheet
                  ? `Spreadsheet aktif: ${connectedSpreadsheet.title}`
                  : 'Pilih atau buat spreadsheet terlebih dahulu di sebelah kiri.'}
              </p>
            </div>
            {connectedSpreadsheet?.spreadsheetUrl && (
              <a
                href={connectedSpreadsheet.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline whitespace-nowrap shrink-0"
              >
                Buka Sheets
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {connectedSpreadsheet ? (
            <div className="mt-5 space-y-5">
              {/* Dynamic Sheet Tab Mapping */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tab Data Penduduk
                  </label>
                  <select
                    value={tabMapping.penduduk}
                    onChange={(e) =>
                      onUpdateTabMapping({ ...tabMapping, penduduk: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    {connectedSpreadsheet.sheetTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tab Kewilayahan
                  </label>
                  <select
                    value={tabMapping.kewilayahan}
                    onChange={(e) =>
                      onUpdateTabMapping({
                        ...tabMapping,
                        kewilayahan: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">(Tidak Dipetakan)</option>
                    {connectedSpreadsheet.sheetTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tab Arsip Surat
                  </label>
                  <select
                    value={tabMapping.arsipSurat}
                    onChange={(e) =>
                      onUpdateTabMapping({
                        ...tabMapping,
                        arsipSurat: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">(Tidak Dipetakan)</option>
                    {connectedSpreadsheet.sheetTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    Tab Profil Desa
                  </label>
                  <select
                    value={tabMapping.profilDesa}
                    onChange={(e) =>
                      onUpdateTabMapping({
                        ...tabMapping,
                        profilDesa: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                  >
                    <option value="">(Tidak Dipetakan)</option>
                    {connectedSpreadsheet.sheetTitles.map((title) => (
                      <option key={title} value={title}>
                        {title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sync Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onPullFromSheets}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5 text-teal-700" />
                  Tarik Pembaruan dari Sheets
                </button>
                <button
                  type="button"
                  onClick={onRequestPushToSheets}
                  disabled={isBusy}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Kirim & Sinkronkan ke Sheets
                </button>
              </div>

              {/* Real-time Read Polling Toggle */}
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs cursor-pointer">
                <div>
                  <p className="font-medium text-slate-900">
                    Pantau Perubahan Google Sheets Otomatis (Setiap 20 Detik)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Memperbarui tampilan HP/PC otomatis bila ada perangkat desa lain yang
                    mengirim pembaruan ke Google Sheets.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={autoSyncEnabled}
                  onChange={(e) => onToggleAutoSync(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-teal-700"
                />
              </label>

              {/* Cross-Account Sharing & Multi-Device Access */}
              <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-teal-900">
                    <Share2 className="h-3.5 w-3.5" />
                    <span>Bagikan Database ke Akun Google & HP Lain</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopySheetLink}
                    className="inline-flex items-center gap-1 rounded-md border border-teal-300 bg-white px-2.5 py-1 text-[11px] font-medium text-teal-800 hover:bg-teal-50"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-700" />
                        Link Disalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Salin Link Sheets
                      </>
                    )}
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Agar perangkat desa lain (dengan akun Google berbeda) dapat membaca & memperbarui database yang sama, berikan akses <strong>Editor</strong> ke email Google mereka lalu tempel link di atas pada menu Sync di perangkat mereka.
                </p>

                {onShareSpreadsheetWithEmail && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!shareEmail.trim()) return;
                      onShareSpreadsheetWithEmail(shareEmail.trim());
                      setShareEmail('');
                    }}
                    className="flex flex-col sm:flex-row gap-2"
                  >
                    <input
                      type="email"
                      required
                      value={shareEmail}
                      onChange={(e) => setShareEmail(e.target.value)}
                      placeholder="Email Google perangkat desa (contoh: sekdes@gmail.com)"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={isBusy || !shareEmail.trim()}
                      className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Beri Akses Editor
                    </button>
                  </form>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-teal-200/70 pt-2.5 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-teal-700" />
                    Buka dari browser HP & pasang ke layar utama untuk akses cepat:
                  </span>
                  <PWAInstallButton compact />
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Belum ada spreadsheet yang dipilih. Pilih salah satu file Google Sheets di
              daftar sebelah kiri, tempel Link Google Sheets bersama, atau buat spreadsheet baru.
            </div>
          )}
        </section>
      </div>

      {/* Bottom: Google Drive Archives & Sync Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-teal-700" />
            <h4 className="text-sm font-semibold text-slate-900">
              Arsip Surat & Logo di Google Drive
            </h4>
          </div>
          {archivedDriveFiles.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Belum ada surat atau logo yang diarsipkan ke Google Drive. Gunakan tombol
              "Simpan ke Drive" pada pratinjau surat atau editor logo desa.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {archivedDriveFiles.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{item.name}</p>
                    <p className="font-mono-tabular text-[11px] text-slate-500">
                      {item.modifiedTime
                        ? new Date(item.modifiedTime).toLocaleString('id-ID')
                        : '-'}
                    </p>
                  </div>
                  {item.webViewLink && (
                    <a
                      href={item.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-teal-700 hover:underline shrink-0"
                    >
                      Buka
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
          <h4 className="text-sm font-semibold text-slate-900">
            Riwayat Sinkronisasi
          </h4>
          {syncLogs.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500">
              Belum ada aktivitas sinkronisasi pada sesi ini.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 text-xs">
              {syncLogs.slice(0, 8).map((log) => (
                <li key={log.id} className="flex items-start justify-between gap-3 py-2.5">
                  <div>
                    <p
                      className={`font-medium ${
                        log.status === 'success' ? 'text-slate-900' : 'text-red-700'
                      }`}
                    >
                      {log.summary}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono-tabular text-[11px] text-slate-500">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
