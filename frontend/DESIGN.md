# Toolhaven design system

Toolhaven is set as a publication, not an app: paper and ink, a serif for voice,
a mono for furniture, one accent red. The rules below exist because the site had
drifted — seven corner radii, eight shadow distances and 169 hand-typed pixel
sizes — and inconsistency at that scale is what makes a designed thing read as
an assembled one.

## Corner radius

A press sheet has no rounded corners. Softness is spent only where it does a job.

| Token | Value | For |
|---|---|---|
| `rounded-edge` | 0 | rules, tables, full-bleed panels |
| `rounded-tight` | 2px | chips, labels, stamps |
| `rounded-ui` | 4px | inputs, buttons, controls |
| `rounded-card` | 8px | cards and panels |
| `rounded-full` | — | **true circles only** |

`rounded-full` is not a button style. A pill-shaped button was the loudest
generated-looking element on the site and there were fifty-eight of them.

## Shadow

The hard offset shadow is the letterpress signature and stays. The eight
distances it was written at by hand do not.

`shadow-press-sm` 2px · `shadow-press` 3px · `shadow-press-lg` 6px · `shadow-press-xl` 10px

No blurred shadows, no glows, no glassmorphism.

## Type

Fluid display sizes solve for the viewport between 375px and 1440px, so nothing
needs a breakpoint override.

| Token | Role |
|---|---|
| `text-hero` | cover headline |
| `text-display` | page heading |
| `text-title` | section heading |
| `text-nav` | navigation |
| `text-caption` | 12px supporting |
| `text-label` | 11px labels and metadata |
| `text-nano` | 10px — the floor |

`label` and `nano` carry no letter-spacing of their own, so whatever tracking a
component asks for still wins. Nothing goes below 10px.

## Motion

Restrained on purpose. Entrance is a 0.4s fade and eight pixels of travel — no
blur, no scale, no cinematic rise. Stagger stops at three steps so the last card
in a row is not noticeably later than the first.

All of it lives inside `@media (prefers-reduced-motion: no-preference)`, so a
reader who asks for less motion gets the static, fully legible page.

## Targets

Every control is at least 44px on touch and 28px on a pointer. The 24px WCAG
minimum is the floor, not the goal.

## Grid

`max-w-6xl` with `px-5 sm:px-6` gutters. Tool listings are one column on a
phone, two from 640px, three from 1024px — the listing carries four blocks of
prose and two-up at 390px truncates all of them. Category tiles stay two-up on a
phone; they are short enough to work there.

## What the listing says

Every tool card carries what it is, **what it is best for**, and **what to watch
for** — both halves from the editorial record. A tool with no caveat on file
shows one fewer line; nothing is generated to fill the space.
