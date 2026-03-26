import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata = {
  title: "Mind's Eye Status",
  description: 'Sales Performance Dashboard',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Sidebar />
        <main className="ml-[72px] min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
