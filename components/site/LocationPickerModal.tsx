"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import {
  DAMASCUS_CENTER,
  DEFAULT_MAP_ZOOM,
  geolocationErrorMessage,
  getGoogleMapId,
  loadGoogleMaps,
  readMarkerLatLng,
  roundLatLng,
  type LatLng,
} from "@/lib/google-maps";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (location: LatLng) => void;
  initialLocation?: LatLng | null;
  title?: string;
};

export function LocationPickerModal({
  open,
  onClose,
  onConfirm,
  initialLocation = null,
  title = "اختر موقع التوصيل",
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null
  );
  const pendingPosRef = useRef<LatLng | null>(null);

  const startPoint = initialLocation ?? { ...DAMASCUS_CENTER };

  const [wasOpen, setWasOpen] = useState(open);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [draft, setDraft] = useState<LatLng | null>(
    open ? startPoint : null
  );

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMapReady(false);
      setLoadError(null);
      setGeoError(null);
      setDraft(startPoint);
    } else {
      setDraft(null);
      setMapReady(false);
      setLoadError(null);
      setGeoError(null);
    }
  }

  const loading = open && !mapReady && !loadError;
  const initialKey = initialLocation
    ? `${initialLocation.lat},${initialLocation.lng}`
    : "default";

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
    if (!open) {
      mapRef.current = null;
      markerRef.current = null;
      pendingPosRef.current = null;
      return;
    }

    const start = initialLocation ?? { ...DAMASCUS_CENTER };
    pendingPosRef.current = start;

    let cancelled = false;
    let clickListener: google.maps.MapsEventListener | null = null;
    let dragListener: google.maps.MapsEventListener | null = null;

    void loadGoogleMaps()
      .then(({ Map, AdvancedMarkerElement }) => {
        if (cancelled || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: start,
          zoom: initialLocation ? 16 : DEFAULT_MAP_ZOOM,
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
          position: start,
          gmpDraggable: true,
          title: "موقع التوصيل",
        });

        const movePin = (latLng: google.maps.LatLng) => {
          const next = { lat: latLng.lat(), lng: latLng.lng() };
          marker.position = next;
          pendingPosRef.current = next;
          setDraft(next);
        };

        const syncFromMarker = () => {
          const next = readMarkerLatLng(marker.position);
          if (!next) return;
          pendingPosRef.current = next;
          setDraft(next);
        };

        clickListener = map.addListener(
          "click",
          (e: google.maps.MapMouseEvent) => {
            // Prevent any place/POI default behavior; always move the pin.
            e.stop?.();
            if (!e.latLng) return;
            movePin(e.latLng);
          }
        );

        dragListener = marker.addListener("dragend", syncFromMarker);

        mapRef.current = map;
        markerRef.current = marker;
        setMapReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(
          "تعذّر تحميل الخريطة. تحقق من مفتاح Google Maps أو الاتصال بالإنترنت. يمكنك المتابعة بدون تحديد موقع."
        );
      });

    return () => {
      cancelled = true;
      clickListener?.remove();
      dragListener?.remove();
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
      mapRef.current = null;
    };
    // initialKey captures lat/lng; avoid remounting on object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, initialKey]);

  function useMyLocation() {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("متصفحك لا يدعم تحديد الموقع.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = roundLatLng({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        pendingPosRef.current = next;
        setDraft(next);
        if (markerRef.current) markerRef.current.position = next;
        if (mapRef.current) {
          mapRef.current.panTo(next);
          mapRef.current.setZoom(16);
        }
        setLocating(false);
      },
      (err) => {
        setGeoError(geolocationErrorMessage(err));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  function handleConfirm() {
    const raw = pendingPosRef.current ?? draft;
    if (!raw) return;
    onConfirm(roundLatLng(raw));
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-picker-title"
      dir="rtl"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
        <div>
          <h2
            id="location-picker-title"
            className="text-base font-bold text-stone-900"
          >
            {title}
          </h2>
          <p className="text-xs text-stone-500">
            اسحب الدبوس أو اضغط على الخريطة لتحديد الموقع
          </p>
        </div>
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
        <div ref={mapContainerRef} className="absolute inset-0 bg-stone-100" />

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
              <Button type="button" variant="secondary" onClick={onClose}>
                المتابعة بدون موقع
              </Button>
            </div>
          </div>
        )}

        {!loadError && (
          <div className="absolute start-3 top-3 z-10">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={locating}
              disabled={loading || locating}
              onClick={useMyLocation}
              className="shadow-md"
            >
              <Crosshair className="h-4 w-4" />
              استخدم موقعي الحالي
            </Button>
          </div>
        )}
      </div>

      {(geoError || draft) && !loadError && (
        <div className="shrink-0 space-y-1 border-t border-stone-100 px-4 py-2">
          {geoError && <p className="text-xs text-red-600">{geoError}</p>}
          {draft && (
            <p className="text-xs text-stone-500" dir="ltr">
              {draft.lat.toFixed(6)}, {draft.lng.toFixed(6)}
            </p>
          )}
        </div>
      )}

      <footer className="sticky bottom-0 z-20 flex shrink-0 gap-2 border-t border-stone-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onClose}
        >
          إلغاء
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={!!loadError || !draft}
          onClick={handleConfirm}
        >
          تأكيد الموقع
        </Button>
      </footer>
    </div>
  );
}
