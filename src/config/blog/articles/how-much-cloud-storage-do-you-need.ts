import type { BlogArticle } from "../types";

export const howMuchCloudStorageDoYouNeed: BlogArticle = {
  slug: "how-much-cloud-storage-do-you-need",
  title: "How Much Cloud Storage Do You Need? 100 GB, 500 GB, 1 TB and Beyond",
  metaTitle: "How Much Cloud Storage Do You Need? A Practical Guide",
  metaDescription:
    "Not sure how much cloud storage you need? Understand 100 GB, 500 GB, 1 TB and larger plans for photos, documents, videos and everyday files.",
  primaryKeyword: "how much cloud storage do I need",
  secondaryKeywords: [
    "how much online storage do I need",
    "100 GB cloud storage",
    "500 GB cloud storage",
    "1 TB cloud storage",
    "cloud storage capacity",
    "storage space calculator",
  ],
  metaKeywords: [
    "how much cloud storage do I need",
    "how much online storage do I need",
    "100GB cloud storage",
    "500GB cloud storage",
    "1TB cloud storage",
    "cloud storage capacity",
  ],
  summary:
    "Work out your real storage need from the files you actually have, using stated assumptions rather than guesses dressed as facts.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 365,
  image: {
    src: "/images/blog/how-much-cloud-storage.webp",
    width: 1200,
    height: 675,
    alt: "Progressively larger translucent storage blocks arranged in an elegant ascending sequence with subtle document and photo symbols",
  },
  related: ["best-free-cloud-storage", "how-to-organize-digital-files", "best-google-drive-alternatives"],
  faqs: [
    {
      question: "Is 1 TB enough for a family's photos?",
      answer:
        "Usually for years, sometimes not for a decade. A typical phone photo is 2–5 MB; 1 TB holds roughly 200,000–500,000 at that size. The variables that break the estimate are video, RAW files from a dedicated camera, and keeping every duplicate you have ever exported.",
    },
    {
      question: "Why does my storage show less than the number on the plan?",
      answer:
        "Usually decimal versus binary units. Providers selling \"1 TB\" normally mean 1,000,000,000,000 bytes, while some operating systems display the same space as about 931 GiB and label it GB. Both numbers describe the same disk.",
    },
    {
      question: "Should I buy one big plan or several smaller ones?",
      answer:
        "One plan, unless there is a reason to separate work from personal data. Splitting storage means splitting backups, sharing configs and account recovery, and you will forget which file went where.",
    },
  ],
  body: [
    {
      type: "p",
      text: "Most people buy either too little storage, then upgrade within a month, or too much, and pay for empty space for years. The fix is not a better guess — it is a rough count of what you actually store, which takes about ten minutes and is usually more accurate than a feeling about being \"a heavy user\".",
    },
    { type: "h2", id: "units", text: "First, GB and TB without the confusion" },
    {
      type: "p",
      text: "Storage is sold in decimal units: 1 KB is 1,000 bytes, 1 MB is 1,000,000, 1 GB is 1,000,000,000 and 1 TB is 1,000,000,000,000. That is what your cloud provider means and what the plan sizes in this article use.",
    },
    {
      type: "p",
      text: "Some operating systems display the same capacity using binary units, where a \"GB\" is 1,073,741,824 bytes. A 1 TB plan therefore shows as roughly 931 GB in one place and 1,000 GB in another. Nothing is missing; the two conventions are measuring the same space with different arithmetic. Orindle uses decimal units throughout, so the number you buy is the number you see.",
    },
    {
      type: "table",
      caption: "The same capacity, two conventions.",
      head: ["Decimal (used by providers)", "Binary (some OS displays)", "Difference"],
      rows: [
        ["100 GB", "≈ 93 GB", "~7%"],
        ["500 GB", "≈ 466 GB", "~7%"],
        ["1 TB", "≈ 931 GB", "~7%"],
        ["5 TB", "≈ 4.55 TB", "~9%"],
        ["10 TB", "≈ 9.09 TB", "~9%"],
      ],
    },
    { type: "h2", id: "estimating", text: "How to estimate what you store" },
    {
      type: "steps",
      items: [
        {
          title: "Check what you already use",
          text: "Every phone and laptop reports storage used by category. Start there — it is measured, not estimated. On a phone, note both total used and how much is photos, which is usually the largest single category.",
        },
        {
          title: "Count your largest files, not your average file",
          text: "Storage is dominated by outliers. A handful of video projects or camera RAW files can outweigh thousands of documents. If you have any video work, estimate that first and separately.",
        },
        {
          title: "Add the multiplier for growth",
          text: "Take your current usage and add 50–100% for the next few years. Phone photos accumulate at a fairly steady rate; the growth is not linear, but it is not flat either.",
        },
        {
          title: "Add what is not there yet",
          text: "Backups you intend to start, a second machine, a shared project. Storage decisions tend to be made at the moment of organising, which is when the total is highest.",
        },
      ],
    },
    { type: "h2", id: "reference-figures", text: "Reference figures, with their assumptions" },
    {
      type: "p",
      text: "These are typical sizes, not promises. The point of stating them is that you can substitute your own numbers and reach a better answer than this article can give you.",
    },
    {
      type: "table",
      caption: "Typical file sizes used for the examples below. Your files will differ.",
      head: ["File type", "Assumed typical size", "Notes"],
      rows: [
        ["Phone photo (JPEG/HEIC)", "2–5 MB", "Larger on newer high-megapixel phones"],
        ["Camera photo (RAW)", "20–50 MB", "The category most likely to surprise you"],
        ["Word/PDF document", "0.1–2 MB", "Scanned PDFs at the top end"],
        ["1 minute of 1080p video", "~100–200 MB", "Depends entirely on bitrate"],
        ["1 minute of 4K video", "~300–500 MB", "Phone 4K is at the lower end"],
        ["Music track (compressed)", "3–10 MB", "Lossless is 25–50 MB"],
        ["Presentation with images", "5–40 MB", "Grows with embedded media"],
      ],
    },
    {
      type: "p",
      text: "With those assumptions, here is what each plan roughly holds. Treat these as order-of-magnitude illustrations that show what a size *means*, not as guarantees of a file count.",
    },
    {
      type: "table",
      caption: "Illustrative capacity using the assumptions above.",
      head: ["Plan", "Roughly this many phone photos", "Roughly this much 4K video", "Who it fits"],
      rows: [
        ["10 GB", "2,000–5,000", "20–30 minutes", "Documents and a trial — the free starting point"],
        ["100 GB", "20,000–50,000", "5–6 hours", "One person's photos and documents"],
        ["500 GB", "100,000–250,000", "25–30 hours", "A household, or a freelancer with video"],
        ["1 TB", "200,000–500,000", "50–60 hours", "Photos plus regular video work"],
        ["5 TB", "1–2.5 million", "250–300 hours", "Serious media, or a small team"],
        ["10 TB", "2–5 million", "500+ hours", "Archives, production, larger teams"],
      ],
    },
    { type: "h2", id: "workloads", text: "What different people actually need" },
    {
      type: "list",
      items: [
        "**Documents only.** A decade of work documents is often under 10 GB. Free tiers are genuinely sufficient here, and paying is about backup discipline rather than capacity.",
        "**Phone photos, no video.** Most people land between 50 GB and 300 GB after several years, depending on how many they keep.",
        "**Photos plus occasional video.** 500 GB to 1 TB. Video is the variable that moves the answer, not the photography.",
        "**Video editing or client delivery.** 5 TB and up, and the constraint stops being storage and becomes transfer speed — check upload throughput before buying capacity.",
        "**A family sharing one pool.** Add the members' usage and expect the sum to be higher than any member's own estimate.",
        "**A small team.** Per-person estimates work until someone starts a shared media library, at which point the shared folder dominates everything.",
      ],
    },
    { type: "h2", id: "calculation", text: "A five-line calculation you can do now" },
    {
      type: "p",
      text: "Add the following, and round up to the next plan size rather than down. Running out is more disruptive than paying slightly more.",
    },
    {
      type: "list",
      ordered: true,
      items: [
        "Photos: number of photos you keep × 4 MB (use 30 MB if you shoot RAW).",
        "Video: minutes of video × 400 MB (4K) or 150 MB (1080p).",
        "Documents: current folder size, which is usually small enough to measure directly.",
        "Backups and other devices: whatever those already consume.",
        "Then multiply by 1.5 for the next two or three years, and pick the plan above that number.",
      ],
    },
    {
      type: "note",
      tone: "info",
      text: "If the result lands just under a plan boundary, take the larger plan. Storage plans are not priced so that a near-miss is cheap; the upgrade you make in six weeks costs more in attention than the difference in price.",
    },
    { type: "h2", id: "orindle-plans", text: "Mapping the answer onto Orindle's six plans" },
    {
      type: "p",
      text: "Orindle publishes six plans across eight currencies with monthly or annual billing (20% off annually), listed in full on the [pricing page](/pricing):",
    },
    {
      type: "table",
      caption: "Orindle plans. Decimal storage units; monthly and annual billing across 8 currencies.",
      head: ["Plan", "Storage", "Fits"],
      rows: [
        ["Free", "10 GB", "Documents, a few thousand photos, trying the product"],
        ["Basic", "100 GB", "One person's photos, documents and light video"],
        ["Plus", "500 GB", "A household, or freelance work with video"],
        ["Premium", "1 TB", "Photo libraries plus regular video (Most popular)"],
        ["Ultra", "2 TB", "Serious media work and multi-device backups"],
        ["Max", "5 TB", "Archives, production libraries, and growing teams"],
      ],
    },
    {
      type: "p",
      text: "If your calculation lands on 120 GB, Basic is the plan and 100 GB the constraint — which is exactly the situation in which it is worth trimming duplicates before upgrading. Photographs taken in bursts are the usual culprit; [our guide to organising digital files](/blog/how-to-organize-digital-files) covers how to clear the duplicates without deleting anything you meant to keep.",
    },
    { type: "h2", id: "sources", text: "Further reading" },
    {
      type: "source",
      label: "Orindle — plans and pricing",
      href: "https://orindle.com/pricing",
      note: "The plan sizes referenced throughout this article.",
    },
    {
      type: "source",
      label: "NIST — prefixes for binary multiples",
      href: "https://physics.nist.gov/cuu/Units/binary.html",
      note: "The definition behind the GB/GiB distinction.",
    },
  ],
};
