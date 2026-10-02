import type { Metadata } from "next";
import { Inter, Kanit } from "next/font/google";
import { IntlProvider } from "@/components/intl-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
});

const kanit = Kanit({
  variable: "--font-kanit",
  weight: ["400", "500", "700", "800"],
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "Depad",
  description: "Depad — mousepads and peripherals",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${kanit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <IntlProvider>{children}</IntlProvider>
      </body>
    </html>
  );
}
