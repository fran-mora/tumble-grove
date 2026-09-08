import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Tumble Grove', description: 'Drop, match, and grow a colourful fruit family. Play Tumble Grove with classic or phone tilt controls, online or offline.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
