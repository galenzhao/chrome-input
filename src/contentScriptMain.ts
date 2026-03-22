import { CM5_SET_VALUE_EVENT } from "./shared/cmBridge";

/**
 * Runs in the page MAIN world (manifest `world: "MAIN"`). No `chrome` APIs — avoids exposing
 * extension internals to page scripts. Listens for events from the isolated content script.
 */
document.addEventListener(
  CM5_SET_VALUE_EVENT,
  ((e: Event) => {
    const d = (e as CustomEvent<{ cmRootId?: string; text?: string }>).detail;
    if (!d || typeof d.cmRootId !== "string" || typeof d.text !== "string") return;
    const el = document.getElementById(d.cmRootId);
    if (!el) return;
    const cm =
      (el as unknown as { CodeMirror?: { setValue: (v: string) => void; save?: () => void } }).CodeMirror ||
      (el as unknown as { cm?: { setValue: (v: string) => void; save?: () => void } }).cm;
    if (!cm || typeof cm.setValue !== "function") return;
    cm.setValue(d.text);
    if (typeof cm.save === "function") cm.save();
  }) as EventListener,
);
