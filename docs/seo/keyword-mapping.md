# Keyword Mapping

**Purpose:** one primary keyword per URL, no exceptions. Cannibalisation is the
failure mode this document prevents — two pages targeting one phrase compete with
each other, split internal links and signals, and neither ranks. A test asserts that
no two routes or articles share a primary keyword.

There are **26 indexable URLs**: 16 marketing/product pages and 10 articles.

---

## Marketing and product routes

| URL | Primary keyword | Search intent | Secondary keywords | Ranked to |
| --- | --- | --- | --- | --- |
| `/` | cloud storage | Commercial / informational (top of funnel) | online cloud storage, file storage online, personal cloud storage, secure file storage, online file sharing, cloud storage service, free cloud storage, cloud storage for individuals | Sign-up |
| `/pricing` | cloud storage pricing | Commercial investigation | cloud storage plans, affordable cloud storage, cheap cloud storage, online storage plans, 100 GB / 500 GB / 1 TB / 10 TB cloud storage | Plan selection |
| `/features` | cloud storage features | Informational / evaluative | file management, cloud file sharing, online file storage, cloud folder management, file access across devices, digital file organization, cloud storage tools | Feature comprehension |
| `/security` | cloud storage security | Evaluative — trust barrier | secure cloud storage, cloud storage privacy, file security, secure online file storage, cloud data protection, file access permissions, cloud storage protection | Removing the trust objection |
| `/business` | business cloud storage | Commercial investigation | cloud storage for business, team file storage, business file sharing, cloud storage for teams, company file storage, shared business folders, online business storage | Team evaluation |
| `/about` | Orindle cloud storage | Navigational / brand | about Orindle, online storage platform, cloud storage company, digital file storage | Brand trust |
| `/contact` | contact Orindle | Navigational | Orindle support, cloud storage support, cloud storage help, file storage customer support, business enquiries | Support |
| `/faq` | cloud storage FAQ | Informational — late stage | cloud storage questions, online storage FAQ, cloud storage plans FAQ, file sharing questions, cloud storage help, storage limits | Objection handling |
| `/help` | Orindle help center | Navigational / task support | cloud storage help, file upload help, file sharing help, cloud storage guides, online storage support, Orindle support | Retention |
| `/legal` | Orindle legal policies | Navigational / compliance | Orindle legal, cloud storage terms, online storage policies, service policies | Compliance |
| `/privacy` | Orindle privacy policy | Navigational / compliance | cloud storage privacy policy, online storage privacy, data privacy, personal information protection, user data policy | Compliance |
| `/terms` | Orindle terms of service | Navigational / compliance | cloud storage terms, online storage terms, service agreement, subscription terms, file storage conditions | Compliance |
| `/cookies` | Orindle cookie policy | Navigational / compliance | cookie policy, website cookies, cookie preferences, tracking technologies, online privacy | Compliance |
| `/acceptable-use` | Orindle acceptable use policy | Navigational / compliance | cloud storage acceptable use, file sharing rules, online storage policy, prohibited content policy, account usage policy | Compliance |
| `/data-deletion` | Orindle data deletion | Navigational / compliance | delete cloud storage account, cloud storage data deletion, delete online files, account deletion policy, personal data removal | Compliance / erasure |
| `/blog` | cloud storage blog | Informational hub | cloud storage guides, cloud storage tips, Google Drive alternatives, cloud storage comparisons, file management guides, online storage tips, cloud storage advice | Hub → articles |

---

## Blog articles

Each article has its own primary keyword, deliberately distinct from every page
above. Articles are the only routes allowed to be *broadly* informational; the
product pages stay commercial.

