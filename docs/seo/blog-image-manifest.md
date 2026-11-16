# Blog Image Manifest

**Ten images, one per article. 1200 × 675, WebP, 200 KB total.**

Generated as AI artwork against a single art direction, then converted to WebP. They
are original compositions: no competitor logos, no stock photography, no text rendered
inside any image.

---

## Art direction

| Property | Value |
| --- | --- |
| Format | WebP, quality 84, method 6 |
| Dimensions | 1200 × 675 (16:9) |
| Style | Premium editorial SaaS illustration — flat vector forms, soft translucent materials |
| Palette | Cool-white ground; accent blue `#3178fb`; pastel support (sky, mint, lavender, peach, periwinkle) |
| Lighting | Diffused, from the upper left |
| Texture | Soft gradient shading on glassy surfaces |
| Excluded | Text, letters, numbers, logos, watermarks, people, photography, padlock clichés |
| Consistency | Every image shares the ground tone, accent, palette and shadow treatment |

The one deliberate departure from "no padlocks" is article 8, which asks for a
security visual specifically *without* the padlock cliché — it uses an architectural
protective structure instead, as directed.

---

## The ten images

| # | File | Article | Visual |
| --- | --- | --- | --- |
| 1 | `google-drive-alternatives.webp` | Best Google Drive Alternatives | Five translucent file-system panels in different pastel tints, staggered in depth, each with folder, file-stack and sync-arrow glyphs |
| 2 | `google-drive-vs-dropbox-vs-onedrive.webp` | Google Drive vs Dropbox vs OneDrive | Three equal frosted panels side by side with clear separation — document stack, folder pair, circular sync arrangement |
| 3 | `best-free-cloud-storage.webp` | Best Free Cloud Storage | A translucent cloud vessel holding colourful abstract file objects, with three ascending capacity bars alongside |
| 4 | `how-much-cloud-storage.webp` | How Much Cloud Storage Do You Need | Five progressively larger translucent blocks in graduated blues, tiny file, folder, photo and video glyphs inside the larger ones |
| 5 | `cloud-storage-vs-cloud-backup.webp` | Cloud Storage vs Cloud Backup | Split composition: flowing sync arc between devices on the left, a calm layered vault with a timeline arc on the right |
| 6 | `share-large-files-online.webp` | How to Share Large Files Online | An oversized document panel arcing toward a receiving device, file particles in transit, three abstract access-control badges above |
| 7 | `business-cloud-storage.webp` | Best Cloud Storage for Small Business | Overhead desk view with laptop, tablet and phone showing the same shared folder tree; a floating card of file rows and role indicators. No people |
| 8 | `is-cloud-storage-safe.webp` | Is Cloud Storage Safe | A layered repository column inside an interlocking geometric canopy, with concentric access rings and credential tokens. No padlock |
| 9 | `organize-digital-files.webp` | How to Organize Digital Files | A precise three-tier hierarchy — one folder, three folders, six tinted file cards — perfectly aligned |
| 10 | `move-files-from-google-drive.webp` | How to Move Files from Google Drive | Two disc-shaped storage environments connected by a curved transfer path carrying files in transit |

---

## File sizes

| File | Bytes |
| --- | --- |
| best-free-cloud-storage.webp | 11,566 |
| business-cloud-storage.webp | 37,692 |
| cloud-storage-vs-cloud-backup.webp | 14,122 |
| google-drive-alternatives.webp | 17,532 |
| google-drive-vs-dropbox-vs-onedrive.webp | 11,234 |
| how-much-cloud-storage.webp | 15,782 |
| is-cloud-storage-safe.webp | 25,942 |
| move-files-from-google-drive.webp | 18,736 |
| organize-digital-files.webp | 10,154 |
| share-large-files-online.webp | 16,664 |
| **Total** | **199,424 bytes (~195 KB)** |

Averaging 19 KB per image at 1200 × 675 is well below what a JPEG would use for the
same artwork, which is why WebP was chosen for delivery.

---

## Alt text

Every alt attribute is written for the specific image and describes what is in it.
None repeats the article title, and none is a keyword list.

| Article | Alt text |
| --- | --- |
| 1 | Abstract floating file systems representing different cloud storage services, each with its own geometric folder and sync symbols |
| 2 | Three abstract file-storage environments shown side by side in balanced editorial composition, each with original geometric iconography |
| 3 | A clean cloud storage container holding colourful abstract file objects, with storage capacity shown as layered translucent blocks |
| 4 | Progressively larger translucent storage blocks arranged in an elegant ascending sequence with subtle document and photo symbols |
| 5 | Two contrasting abstract scenes: an active file synchronisation path between devices on one side, a protected recovery vault on the other |
| 6 | A large digital file transferring between two devices through a refined sharing link, with abstract permission and access-control indicators |
| 7 | A modern desk workspace with connected devices showing shared folder structures and collaborative digital organisation, no people |
| 8 | A digital file repository protected by an abstract geometric structure, with subtle access-control layers rather than padlock imagery |
| 9 | A clean, beautifully arranged hierarchy of digital folders and files communicating order, simplicity and productivity |
| 10 | A file migration path between two abstract storage environments, with files travelling along a clear transfer route |

---

## Implementation

- Rendered with `next/image`, so each thumbnail is served at the size the viewport
  needs and WebP is negotiated with AVIF where supported.
- Blog index: the lead article uses `priority`; the other nine are lazy by default.
- Article page: hero image is `priority` with `sizes="(max-width: 900px) 100vw, 900px"`.
- Article thumbnails double as Open Graph images, at `1200 × 675` — accepted by Facebook,
  LinkedIn, X and Slack.
- `img-src 'self' data: blob:` in the CSP; images are crawled through the optimiser,
  which the audit verifies by requesting the `/_next/image` endpoint for each file.

## Verification

`scripts/seo-audit.mjs` checks, for all ten:

1. the file exists and returns 200;
2. `content-type` is `image/webp`;
3. the `next/image` optimiser returns 200 for the path (which catches a `images.` config
   or CSP problem that the raw file would not reveal).

`tests/unit/seo.test.ts` additionally asserts that there are exactly ten `.webp` files
in `public/images/blog`, that each declared image resolves to one of them, and that
every alt attribute is longer than 40 characters.
