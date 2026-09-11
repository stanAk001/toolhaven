/**
 * The photo set for one pick.
 *
 * A product is not one photograph. The thing a buyer is squinting at is usually
 * the port cluster, the stand at its lowest setting, or the thing next to a
 * hand for scale — and the single-image field could hold exactly one of those.
 *
 * Three rules the old uploader broke, and this one keeps:
 *
 *  1. Nothing is called uploaded until the browser has decoded it. The previous
 *     version showed a green tick over a broken-image icon, which is worse than
 *     showing an error, because it looks finished.
 *  2. A file's real size is shown, read back from the server's response. "0 KB"
 *     next to a stored image is a bug report waiting to be filed.
 *  3. The first photo is the lead image, and it says so on the tile. Order is
 *     editorial, so it is visible and adjustable rather than whatever order the
 *     operating system handed over the files in.
 */
import { useState, useRef, useCallback, useId } from "react";
import { UploadCloud, X, AlertTriangle, ArrowLeft, ArrowRight, Star, Loader2, History } from "lucide-react";
import { uploadImage } from "../api/client.js";
import { ACCEPT, checkImage, readableSize } from "../lib/imagefile.js";

const apiOrigin = () =>
  (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api\/?$/, "");

const MAX_PHOTOS = 8;

/**
 * @param {{url,id,alt,byteSize,width,height}[]} value  photos, in display order
 * @param {(next) => void} onChange
 */
