import type { HelpCategory } from "./types";

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    id: "getting-started",
    title: "Getting started",
    description: "Your first ten minutes with Orindle.",
    intro:
      "Creating an account, finding your way around the dashboard, and getting a first file uploaded.",
  },
  {
    id: "account",
    title: "Account help",
    description: "Signing in, security, and closing an account.",
    intro:
      "Access to your own account: passwords, two-factor, sessions, and what happens when you leave.",
  },
  {
    id: "storage",
    title: "Storage & plans",
    description: "How the allowance works and what happens when it fills up.",
    intro:
      "One allowance per account, shared across every device. These articles explain what counts against it and what to do at the limit.",
  },
  {
    id: "files",
    title: "File management",
    description: "Folders, uploads, trash and getting files out.",
    intro: "Organising, moving, recovering and exporting what you have stored.",
  },
  {
    id: "sharing",
    title: "Sharing",
    description: "Links, permissions and revocation.",
    intro:
      "Sending a file to somebody without handing them your account, and taking that access back afterwards.",
  },
  {
    id: "billing",
    title: "Billing",
    description: "Plans, payment, invoices and cancellation.",
    intro:
      "How subscriptions are charged, where invoices come from, and what cancelling actually does.",
  },
  {
    id: "business",
    title: "Business accounts",
    description: "Shared folders, roles and the team workspace.",
    intro:
      "The organization workspace: who can see what, how roles work, and what happens to shared data when somebody leaves.",
  },
];

export function helpCategory(id: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((category) => category.id === id);
}
