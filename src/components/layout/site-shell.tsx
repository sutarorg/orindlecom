import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Marketing shell used by every public route.
 *
 * Keeps the header/footer composition identical across pages so the site reads
 * as one product, and gives every page a single `<main id="main">` landmark.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
