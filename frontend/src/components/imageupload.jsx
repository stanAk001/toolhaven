/**
 * The logo uploader.
 *
 * Submitters were being asked to paste a URL, which quietly assumed they had
 * somewhere to host an image and knew how to get a direct link to it. Most
 * people do not, so most submissions arrived with no logo and the listing wore
 * a two-letter tile instead.
 *
 * Built as a drop target that is also a button, because the two audiences are
 * different: dragging is faster if you already have the file open, and a plain
 * file picker is the only thing that works on a phone. Both end at the same
 * place — the image uploads immediately and is shown back, so nobody submits a
 * form and then wonders whether the picture went with it.
 */
import { useState, useRef, useCallback } from "react";
import { UploadCloud, X, RefreshCw, Check, AlertTriangle } from "lucide-react";
import { uploadImage } from "../api/client.js";
import { ACCEPT, checkImage, readableSize } from "../lib/imagefile.js";


const apiOrigin = () =>
  (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

export function ImageUpload({ value, onChange, label = "Tool logo", hint }) {
  const [state, setState] = useState("idle");   // idle | uploading | error
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const handle = useCallback(async (file) => {
    setState("uploading"); setError("");
    const { complaint } = await checkImage(file);
    if (complaint) { setState("error"); setError(complaint); return; }

    try {
      const result = await uploadImage(file);
      setState("idle");
      onChange?.(result);
    } catch (err) {
      setState("error");
      // The server writes its messages for a person to read, so they are shown
      // as-is. Anything else gets a sentence rather than a stack trace.
      setError(err?.response?.data?.error
        || "The upload didn't go through. Check your connection and try again.");
    }
  }, [onChange]);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handle(file);
  };

  /**
   * Paste an image straight from the clipboard.
   *
   * Screenshotting a logo off a vendor's site and pasting it is faster than
   * saving a file and finding it again, and it is what most people reach for.
   * Bound to the drop zone rather than the window so it cannot swallow a paste
   * meant for a text field elsewhere on the page.
   */
  const onPaste = useCallback((e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const img = items.find((i) => i.kind === "file" && /^image\//i.test(i.type));
    if (!img) return;
    e.preventDefault();
    const file = img.getAsFile();
    if (file) handle(file);
  }, [handle]);

  const clear = () => {
    setState("idle"); setError("");
    if (inputRef.current) inputRef.current.value = "";
    onChange?.(null);
  };

  const src = value?.url ? apiOrigin() + value.url : null;

  return (
    <div>
      <span className="block font-mono text-label uppercase tracking-[.14em] text-ink2 mb-1.5">{label}</span>

      {value && src ? (
        /* Uploaded: show it, and make replacing or removing it obvious. */
        <div className="flex items-center gap-4 border border-rule rounded-card bg-paper p-3">
          <span className="grid place-items-center w-16 h-16 shrink-0 rounded-ui border border-rule bg-paper2/40 overflow-hidden">
            <img src={src} alt="" className="w-full h-full object-contain p-1.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 font-mono text-label uppercase tracking-[.12em] text-green-700">
              <Check size={13} aria-hidden="true" /> Uploaded
            </p>
            <p className="font-mono text-nano text-ink2 mt-1 tabular-nums">
              {(value.width && value.height) ? `${value.width}×${value.height}` : ""}
              {(value.width && value.height && readableSize(value.byteSize)) ? " · " : ""}
              {readableSize(value.byteSize) || ""}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-touch font-mono text-nano uppercase tracking-wide border border-rule rounded-ui px-3 hover:bg-paper2 transition-colors">
              <RefreshCw size={12} aria-hidden="true" /> Replace
            </button>
            <button type="button" onClick={clear} aria-label="Remove image"
              className="grid place-items-center w-10 h-10 shrink-0 rounded-ui border border-rule text-accentDeep hover:bg-paper2 transition-colors">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        /* Empty: a drop target that is also a button, so both routes work. */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onPaste={onPaste}
          disabled={state === "uploading"}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-4 py-7 transition-colors
            ${dragging ? "border-accent bg-accent/5" : "border-rule hover:border-ink hover:bg-paper2/40"}
            ${state === "uploading" ? "opacity-70 cursor-wait" : "cursor-pointer"}`}
        >
          {state === "uploading" ? (
            <>
              <RefreshCw size={20} aria-hidden="true" className="animate-spin text-accentDeep" />
              <span className="font-mono text-label uppercase tracking-[.12em] text-ink2">Uploading&hellip;</span>
            </>
          ) : (
            <>
              <UploadCloud size={22} aria-hidden="true" className="text-accentDeep" />
              <span className="font-display text-base font-semibold">
                Drop an image, <span className="underline underline-offset-4">browse</span>, or paste a screenshot
              </span>
              <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2 text-center">
                PNG &middot; JPG &middot; WEBP &middot; SVG &nbsp;&middot;&nbsp; 512&times;512 or larger &nbsp;&middot;&nbsp; up to 5 MB
                <span className="block mt-1 normal-case tracking-normal">Click here first, then press Ctrl+V to paste</span>
              </span>
            </>
          )}
        </button>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handle(f); }} />

      {hint && !error && <p className="font-mono text-nano text-ink2/80 mt-1.5">{hint}</p>}
      {error && (
        <p className="flex items-start gap-2 text-sm text-accentDeep mt-2">
          <AlertTriangle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
          <span className="text-pretty">{error}</span>
        </p>
      )}
    </div>
  );
}
