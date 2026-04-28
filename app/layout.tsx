import './globals.css';
import type { Metadata } from 'next';
import JsonLd from '@/components/JsonLd';

const OG_TITLE = 'AudFlo – Why Nobody Came After You Launched';
const OG_DESCRIPTION =
  'AudFlo shows solo founders, indie hackers, and vibe coders why nobody came after launch — and what to publish to get discovered.';
const OG_URL = 'https://www.audflo.com';
const OG_IMAGE = 'https://www.audflo.com/og/audflo-preview.png';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.audflo.com'),
  title: OG_TITLE,
  description: OG_DESCRIPTION,
  keywords: [
    'AI visibility',
    'AI search discovery',
    'get discovered by AI',
    'ChatGPT discovery',
    'Perplexity visibility',
    'founder distribution',
    'indie hacker launch',
    'AI citation',
    'content distribution for AI',
    'solo founder growth',
  ],
  openGraph: {
    type: 'website',
    url: OG_URL,
    siteName: 'AudFlo',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'AudFlo – You launched. Nobody came. AudFlo shows why.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    images: [OG_IMAGE],
    creator: '@mattQR',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    other: [
      { rel: 'android-chrome-192x192', url: '/android-chrome-192x192.png' },
      { rel: 'android-chrome-512x512', url: '/android-chrome-512x512.png' },
    ],
  },
  alternates: { canonical: OG_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <JsonLd />
        {/* Explicit OG + Twitter tags for crawlers that don't read Next.js injected meta */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={OG_URL} />
        <meta property="og:title" content={OG_TITLE} />
        <meta property="og:description" content={OG_DESCRIPTION} />
        <meta property="og:image" content={OG_IMAGE} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={OG_TITLE} />
        <meta name="twitter:description" content={OG_DESCRIPTION} />
        <meta name="twitter:image" content={OG_IMAGE} />
        <link rel="canonical" href={OG_URL} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=IBM+Plex+Mono:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
