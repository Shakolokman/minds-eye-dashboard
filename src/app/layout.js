import './globals.css';
import Sidebar from '@/components/Sidebar';
import NotificationBell from '@/components/NotificationBell';

export const metadata = {
  title: "Mind's Eye Status",
  description: 'Sales Performance Dashboard',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#151E24',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Sidebar />
        <NotificationBell />
        <main className="md:ml-[72px] min-h-screen pb-24 md:pb-0">
          {children}
        </main>
      </body>
    </html>
  );
}