| URL | Primary keyword | Intent | Secondary keywords |
| --- | --- | --- | --- |
| `/blog/best-google-drive-alternatives` | Google Drive alternatives | Commercial investigation | best Google Drive alternatives, Google Drive competitors, alternatives to Google Drive, Dropbox alternative, OneDrive alternative, pCloud, MEGA cloud storage, free cloud storage alternatives |
| `/blog/google-drive-vs-dropbox-vs-onedrive` | Google Drive vs Dropbox vs OneDrive | Commercial comparison | Dropbox vs Google Drive, OneDrive vs Google Drive, best cloud storage comparison, Dropbox vs OneDrive, cloud storage services comparison, online file storage |
| `/blog/best-free-cloud-storage` | best free cloud storage | Commercial investigation | free online storage, cloud storage free plan, free file storage, 10 GB free cloud storage, free cloud drive, free cloud storage providers |
| `/blog/how-much-cloud-storage-do-you-need` | how much cloud storage do I need | Informational | how much online storage do I need, 100 GB cloud storage, 500 GB cloud storage, 1 TB cloud storage, cloud storage capacity, storage space calculator |
| `/blog/cloud-storage-vs-cloud-backup` | cloud storage vs cloud backup | Informational | cloud backup vs cloud storage, online file backup, cloud data backup, file synchronization, cloud backup services, backup and storage differences |
| `/blog/how-to-share-large-files-online` | how to share large files online | Informational / task | share large files online, secure file sharing, send large files online, share files with links, cloud file sharing, online file transfer |
| `/blog/best-cloud-storage-for-small-business` | best cloud storage for small business | Commercial investigation | business cloud storage, cloud storage for small business, team cloud storage, business file sharing, company file storage, small business online storage |
| `/blog/is-cloud-storage-safe` | is cloud storage safe | Informational — trust | cloud storage security, is online storage safe, cloud storage privacy, secure cloud storage, file protection, data security online |
| `/blog/how-to-organize-digital-files` | how to organize digital files | Informational / task | digital file organization, organize computer files, folder organization, file management tips, cloud file organization, document organization system |
| `/blog/how-to-move-files-from-google-drive` | move files from Google Drive | Informational / switch intent | transfer Google Drive files, Google Drive migration, migrate files to cloud storage, move files between cloud services, export Google Drive, cloud storage migration |

---

## Deliberate adjacency

Some keywords sit close together on purpose and are not cannibalisation because the
intent differs:

- **`cloud storage safety` (page) vs `is cloud storage safe` (article).** The page
  describes *Orindle's* controls; the article is a general explainer. The page
  answers "what do you do", the article answers "is this category safe". The article
  links to the page as the specific evidence.
- **`business cloud storage` (page) vs `best cloud storage for small business`
  (article).** The page sells Orindle for teams. The article compares providers and
  names Orindle's limitations in its recommendation section — which is why it can
  rank for a query the product page cannot serve honestly.
- **`cloud storage pricing` (page) vs `best free cloud storage` (article).** One is
  the price list; the other is about not paying. Both link to each other.

## Internal link map

Every article links to at least two other articles and at least one product page.
The pattern, which the link audit verifies:

| From | To |
| --- | --- |
| Alternatives | vs-comparison, free storage, move-files, `/pricing` |
| vs-comparison | alternatives, free storage, small business |
| Free storage | alternatives, how-much, is-safe, `/pricing` |
| How much | free storage, organise, alternatives, `/pricing` |
| Storage vs backup | share large files, is-safe, organise, `/help/articles/recover-deleted-files` |
| Share large files | storage-vs-backup, is-safe, organise, `/help/articles/revoke-a-shared-link` |
| Small business | alternatives, vs-comparison, organise, `/pricing` |
| Is safe | share large files, storage-vs-backup, free storage, `/security` |
| Organise | move-files, how-much, share large files, `/help/articles/organise-with-folders` |
| Move files | alternatives, organise, how-much |

The homepage links to Pricing, Features, Business, Blog, Security (via footer),
Help, Contact, FAQ and every legal page. The header carries Features, Pricing,
Business, Blog and About; the footer carries twenty links across four groups.
