import Navbar from '@/components/Landing/Navbar';
import Sidebar from '@/components/Live/Sidebar';

export default function LiveLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-neutral-950">
            <Navbar />
            <Sidebar />
            <main className="pt-20 md:pl-64 min-h-screen">
                {children}
            </main>
        </div>
    );
}
