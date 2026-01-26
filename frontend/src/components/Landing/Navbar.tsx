'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentAccount, useDisconnectWallet, ConnectButton } from '@mysten/dapp-kit';
import {
    Radio,
    LayoutDashboard,
    User,
    Menu,
    X,
    LogOut,
    ChevronDown,
    Wallet,
} from 'lucide-react';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/live', label: 'Browse', icon: <Radio className="w-5 h-5" /> },
    { href: '/live/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { href: '/live/profile', label: 'Profile', icon: <Wallet className="w-5 h-5" /> },
];

export function Navbar() {
    const pathname = usePathname();
    const account = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();

    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-white/5">
            <div className="max-w-7xl mx-auto px-4">
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/live" className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-purple-600 rounded-xl flex items-center justify-center">
                            <Radio className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-white">Tai Live</span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {NAV_ITEMS.map((item) => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/live' && pathname?.startsWith(item.href));
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                                        isActive
                                            ? 'bg-purple-600 text-white'
                                            : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right Side - Wallet & Profile */}
                    <div className="flex items-center gap-3">
                        {/* Go Live Button */}
                        <Link
                            href="/live/dashboard"
                            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition"
                        >
                            <Radio className="w-4 h-4" />
                            <span>Go Live</span>
                        </Link>

                        {/* Wallet / Profile */}
                        {account ? (
                            <div className="relative">
                                <button
                                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition"
                                >
                                    <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="hidden sm:block text-white text-sm">
                                        {account.address.slice(0, 6)}...{account.address.slice(-4)}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-neutral-400" />
                                </button>

                                {/* Profile Dropdown */}
                                {isProfileMenuOpen && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsProfileMenuOpen(false)}
                                        />
                                        <div className="absolute right-0 mt-2 w-56 bg-neutral-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                                            <div className="p-3 border-b border-white/10">
                                                <p className="text-white font-medium">Connected Wallet</p>
                                                <p className="text-neutral-400 text-sm truncate">
                                                    {account.address}
                                                </p>
                                            </div>
                                            <div className="p-2">
                                                <Link
                                                    href="/live/profile"
                                                    onClick={() => setIsProfileMenuOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:bg-white/10 rounded-lg transition"
                                                >
                                                    <User className="w-4 h-4" />
                                                    <span>Profile</span>
                                                </Link>
                                                <Link
                                                    href="/live/dashboard"
                                                    onClick={() => setIsProfileMenuOpen(false)}
                                                    className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:bg-white/10 rounded-lg transition"
                                                >
                                                    <LayoutDashboard className="w-4 h-4" />
                                                    <span>Dashboard</span>
                                                </Link>
                                                <button
                                                    onClick={() => {
                                                        disconnect();
                                                        setIsProfileMenuOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    <span>Disconnect</span>
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <ConnectButton className="!bg-purple-600 !hover:bg-purple-700 !text-white !font-medium !px-4 !py-2 !rounded-lg" />
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-6 h-6" />
                            ) : (
                                <Menu className="w-6 h-6" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t border-white/10">
                        <div className="space-y-1">
                            {NAV_ITEMS.map((item) => {
                                const isActive = pathname === item.href;
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                                            isActive
                                                ? 'bg-purple-600 text-white'
                                                : 'text-neutral-400 hover:text-white hover:bg-white/10'
                                        }`}
                                    >
                                        {item.icon}
                                        <span>{item.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}

export default Navbar;
