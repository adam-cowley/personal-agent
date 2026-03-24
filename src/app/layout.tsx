import type { Metadata } from "next"
import { Public_Sans } from "next/font/google"
import "./globals.css"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/ThemeProvider"
import { ConfigProvider } from "@/components/ConfigProvider"

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: "Elsie — Personal Business Coach",
  description: "AI-powered business coach with graph memory",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${publicSans.variable} h-full antialiased`}>
      <body className="h-full bg-background text-foreground">
        <ThemeProvider>
          <ConfigProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
