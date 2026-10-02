import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

export const DAMASCUS_CENTER = { lat: 33.5138, lng: 36.2765 } as const;
export const DEFAULT_MAP_ZOOM = 12;

export type LatLng = { lat: number; lng: number };

export function hasGoogleMapsApiKey(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
}

export function getGoogleMapId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAP_ID?.trim() || "DEMO_MAP_ID";
}

export function roundCoord(value: number): number {
  return Number(value.toFixed(6));
}

export function roundLatLng(point: LatLng): LatLng {
  return { lat: roundCoord(point.lat), lng: roundCoord(point.lng) };
}

export function mapsQueryUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

type MapsLibs = {
  Map: typeof google.maps.Map;
  AdvancedMarkerElement: typeof google.maps.marker.AdvancedMarkerElement;
};

let mapsPromise: Promise<MapsLibs> | null = null;

/** Load Maps JS once (first call only). Safe to call from modal open. */
export function loadGoogleMaps(): Promise<MapsLibs> {
  if (mapsPromise) return mapsPromise;

  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (!key) {
    return Promise.reject(new Error("MISSING_API_KEY"));
  }

  mapsPromise = (async () => {
    setOptions({
      key,
      v: "weekly",
      language: "ar",
    });
    const mapsLib = await importLibrary("maps");
    const markerLib = await importLibrary("marker");
    return {
      Map: mapsLib.Map,
      AdvancedMarkerElement: markerLib.AdvancedMarkerElement,
    };
  })().catch((err) => {
    mapsPromise = null;
    throw err;
  });

  return mapsPromise;
}

export function readMarkerLatLng(
  position:
    | google.maps.LatLngAltitude
    | google.maps.LatLngAltitudeLiteral
    | google.maps.LatLng
    | google.maps.LatLngLiteral
    | null
    | undefined
): LatLng | null {
  if (!position) return null;

  if (typeof (position as google.maps.LatLng).lat === "function") {
    const p = position as google.maps.LatLng;
    return { lat: p.lat(), lng: p.lng() };
  }

  const literal = position as google.maps.LatLngLiteral;
  if (typeof literal.lat === "number" && typeof literal.lng === "number") {
    return { lat: literal.lat, lng: literal.lng };
  }

  return null;
}

export function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "تم رفض إذن الموقع. لتفعيله: افتح إعدادات المتصفح لهذا الموقع واسمح بالوصول إلى الموقع، ثم أعد المحاولة.";
    case error.POSITION_UNAVAILABLE:
      return "تعذّر تحديد موقعك حالياً. تأكد من تفعيل خدمة الموقع في الجهاز ثم أعد المحاولة.";
    case error.TIMEOUT:
      return "انتهت مهلة تحديد الموقع. حاول مرة أخرى في مكان بإشارة أفضل.";
    default:
      return "حدث خطأ أثناء تحديد الموقع. حاول مرة أخرى.";
  }
}
