/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  AdvancedMarkerProps,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  Crosshair,
  Layers,
  MapPin,
  Navigation,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Resident, TerritoryUnit, VillageProfile } from '../types/village';

interface VillageMapViewProps {
  profile: VillageProfile;
  territories: TerritoryUnit[];
  residents: Resident[];
  initialSelectedTerritoryId?: string | null;
  onUpdateKantorCoords: (lat: number, lng: number) => void;
  onUpdateTerritoryCoords: (
    territoryId: string,
    lat: number | undefined,
    lng: number | undefined
  ) => void;
  onViewTerritoryResidents?: (namaDusun: string) => void;
}

const DEFAULT_CENTER: google.maps.LatLngLiteral = {
  lat: -6.9175,
  lng: 107.6191,
};

function getGoogleMapsApiKey(): string {
  const viteKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const procKey =
    typeof process !== 'undefined'
      ? (process.env.GOOGLE_MAPS_API_KEY as string | undefined)
      : undefined;
  return viteKey || procKey || '';
}

function checkQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429') ||
    msg.includes('Quota')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    return true;
  }
  return false;
}

// Wrapper providing native AdvancedMarkerElement ref for InfoWindow anchoring
type AdvancedMarkerInstance = google.maps.marker.AdvancedMarkerElement;

interface AdvancedMarkerWithRefProps extends AdvancedMarkerProps {
  onMarkerClick: (marker: AdvancedMarkerInstance) => void;
}

const AdvancedMarkerWithRef: React.FC<AdvancedMarkerWithRefProps> = ({
  children,
  onMarkerClick,
  ...advancedMarkerProps
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <AdvancedMarker
      ref={markerRef}
      onClick={() => {
        if (marker) {
          onMarkerClick(marker);
        }
      }}
      {...advancedMarkerProps}
    >
      {children}
    </AdvancedMarker>
  );
};