export function PhotoSet({ value = [], onChange, label = "Product photos", hint, loadRecent }) {
  const photos = Array.isArray(value) ? value : [];
  // Recent uploads that are not on any pick. Loaded on demand, not on mount —
  // eight picks each fetching the same list the moment the page opens would be
  // eight requests for a tray nobody has asked to see.
  const [recent, setRecent] = useState(null);     // null = not opened yet
  const [recentBusy, setRecentBusy] = useState(false);
  const openRecent = async () => {
    if (recent) { setRecent(null); return; }
    setRecentBusy(true);
    try { setRecent((await loadRecent()).items || []); }
    catch { setRecent([]); }
    finally { setRecentBusy(false); }
  };
  const [busy, setBusy] = useState(0);          // how many are in flight
  const [errors, setErrors] = useState([]);     // one line per rejected file
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const dropId = useId();

  const room = MAX_PHOTOS - photos.length;

  /**
   * Take a batch of files. Each is checked and uploaded on its own so one bad
   * file in a selection of six does not throw away the other five — the whole
   * point of dropping a folder in at once.
   */
  const take = useCallback(async (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;

    const complaints = [];
    if (list.length > room) {
      complaints.push(`Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} on this pick, so the rest were skipped.`);
    }
    const batch = list.slice(0, Math.max(0, room));

    setErrors(complaints);
    setBusy((n) => n + batch.length);

    const added = [];
    for (const file of batch) {
      const { complaint } = await checkImage(file);
      if (complaint) {
        complaints.push(`${file.name || "That file"} — ${complaint}`);
        setBusy((n) => n - 1);
        continue;
      }
      try {
        const r = await uploadImage(file);
        added.push({ ...r, alt: "" });
      } catch (err) {
        complaints.push(`${file.name || "That file"} — ${err?.response?.data?.error
          || "the upload didn't go through. Check your connection and try again."}`);
      } finally {
        setBusy((n) => n - 1);
      }
      // Push after each one so the grid fills in as they land rather than
      // sitting still and then jumping.
      if (added.length) onChange?.([...photos, ...added]);
    }
    setErrors(complaints);
  }, [photos, onChange, room]);

  const patch = (i, key, val) =>
    onChange?.(photos.map((p, n) => (n === i ? { ...p, [key]: val } : p)));

  const remove = (i) => onChange?.(photos.filter((_, n) => n !== i));

  const move = (i, by) => {
    const j = i + by;
    if (j < 0 || j >= photos.length) return;
    const next = photos.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange?.(next);
  };

  const onDrop = (e) => { e.preventDefault(); setDragging(false); take(e.dataTransfer?.files); };
  const onPaste = (e) => {
    const files = Array.from(e.clipboardData?.items || [])
      .filter((i) => i.kind === "file" && /^image\//i.test(i.type))
      .map((i) => i.getAsFile())
      .filter(Boolean);
    if (!files.length) return;
    e.preventDefault();
    take(files);
  };

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="font-mono text-label uppercase tracking-[.14em] text-ink2">{label}</span>
        <span className="font-mono text-nano tabular-nums text-ink2">
          {photos.length}/{MAX_PHOTOS}
        </span>
      </div>

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-2.5">
          {photos.map((p, i) => (
            <li key={p.id ?? i} className="border border-rule rounded-card bg-surface overflow-hidden">
              <div className="relative aspect-[4/3] bg-paper2">
                <img src={apiOrigin() + p.url} alt=""
                  className="absolute inset-0 w-full h-full object-contain p-2" />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 bg-ink text-paper
                    font-mono text-nano uppercase tracking-[.12em] px-1.5 py-0.5 rounded-tight">
                    <Star size={9} aria-hidden="true" /> Lead
                  </span>
                )}
                <button type="button" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}
                  className="absolute top-1.5 right-1.5 grid place-items-center w-7 h-7 rounded-tight
                    bg-paper/90 border border-rule text-accentDeep hover:bg-paper transition-colors">
                  <X size={12} aria-hidden="true" />
                </button>
              </div>

              <div className="p-2 space-y-1.5">
                {/* Alt text per photo. Left blank it is treated as decorative,
                    which is the honest answer for a third angle of the same
                    product — better than repeating the name six times. */}
                <input value={p.alt || ""} onChange={(e) => patch(i, "alt", e.target.value)}
                  placeholder="What this shows (optional)"
                  className="w-full border border-rule rounded-tight bg-paper px-2 py-1.5 font-mono text-nano
                    outline-none focus:border-accent transition-colors" />

                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-nano text-ink2 tabular-nums truncate">
                    {p.width && p.height ? `${p.width}×${p.height}` : ""}
                    {readableSize(p.byteSize) ? ` · ${readableSize(p.byteSize)}` : ""}
                  </span>
                  <span className="flex gap-1 shrink-0">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                      aria-label={`Move photo ${i + 1} earlier`}
                      className="grid place-items-center w-7 h-7 rounded-tight border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                      <ArrowLeft size={11} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1}
                      aria-label={`Move photo ${i + 1} later`}
                      className="grid place-items-center w-7 h-7 rounded-tight border border-rule disabled:opacity-30 hover:bg-paper2 transition-colors">
                      <ArrowRight size={11} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <button type="button" id={dropId}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onPaste={onPaste}
          disabled={busy > 0}
          className={`w-full flex flex-col items-center justify-center gap-2 rounded-card border border-dashed px-4
            ${photos.length ? "py-4" : "py-7"} transition-colors
            ${dragging ? "border-accent bg-accent/5" : "border-rule hover:border-ink2 hover:bg-paper2/50"}
            ${busy > 0 ? "opacity-70 cursor-wait" : "cursor-pointer"}`}>
          {busy > 0 ? (
            <>
              <Loader2 size={18} aria-hidden="true" className="animate-spin text-accentDeep" />
              <span className="font-mono text-label uppercase tracking-[.12em] text-ink2">
                Checking and uploading {busy} {busy === 1 ? "photo" : "photos"}&hellip;
              </span>
            </>
          ) : (
            <>
              <UploadCloud size={photos.length ? 18 : 22} aria-hidden="true" className="text-accentDeep" />
              <span className="font-display text-base font-semibold text-center text-balance">
                {photos.length ? "Add more photos" : "Drop photos, "}
                {!photos.length && <span className="underline underline-offset-4">browse</span>}
                {!photos.length && ", or paste a screenshot"}
              </span>
              <span className="font-mono text-nano uppercase tracking-[.12em] text-ink2 text-center">
                Several at once &middot; PNG &middot; JPG &middot; WEBP &middot; SVG &middot; up to 5&nbsp;MB each
                <span className="block mt-1 normal-case tracking-normal">
                  The first photo is the one that shows in the guide. Click here, then Ctrl+V to paste.
                </span>
              </span>
            </>
          )}
        </button>
      )}

      {/* Put back a photo that was already uploaded. Every upload is kept even
          when nothing points at it, so a photo that fell off a pick is still
          there — this is where it can be found again, without the file. */}
      {loadRecent && room > 0 && (
        <div className="mt-2">
          <button type="button" onClick={openRecent} disabled={recentBusy}
            className="inline-flex items-center gap-1.5 min-h-touch font-mono text-nano uppercase tracking-wide
              border border-rule rounded-ui px-3 hover:bg-paper2 transition-colors disabled:opacity-60">
            <History size={12} aria-hidden="true" />
            {recentBusy ? "Loading\u2026" : recent ? "Hide recent uploads" : "Reuse a recent upload"}
          </button>

          {recent && (
            recent.length === 0 ? (
              <p className="font-mono text-nano text-ink2 mt-2">
                No unattached photos from the last 30 days.
              </p>
            ) : (
              <>
                <p className="font-mono text-nano text-ink2 mt-2 mb-1.5">
                  Photos uploaded recently that are not on any pick. Click one to add it here.
                </p>
                <ul className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {recent
                    .filter((r) => !photos.some((ph) => (ph.uploadId ?? ph.id) === r.id))
                    .map((r) => (
                      <li key={r.id}>
                        <button type="button"
                          onClick={() => {
                            if (photos.length >= MAX_PHOTOS) return;
                            onChange?.([...photos, { ...r, alt: "" }]);
                            setRecent((list) => (list || []).filter((x) => x.id !== r.id));
                          }}
                          title={`${r.width}\u00d7${r.height} \u00b7 uploaded ${new Date(r.createdAt).toLocaleString()}`}
                          className="block w-full aspect-[4/3] rounded-tight border border-rule bg-paper2/40 overflow-hidden
                            hover:border-accent focus-visible:border-accent transition-colors">
                          <img src={apiOrigin() + r.url} alt="" loading="lazy" decoding="async"
                            className="w-full h-full object-contain p-1" />
                        </button>
                      </li>
                    ))}
                </ul>
              </>
            )
          )}
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" tabIndex={-1}
        onChange={(e) => { take(e.target.files); e.target.value = ""; }} />

      {hint && errors.length === 0 && <p className="font-mono text-nano text-ink2/80 mt-1.5">{hint}</p>}

      {errors.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {errors.map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-accentDeep">
              <AlertTriangle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
              <span className="text-pretty">{e}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
