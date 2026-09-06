// A tool's brand mark, with the monogram tile as its fallback.
//
// Three things this has to get right:
//
// 1. A logo that fails to load must not leave a blank square. Vendors move
//    assets without warning, so onError swaps back to the monogram rather than
//    showing a broken image.
// 2. Brand marks are not ours to alter. The image is object-contain inside a
//    neutral tile, never stretched to fill, never recoloured — the shape and
//    proportions arrive as the vendor published them.
// 3. It is decorative when it sits beside the tool's name (the name already
//    says which tool it is) and needs a real alt only when it stands alone.
import { useState } from "react";

/**
 * @param {object}  tool      needs { name, logoUrl, logoAlt, logoMono, category }
 * @param {number}  size      px — the tile is square
 * @param {boolean} labelled  true when the tool's name is NOT adjacent, so the
 *                            logo must carry the accessible name itself
 */
export function ToolLogo({ tool, size = 48, className = "", labelled = false }) {
  const [failed, setFailed] = useState(false);
  const color = tool?.category?.colorPrimary || "#0E1116";
  const mono = tool?.logoMono || tool?.name?.[0] || "?";
  const showImage = tool?.logoUrl && !failed;

  const box = {
    width: size, height: size,
    // a real logo sits on paper so the vendor's own colours read correctly;
    // the monogram keeps the category tile it has always had
    background: showImage ? "rgb(var(--paper))" : color,
  };

  return (
    <span
      className={`grid place-items-center shrink-0 rounded-ui border border-rule overflow-hidden ${className}`}
      style={box}
      {...(labelled ? {} : { "aria-hidden": "true" })}
    >
      {showImage ? (
        <img
          src={tool.logoUrl}
          alt={labelled ? (tool.logoAlt || `${tool.name} logo`) : ""}
          width={size} height={size}
          loading="lazy" decoding="async"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain p-1.5"
          style={{ imageRendering: "auto" }}
        />
      ) : (
        <span className="font-display font-bold text-white leading-none"
          style={{ fontSize: Math.max(11, Math.round(size * 0.34)) }}>
          {mono}
        </span>
      )}
    </span>
  );
}
