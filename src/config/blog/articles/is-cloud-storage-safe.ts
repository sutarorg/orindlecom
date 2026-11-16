import type { BlogArticle } from "../types";

export const isCloudStorageSafe: BlogArticle = {
  slug: "is-cloud-storage-safe",
  title: "Is Cloud Storage Safe? Encryption, Privacy and Security Explained",
  metaTitle: "Is Cloud Storage Safe? Security & Privacy Explained",
  metaDescription:
    "Is cloud storage safe? Learn about encryption, passwords, account security, sharing permissions, privacy risks and practical ways to protect your files.",
  primaryKeyword: "is cloud storage safe",
  secondaryKeywords: [
    "cloud storage security",
    "is online storage safe",
    "cloud storage privacy",
    "secure cloud storage",
    "file protection",
    "data security online",
  ],
  metaKeywords: [
    "is cloud storage safe",
    "cloud storage security",
    "is online storage safe",
    "cloud storage privacy",
    "secure cloud storage",
    "file protection",
    "data security online",
  ],
  summary:
    "Where the real risks actually are — and why the answer is usually your account and your sharing habits, not the encryption.",
  published: "2026-11-16",
  updated: "2026-11-16",
  reviewIntervalDays: 365,
  image: {
    src: "/images/blog/is-cloud-storage-safe.webp",
    width: 1200,
    height: 675,
    alt: "A digital file repository protected by an abstract geometric structure, with subtle access-control layers rather than padlock imagery",
  },
  related: ["how-to-share-large-files-online", "cloud-storage-vs-cloud-backup", "best-free-cloud-storage"],
  faqs: [
    {
      question: "Is cloud storage safer than a local hard drive?",
      answer:
        "For most threats, yes: the provider handles disk failure, replication and physical security far better than a laptop does. It is not better against your own mistakes, and it introduces a new risk surface in your account. The realistic answer is both, with an independent copy of anything irreplaceable.",
    },
    {
      question: "What does end-to-end encryption actually protect?",
      answer:
        "It means the provider cannot read your files, because encryption and decryption happen on your device. That protects against provider-side access, breaches involving stored data and some legal requests. It does not protect against a weak password, a phished login, or someone you shared the file with.",
    },
    {
      question: "Is it safe to store financial documents in the cloud?",
      answer:
        "It can be, with two-factor authentication enabled, a unique password, and care about who you share folders with. The same advice applies to a safe in your house: the question is not whether the container is strong but who has the combination.",
    },
    {
      question: "What is the biggest risk in practice?",
      answer:
        "Account compromise and over-permissive sharing. Not cryptographic failure. The files that leak usually leak because a link was public, an old password was reused, or a folder was shared one level too high.",
    },
  ],
  body: [
    {
      type: "p",
      text: "\"Is cloud storage safe?\" is usually asked as though the answer is a property of the provider. Mostly it is a property of your account and your sharing habits. Providers are, as a class, competent at keeping disks running and data replicated; the incidents that actually expose files are overwhelmingly about credentials and permissions.",
    },
    { type: "h2", id: "in-transit", text: "In transit: what TLS does and does not do" },
    {
      type: "p",
      text: "Everything between your browser and the storage service should travel over TLS, which is now standard rather than special. It prevents someone on the same network — hotel Wi-Fi, a shared office — from reading or altering the bytes as they pass. It does not protect the file at either end, and it does not stop the provider from reading it. TLS is the lock on the delivery van, not the safe.",
    },
    { type: "h2", id: "at-rest", text: "At rest: who holds the keys" },
    {
      type: "p",
      text: "Data at rest is encrypted on the provider's disks, so a stolen physical drive yields ciphertext. In most consumer and business products the provider holds the keys, which means the provider *can* decrypt your files — for support, for abuse detection, or under legal compulsion. That is a normal and defensible design; it is not the same promise as end-to-end encryption, and marketing copy sometimes blurs the two.",
    },
    {
      type: "table",
      caption: "The distinction that matters.",
      head: ["", "Provider-managed encryption", "End-to-end encryption"],
      rows: [
        ["Can the provider read files", "Technically yes", "No"],
        ["Password reset", "Works normally", "Usually loses access to existing data"],
        ["File names visible to provider", "Yes", "No, if implemented properly"],
        ["Search and preview features", "Available", "Limited or client-side only"],
        ["Protects against provider breach of stored data", "Partially", "Largely"],
        ["Protects against a phished account", "No", "No"],
      ],
    },
    {
      type: "p",
      text: "Orindle uses provider-managed encryption at rest in Cloudflare R2. It is worth being explicit that this is not end-to-end encryption: the service can read files, as any storage service with server-side search and sharing must. If end-to-end encryption is a requirement, the products that offer it are Proton Drive, Sync.com, MEGA and pCloud's paid Crypto add-on, and the trade-offs — key recovery, feature limits — come with it.",
    },
    { type: "h2", id: "account-security", text: "Account security: where the real risk sits" },
    {
      type: "p",
      text: "An attacker who has your password has your files, regardless of how the files are encrypted, because they are using the account you are entitled to use. This is why the highest-value security actions are mundane:",
    },
    {
      type: "list",
      items: [
        "**A unique password.** Reuse is how one breach becomes five. A password manager is the practical fix.",
        "**Two-factor authentication.** The single largest reduction in risk available to you, and it is free.",
        "**Check session and app access.** Old sessions on devices you no longer own are a forgotten door.",
        "**Know your recovery path.** An account you cannot recover is data you have lost, whichever provider holds it.",
        "**Watch for phishing on shared documents.** A convincing \"you have been sent a document\" login page remains one of the most effective attacks in this category.",
      ],
    },
    {
      type: "note",
      tone: "warning",
      text: "A limitation we should state rather than leave implied: Orindle does not currently offer multi-factor authentication beyond what the underlying identity provider supplies, and does not require step-up verification for sensitive actions such as deleting an account. If MFA is a hard requirement for your organisation, evaluate that before adopting it.",
    },
    { type: "h2", id: "access-controls", text: "Access controls" },
    {
      type: "p",
      text: "Server-side authorisation is the property that matters: every request is checked against who you are and what you may reach, rather than a client being trusted because it sent an identifier. In a well-built system this is enforced in the database with row-level security, so a misconfigured route or a modified client still cannot read another account's rows.",
    },
    {
      type: "p",
      text: "For shared files, the model should be grants and expiring links rather than permanent public URLs. A signed URL that expires in minutes means a file's address is not a durable secret. [Our guide to sharing large files](/blog/how-to-share-large-files-online) goes through the permission settings in more detail.",
    },
    { type: "h2", id: "link-risks", text: "Sharing-link risks" },
    {
      type: "p",
      text: "A public link is a passwordless credential. Anyone who obtains the URL has the access the link grants, and links travel — into chats, ticket systems, email threads, and occasionally into search indexes if the content is public and reachable. The mitigations are unglamorous and effective: set an expiry, use the narrowest permission, prefer per-person grants for anything confidential, and revoke links when the project ends.",
    },
    { type: "h2", id: "compromise", text: "If your account is compromised" },
    {
      type: "steps",
      items: [
        {
          title: "Change the password first",
          text: "From a device you trust. Changing it invalidates the attacker's ability to sign in with the old one, though an already-issued session may persist briefly.",
        },
        {
          title: "Revoke sessions and connected apps",
          text: "Sign out everywhere, then review authorised third-party applications and remove anything you do not recognise.",
        },
        {
          title: "Check sharing",
          text: "Look for new public links, new grants and recently modified folders. Attackers frequently leave a sharing path behind rather than downloading everything at once.",
        },
        {
          title: "Check for data loss",
          text: "Compare against a recent copy if you have one. If files were deleted, the bin may hold them; if they were overwritten, version history may.",
        },
        {
          title: "Enable two-factor if it was off",
          text: "The reason this happened is worth closing before it happens again.",
        },
      ],
    },
    { type: "h2", id: "responsibility", text: "Who is responsible for what" },
    {
      type: "table",
      caption: "The division of responsibility, stated plainly.",
      head: ["The provider is responsible for", "You are responsible for"],
      rows: [
        ["Keeping the service running and data replicated", "Choosing a strong, unique password"],
        ["Encrypting data in transit and at rest", "Enabling two-factor authentication"],
        ["Authorising every request server-side", "Not sharing folders more widely than needed"],
        ["Patching the platform", "Setting expiry on links"],
        ["Storing backups, if that is part of the plan", "Keeping an independent copy of anything irreplaceable"],
      ],
    },
    { type: "h2", id: "recommendations", text: "Practical recommendations" },
    {
      type: "list",
      items: [
        "Use a password manager and give every service its own password.",
        "Turn on two-factor authentication everywhere it is offered.",
        "Set expiry dates on share links, and revoke them when the work is done.",
        "Prefer per-person grants over link sharing for anything confidential.",
        "Do not treat cloud storage as backup — [the difference matters](/blog/cloud-storage-vs-cloud-backup).",
        "If the provider must not be able to read your files, choose an end-to-end encrypted service deliberately, and accept the recovery trade-offs that come with it.",
      ],
    },
    {
      type: "p",
      text: "The honest summary: cloud storage is safe enough that the mainstream objection to it is usually misplaced, and risky enough that the defaults are not where you should leave it. Almost all of the improvement available to you comes from two-factor authentication, unique passwords and disciplined sharing — none of which require changing provider.",
    },
    { type: "h2", id: "sources", text: "Further reading" },
    {
      type: "source",
      label: "OWASP — Authentication cheat sheet",
      href: "https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html",
      note: "Why password reuse and weak recovery are the dominant account-compromise vectors.",
    },
    {
      type: "source",
      label: "NIST — Digital identity guidelines (SP 800-63B)",
      href: "https://pages.nist.gov/800-63-3/sp800-63b.html",
      note: "The standard behind modern password and MFA guidance.",
    },
    {
      type: "source",
      label: "Orindle — Security",
      href: "https://orindle.com/security",
      note: "The controls described on this page, itemised.",
    },
  ],
};
