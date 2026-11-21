import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        title="Pasang aplikasi SIMDESA di HP atau komputer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 transition-colors hover:bg-teal-100 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span>{compact ? 'Pasang App' : 'Pasang di HP / PC'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5 text-teal-700" />
          <span>{compact ? 'Pasang iOS' : 'Pasang di iPhone'}</span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  Pasang SIMDESA di iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="font-mono-tabular font-semibold text-teal-700">1.</span>
                  <span>
                    Ketuk ikon <strong className="inline-flex items-center gap-1 text-slate-800"><Share className="h-3 w-3" /> Bagikan (Share)</strong> pada bilah bawah Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-tabular font-semibold text-teal-700">2.</span>
                  <span>
                    Gulir ke bawah lalu pilih <strong className="text-slate-800">Tambah ke Layar Utama (Add to Home Screen)</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-tabular font-semibold text-teal-700">3.</span>
                  <span>Ketuk <strong className="text-slate-800">Tambah (Add)</strong> untuk membuka seperti aplikasi.</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
