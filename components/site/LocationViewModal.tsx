"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  getGoogleMapId,
  hasGoogleMapsApiKey,
  loadGoogleMaps,
  mapsDirectionsUrl,
  type LatLng,
} from "@/lib/google-maps";

type Props = {
  open: boolean;
  onClose: () => void;
  location: LatLng;
  title?: string;
};

export function LocationViewModal({
  open,
  onClose,
  location,
  title = "موقع الزبون",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );

  const [wasOpen, setWasOpen] = useState(open);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const mapsEnabled = hasGoogleMapsApiKey();
  const directionsHref = mapsDirectionsUrl(location.lat, location.lng);
  const locationKey = `${location.lat},${location.lng}`;

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMapReady(false);
      setLoadError(null);
    } else {
      setMapReady(false);
      setLoadError(null);
    }
  }

  const loading = open && mapsEnabled && !mapReady && !loadError;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !mapsEnabled) {
      mapRef.current = null;
      markerRef.current = null;
      return;
    }

    let cancelled = false;

    void loadGoogleMaps()
      .then(({ Map, AdvancedMarkerElement }) => {
        if (cancelled || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: location,
          zoom: 16,
          mapId: getGoogleMapId(),
          disableDefaultUI: true,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        map.setOptions({ clickableIcons: false });

        const marker = new AdvancedMarkerElement({
          map,
          position: location,
          gmpDraggable: false,
          title,
        });

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("تعذّر تحميل الخريطة. يمكنك فتح الاتجاهات مباشرة.");
      });

    return () => {
      cancelled = true;
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- locationKey captures coords
  }, [open, locationKey, mapsEnabled, title]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-view-title"
      dir="rtl"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <h2
          id="location-view-title"
          className="text-base font-bold text-stone-900"
        >
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        {mapsEnabled ? (
          <>
            <div
              ref={mapContainerRef}
              className="absolute inset-0 bg-stone-100"
            />
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
                <p className="text-sm text-stone-600">جاري تحميل الخريطة...</p>
              </div>
            )}
            {loadError && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white p-6">
                <div className="max-w-sm space-y-3 text-center">
                  <MapPin className="mx-auto h-8 w-8 text-amber-600" />
                  <p className="text-sm text-stone-700">{loadError}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-sm text-stone-600">
              الخريطة غير متاحة. استخدم زر الاتجاهات أدناه.
            </p>
          </div>
        )}
      </div>

      <footer className="sticky bottom-0 z-20 flex shrink-0 gap-2 border-t border-stone-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onClose}
        >
          إغلاق
        </Button>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-brand-900 transition hover:bg-brand-600 hover:text-white"
        >
          <ExternalLink className="h-4 w-4" />
          الاتجاهات
        </a>
      </footer>
    </div>
  );
}

/** Screen: map modal or directions link. Print: plain maps URL. */
export function CustomerLocationActions({
  lat,
  lng,
}: {
  lat: number;
  lng: number;
}) {
  const [open, setOpen] = useState(false);
  const mapsEnabled = hasGoogleMapsApiKey();
  const directionsHref = mapsDirectionsUrl(lat, lng);
  const mapsHref = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <>
      {mapsEnabled ? (
        <button
          type="button"
          className="no-print font-medium text-brand-700 hover:underline"
          onClick={() => setOpen(true)}
        >
          عرض موقع الزبون
        </button>
      ) : (
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="no-print font-medium text-brand-700 hover:underline"
        >
          الاتجاهات
        </a>
      )}
      <a
        href={mapsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="print-only mt-0.5 text-xs text-stone-500"
        dir="ltr"
      >
        {mapsHref}
      </a>
      {mapsEnabled && (
        <LocationViewModal
          open={open}
          onClose={() => setOpen(false)}
          location={{ lat, lng }}
          title="موقع الزبون"
        />
      )}
    </>
  );
}
