import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from '@/lib/providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jakarta',
});

export const metadata: Metadata = {
  title: {
    default: 'HMIS - Sistema de Gestion Hospitalaria',
    template: '%s | HMIS',
  },
  description:
    'Sistema integral de gestion hospitalaria. Administre pacientes, citas, historia clinica, facturacion y farmacia en una sola plataforma.',
  keywords: [
    'hospital',
    'gestion hospitalaria',
    'HMIS',
    'historia clinica',
    'pacientes',
    'citas medicas',
    'facturacion',
    'farmacia',
  ],
  authors: [{ name: 'HMIS SaaS' }],
  robots: 'noindex, nofollow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