// Modern Places API (New) Autocomplete Hook with Session Token
function useAutocompleteSuggestions(inputString: string) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!placesLib) return;
    const trimmed = inputString.trim();
    if (!trimmed) {
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new AutocompleteSessionToken();
    }

    let cancelled = false;
    setIsLoading(true);

    const timer = setTimeout(() => {
      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        sessionToken: sessionTokenRef.current || undefined,
        includedRegionCodes: ['id'],
        language: 'id',
      })
        .then((res) => {
          if (!cancelled) {
            setSuggestions(res.suggestions || []);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            checkQuotaError(err);
            setSuggestions([]);
            setIsLoading(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [placesLib, inputString]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return { suggestions, isLoading, resetSession };
}

interface ActiveRouteInfo {
  territoryId: string;
  territoryLabel: string;
  distanceText: string;
  durationText: string;
}

const MapWorkspaceContent: React.FC<VillageMapViewProps> = ({
  profile,
  territories,
  residents,
  initialSelectedTerritoryId,
  onUpdateKantorCoords,
  onUpdateTerritoryCoords,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');
  const apiStatus = useApiLoadingStatus();

  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');
  const [pinTarget, setPinTarget] = useState<string>(
    initialSelectedTerritoryId || 'kantor'
  );
  const [pinModeActive, setPinModeActive] = useState(false);

  // Place search state
  const [searchInput, setSearchInput] = useState('');
  const { suggestions, isLoading: isSearching, resetSession } =
    useAutocompleteSuggestions(searchInput);
  const [searchedPlace, setSearchedPlace] = useState<{
    name: string;
    address: string;
    location: google.maps.LatLngLiteral;
  } | null>(null);

  // Selected marker & InfoWindow state
  const [selectedMarkerKey, setSelectedMarkerKey] = useState<string | null>(null);
  const [selectedMarkerEl, setSelectedMarkerEl] =
    useState<AdvancedMarkerInstance | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Routes API state
  const [routeInfo, setRouteInfo] = useState<ActiveRouteInfo | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isComputingRoute, setIsComputingRoute] = useState(false);
  const activePolylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (initialSelectedTerritoryId) {
      setPinTarget(initialSelectedTerritoryId);
      const target = territories.find((t) => t.id === initialSelectedTerritoryId);
      if (map && target?.latitude !== undefined && target?.longitude !== undefined) {
        map.panTo({ lat: target.latitude, lng: target.longitude });
        map.setZoom(16);
      }
    }
  }, [initialSelectedTerritoryId, territories, map]);

  // Resident counts per territory using plain Record (avoiding global Map constructor shadow)
  const countsByTerritory = useMemo(() => {
    const counts: Record<string, { warga: number; kkMap: Record<string, true> }> = {};
    for (const r of residents) {
      if (r.statusKependudukan !== 'Tetap' && r.statusKependudukan !== 'Pendatang') {
        continue;
      }
      if (!counts[r.dusunId]) {
        counts[r.dusunId] = { warga: 0, kkMap: {} };
      }
      counts[r.dusunId].warga += 1;
      counts[r.dusunId].kkMap[r.noKk] = true;
    }
    const result: Record<string, { warga: number; kk: number }> = {};
    for (const key of Object.keys(counts)) {
      result[key] = {
        warga: counts[key].warga,
        kk: Object.keys(counts[key].kkMap).length,
      };
    }
    return result;
  }, [residents]);

  // Sort pinned territories by descending latitude for natural Z-index stacking
  const pinnedTerritories = useMemo(() => {
    return territories
      .filter(
        (t): t is TerritoryUnit & { latitude: number; longitude: number } =>
          typeof t.latitude === 'number' && typeof t.longitude === 'number'
      )
      .sort((a, b) => b.latitude - a.latitude)
      .map((item, idx) => ({ ...item, baseZIndex: idx + 1 }));
  }, [territories]);

  const initialCenter = useMemo<google.maps.LatLngLiteral>(() => {
    if (typeof profile.kantorLat === 'number' && typeof profile.kantorLng === 'number') {
      return { lat: profile.kantorLat, lng: profile.kantorLng };
    }
    if (pinnedTerritories.length > 0) {
      return { lat: pinnedTerritories[0].latitude, lng: pinnedTerritories[0].longitude };
    }
    return DEFAULT_CENTER;
  }, [profile.kantorLat, profile.kantorLng, pinnedTerritories]);

  const clearRoutePolylines = useCallback(() => {
    for (const poly of activePolylinesRef.current) {
      poly.setMap(null);
    }
    activePolylinesRef.current = [];
    setRouteInfo(null);
    setRouteError(null);
  }, []);

  useEffect(() => {
    return () => {
      for (const poly of activePolylinesRef.current) {
        poly.setMap(null);
      }
    };
  }, []);

  const handleSelectSuggestion = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!placesLib || !suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });

      if (place.location) {
        const loc = {
          lat: place.location.lat(),
          lng: place.location.lng(),
        };
        setSearchedPlace({
          name: place.displayName || suggestion.placePrediction.text.text,
          address: place.formattedAddress || '',
          location: loc,
        });
        if (map) {
          if (place.viewport) {
            map.fitBounds(place.viewport);
          } else {
            map.panTo(loc);
            map.setZoom(16);
          }
        }
      }
      setSearchInput('');
      resetSession();
    } catch (err) {
      checkQuotaError(err);
    }
  };

  const applyCoordinatesToTarget = (lat: number, lng: number) => {
    if (pinTarget === 'kantor') {
      onUpdateKantorCoords(lat, lng);
    } else {
      onUpdateTerritoryCoords(pinTarget, lat, lng);
    }
    setPinModeActive(false);
  };

  const handleComputeRouteFromKantor = async (
    territory: TerritoryUnit & { latitude: number; longitude: number }
  ) => {
    if (
      typeof profile.kantorLat !== 'number' ||
      typeof profile.kantorLng !== 'number'
    ) {
      setRouteError(
        'Tandai lokasi Kantor Desa terlebih dahulu untuk menghitung rute wilayah.'
      );
      return;
    }
    if (!routesLib || !map) {
      setRouteError('Layanan rute sedang dimuat. Silakan coba sesaat lagi.');
      return;
    }

    clearRoutePolylines();
    setIsComputingRoute(true);
    setRouteError(null);

    try {
      const request: google.maps.routes.ComputeRoutesRequest = {
        origin: { lat: profile.kantorLat, lng: profile.kantorLng },
        destination: { lat: territory.latitude, lng: territory.longitude },
        travelMode: routesLib.TravelMode.DRIVING,
        fields: ['durationMillis', 'distanceMeters', 'path', 'viewport'],
      };

      const response = await routesLib.Route.computeRoutes(request);
      const route = response.routes?.[0];
      if (!route) {
        setRouteError('Rute tidak ditemukan antara Kantor Desa dan wilayah ini.');
        return;
      }

      const polylines = route.createPolylines({
        polylineOptions: {
          strokeColor: '#0F766E',
          strokeOpacity: 0.9,
          strokeWeight: 5,
        },
      });
      for (const poly of polylines) {
        poly.setMap(map);
      }
      activePolylinesRef.current = polylines;

      if (route.viewport) {
        map.fitBounds(route.viewport);
      }

      const meters = route.distanceMeters || 0;
      const distanceText =
        meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${meters} m`;
      const minutes = Math.max(
        1,
        Math.round((route.durationMillis || 0) / 60000)
      );

      setRouteInfo({
        territoryId: territory.id,
        territoryLabel: `${territory.namaDusun} (RW ${territory.rw} / RT ${territory.rt})`,
        distanceText,
        durationText: `${minutes} menit`,
      });
    } catch (err) {
      if (!checkQuotaError(err)) {
        setRouteError(
          'Gagal menghitung rute. Pastikan lokasi terhubung ke jaringan jalan.'
        );
      }
    } finally {
      setIsComputingRoute(false);
    }
  };

  const selectedTerritoryForInfo = useMemo(() => {
    if (!selectedMarkerKey || !selectedMarkerKey.startsWith('wil:')) return null;
    const id = selectedMarkerKey.slice(4);
    return pinnedTerritories.find((t) => t.id === id) || null;
  }, [selectedMarkerKey, pinnedTerritories]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Control Panel */}
      <aside className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Peta Wilayah & Lokasi Desa
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Cari alamat nyata via Google Places atau klik peta untuk menandai titik
            Kantor Desa dan wilayah Dusun / RT / RW.
          </p>
        </div>

        {/* Places API (New) Autocomplete Search */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-700">
            Cari Lokasi / Kantor Desa / Wilayah
          </label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Ketik nama desa, kecamatan, atau jalan..."
              className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            />
          </div>
          {isSearching && (
            <p className="mt-1 text-[11px] text-slate-500">Mencari lokasi...</p>
          )}
          {suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 z-20 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {suggestions.map((sug, idx) => (
                <li key={sug.placePrediction?.placeId || idx}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(sug)}
                    className="w-full px-3 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
                  >
                    {sug.placePrediction?.text.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Searched Place Result Action */}
        {searchedPlace && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{searchedPlace.name}</p>
                <p className="mt-0.5 text-[11px] text-slate-600">
                  {searchedPlace.address}
                </p>
                <p className="mt-1 font-mono-tabular text-[11px] text-slate-500">
                  {searchedPlace.location.lat.toFixed(5)},{' '}
                  {searchedPlace.location.lng.toFixed(5)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSearchedPlace(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() =>
                applyCoordinatesToTarget(
                  searchedPlace.location.lat,
                  searchedPlace.location.lng
                )
              }
              className="mt-2.5 w-full rounded-md bg-teal-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-800"
            >
              Tetapkan ke Target Dipilih
            </button>
          </div>
        )}

        {/* Pin Target Selector */}
        <div className="space-y-3 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Target Penandaan Koordinat
            </label>
            <select
              value={pinTarget}
              onChange={(e) => setPinTarget(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
            >
              <option value="kantor">
                Kantor Desa {profile.namaDesa}
                {typeof profile.kantorLat === 'number' ? ' (Sudah Ditandai)' : ''}
              </option>
              {territories.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.namaDusun} — RW {t.rw} / RT {t.rt}
                  {typeof t.latitude === 'number' ? ' (Sudah Ditandai)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setPinModeActive((prev) => !prev)}
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
              pinModeActive
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            <Crosshair className="h-3.5 w-3.5" />
            {pinModeActive
              ? 'Klik Lokasi pada Peta Sekarang (Batal)'
              : 'Tandai Lokasi dengan Klik Peta'}
          </button>
        </div>

        {/* Active Route Result Card */}
        {routeInfo && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">
                  Rute Kantor Desa → {routeInfo.territoryLabel}
                </p>
                <p className="mt-1 font-mono-tabular text-slate-700">
                  Jarak: <strong>{routeInfo.distanceText}</strong> · Estimasi:{' '}
                  <strong>{routeInfo.durationText}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={clearRoutePolylines}
                className="text-slate-400 hover:text-slate-700"
                title="Hapus rute"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {routeError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            {routeError}
          </div>
        )}

        {/* List of Pinned / Unpinned Territories */}
        <div className="flex-1 overflow-y-auto border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">
              Titik Wilayah ({pinnedTerritories.length}/{territories.length})
            </span>
          </div>
          <ul className="mt-2.5 divide-y divide-slate-100 text-xs">
            {territories.map((t) => {
              const hasCoords =
                typeof t.latitude === 'number' && typeof t.longitude === 'number';
              const stat = countsByTerritory[t.id] || { warga: 0, kk: 0 };
              return (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setPinTarget(t.id);
                      if (hasCoords && map) {
                        map.panTo({ lat: t.latitude!, lng: t.longitude! });
                        map.setZoom(16);
                      }
                    }}
                    className="min-w-0 flex-1 text-left hover:text-teal-700"
                  >
                    <p className="truncate font-medium text-slate-900">
                      {t.namaDusun} · RT {t.rt}/RW {t.rw}
                    </p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {stat.warga} warga · {stat.kk} KK ·{' '}
                      {hasCoords ? (
                        <span className="font-mono-tabular text-teal-700">
                          {t.latitude!.toFixed(4)}, {t.longitude!.toFixed(4)}
                        </span>
                      ) : (
                        'Belum ditandai'
                      )}
                    </p>
                  </button>
                  {hasCoords && (
                    <button
                      type="button"
                      onClick={() => onUpdateTerritoryCoords(t.id, undefined, undefined)}
                      title="Hapus pin koordinat"
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* Right Interactive Google Map Viewport */}
      <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <MapPin className="h-4 w-4 text-teal-700" />
            <span>
              {pinModeActive
                ? 'Mode Penandaan Aktif: Klik peta untuk menyimpan koordinat'
                : `Peta Geospasial Desa ${profile.namaDesa}`}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-slate-400" />
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
              {(
                [
                  { id: 'roadmap', label: 'Peta' },
                  { id: 'satellite', label: 'Satelit' },
                  { id: 'hybrid', label: 'Hibrida' },
                  { id: 'terrain', label: 'Medan' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setMapTypeId(mode.id)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    mapTypeId === mode.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Explicit Height Map Container (CF2) */}
        <div className="relative h-[380px] w-full sm:h-[520px] lg:h-[620px]">
          {(apiStatus === APILoadingStatus.FAILED ||
            apiStatus === APILoadingStatus.AUTH_FAILURE) && (
            <div className="flex h-full flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                Peta Google Maps gagal dimuat
              </p>
              <p className="mt-1 max-w-md text-xs text-slate-600">
                Periksa koneksi internet atau konfigurasi kunci API Google Maps
                Platform pada pengaturan aplikasi.
              </p>
            </div>
          )}

          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={initialCenter}
            defaultZoom={13}
            mapTypeId={mapTypeId}
            gestureHandling="greedy"
            clickableIcons={false}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
            onClick={(ev) => {
              if (pinModeActive && ev.detail.latLng) {
                applyCoordinatesToTarget(
                  ev.detail.latLng.lat,
                  ev.detail.latLng.lng
                );
              } else {
                setSelectedMarkerKey(null);
                setSelectedMarkerEl(null);
              }
            }}
          >
            {/* Kantor Desa Marker */}
            {typeof profile.kantorLat === 'number' &&
              typeof profile.kantorLng === 'number' && (
                <AdvancedMarkerWithRef
                  position={{ lat: profile.kantorLat, lng: profile.kantorLng }}
                  zIndex={1000}
                  title={`Kantor Desa ${profile.namaDesa}`}
                  onMarkerClick={(marker) => {
                    setSelectedMarkerKey('kantor');
                    setSelectedMarkerEl(marker);
                  }}
                >
                  <Pin
                    background="#0F766E"
                    borderColor="#134E4A"
                    glyphColor="#FFFFFF"
                    glyphText="DS"
                  />
                </AdvancedMarkerWithRef>
              )}

            {/* Pinned Territory Markers (sorted by latitude) */}
            {pinnedTerritories.map((t) => {
              const key = `wil:${t.id}`;
              const isSelected = selectedMarkerKey === key;
              const isHovered = hoverId === t.id;
              const zIndex = isSelected
                ? 999
                : isHovered
                ? 998
                : t.baseZIndex;

              return (
                <AdvancedMarkerWithRef
                  key={t.id}
                  position={{ lat: t.latitude, lng: t.longitude }}
                  zIndex={zIndex}
                  title={`${t.namaDusun} RW ${t.rw} / RT ${t.rt}`}
                  onMouseEnter={() => setHoverId(t.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onMarkerClick={(marker) => {
                    setSelectedMarkerKey(key);
                    setSelectedMarkerEl(marker);
                  }}
                >
                  <Pin
                    background={isSelected ? '#B45309' : '#D97706'}
                    borderColor="#78350F"
                    glyphColor="#FFFFFF"
                    glyphText={t.rt.slice(-2)}
                  />
                </AdvancedMarkerWithRef>
              );
            })}

            {/* Searched Place Temporary Marker */}
            {searchedPlace && (
              <AdvancedMarker position={searchedPlace.location} zIndex={950}>
                <Pin
                  background="#1D4ED8"
                  borderColor="#1E3A8A"
                  glyphColor="#FFFFFF"
                />
              </AdvancedMarker>
            )}

            {/* Anchored InfoWindow for Kantor Desa */}
            {selectedMarkerKey === 'kantor' &&
              selectedMarkerEl &&
              typeof profile.kantorLat === 'number' && (
                <InfoWindow
                  anchor={selectedMarkerEl}
                  pixelOffset={[0, -4]}
                  onCloseClick={() => {
                    setSelectedMarkerKey(null);
                    setSelectedMarkerEl(null);
                  }}
                >
                  <div className="max-w-xs p-1 text-xs text-slate-900">
                    <p className="font-bold">Kantor Desa {profile.namaDesa}</p>
                    <p className="mt-0.5 text-slate-600">{profile.alamatKantor}</p>
                    <p className="mt-1 text-slate-700">
                      Kepala Desa: <strong>{profile.namaKepalaDesa}</strong>
                    </p>
                  </div>
                </InfoWindow>
              )}

            {/* Anchored InfoWindow for Territory Unit */}
            {selectedTerritoryForInfo && selectedMarkerEl && (
              <InfoWindow
                anchor={selectedMarkerEl}
                pixelOffset={[0, -4]}
                onCloseClick={() => {
                  setSelectedMarkerKey(null);
                  setSelectedMarkerEl(null);
                }}
              >
                <div className="max-w-xs space-y-2 p-1 text-xs text-slate-900">
                  <div>
                    <p className="font-bold">
                      {selectedTerritoryForInfo.namaDusun} · RW{' '}
                      {selectedTerritoryForInfo.rw} / RT{' '}
                      {selectedTerritoryForInfo.rt}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      {selectedTerritoryForInfo.jabatan}:{' '}
                      {selectedTerritoryForInfo.kepalaWilayah}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono-tabular text-[11px] text-slate-700">
                    <span>
                      Warga:{' '}
                      <strong>
                        {countsByTerritory[selectedTerritoryForInfo.id]?.warga || 0}
                      </strong>
                    </span>
                    <span>
                      KK:{' '}
                      <strong>
                        {countsByTerritory[selectedTerritoryForInfo.id]?.kk || 0}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isComputingRoute}
                    onClick={() =>
                      handleComputeRouteFromKantor(selectedTerritoryForInfo)
                    }
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-teal-700 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    <Navigation className="h-3 w-3" />
                    {isComputingRoute
                      ? 'Menghitung...'
                      : 'Rute dari Kantor Desa'}
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>
      </section>
    </div>
  );
};

export const VillageMapView: React.FC<VillageMapViewProps> = (props) => {
  const apiKey = getGoogleMapsApiKey();

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <MapPin className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-slate-900">
          Kunci API Google Maps Belum Tersedia
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-600">
          Atur variabel lingkungan <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code>{' '}
          atau <code className="font-mono">GOOGLE_MAPS_API_KEY</code> untuk mengaktifkan
          peta interaktif wilayah desa.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={apiKey}
      language="id"
      region="ID"
      libraries={['marker', 'places', 'routes']}
    >
      <MapWorkspaceContent {...props} />
    </APIProvider>
  );
};
