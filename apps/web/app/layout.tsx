import type { Metadata } from "next";import "./globals.css";
export const metadata:Metadata={title:"Nexx EventPass",description:"Secure event ticket issuance and QR entry verification"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
