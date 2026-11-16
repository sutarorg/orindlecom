import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Orindle — Your files. Your world. One simple place.", template: "%s · Orindle" },
  description: "Store, access and share your files from anywhere. A simpler way to keep everything together.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
