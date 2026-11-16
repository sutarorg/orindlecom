export const SITE = {
  name: "Orindle",
  tagline: "Your files. Your world. One simple place.",
  description:
    "Orindle is cloud storage for people who want their files to simply be there. Store, access and share your files from anywhere. Start with 10 GB free — no credit card required.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://orindle.com",
  supportEmail: "tejassutar.business@gmail.com",
} as const;

export const PRIMARY_NAV = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Business", href: "/business" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
] as const;

export const FOOTER_NAV = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "Business", href: "/business" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Business", href: "/business" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "FAQ", href: "/faq" },
      { label: "Security", href: "/security" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "All policies", href: "/legal" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Cookies", href: "/cookies" },
      { label: "Acceptable use", href: "/acceptable-use" },
      { label: "Data deletion", href: "/data-deletion" },
    ],
  },
] as const;
