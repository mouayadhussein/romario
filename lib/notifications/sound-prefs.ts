const SOUND_KEY = "debbo:sound-alerts";
const MUTE_KEY = "debbo:sound-muted";

export function isSoundEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if (window.localStorage.getItem(MUTE_KEY) === "1") return false;
    return window.localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSoundMuted(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SOUND_KEY, enabled ? "1" : "0");
    if (enabled) window.localStorage.setItem(MUTE_KEY, "0");
  } catch {
    /* ignore */
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Play local alert twice. Returns false if autoplay blocked. */
export async function playAlertSound(): Promise<boolean> {
  if (!isSoundEnabled() || isSoundMuted()) return true;
  try {
    const audio = new Audio("/sounds/alert.wav");
    audio.volume = 0.45;
    await audio.play();
    await new Promise((r) => setTimeout(r, 220));
    const audio2 = new Audio("/sounds/alert.wav");
    audio2.volume = 0.45;
    await audio2.play();
    return true;
  } catch {
    return false;
  }
}

export function vibrateShort(): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([80, 40, 80]);
    }
  } catch {
    /* ignore */
  }
}
