import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AppBase Dashboard",
  description: "Admin dashboard for AppBase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
