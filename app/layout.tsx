import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Fruit Merge — One more drop', description: 'Drop fruit, match a pair, and grow your way to a watermelon. A playful fruit merging game for your browser.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
