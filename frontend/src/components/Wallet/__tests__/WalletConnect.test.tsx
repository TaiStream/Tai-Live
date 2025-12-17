/**
 * Tests for WalletConnect Component
 */
import { render, screen, fireEvent } from '@testing-library/react';
import WalletConnect from '../WalletConnect';

// Mock dapp-kit hooks
const mockDisconnect = jest.fn();
let mockAccount: { address: string } | null = null;

jest.mock('@mysten/dapp-kit', () => ({
    ConnectButton: ({ className }: { className?: string }) => (
        <button className={className} data-testid="connect-button">Connect Wallet</button>
    ),
    useCurrentAccount: () => mockAccount,
    useDisconnectWallet: () => ({ mutate: mockDisconnect }),
}));

jest.mock('@mysten/sui/utils', () => ({
    formatAddress: (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`,
}));

describe('WalletConnect', () => {
    beforeEach(() => {
        mockAccount = null;
        mockDisconnect.mockReset();
    });

    describe('when not connected', () => {
        it('should render ConnectButton', () => {
            render(<WalletConnect />);

            expect(screen.getByTestId('connect-button')).toBeInTheDocument();
            expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
        });

        it('should apply custom className', () => {
            render(<WalletConnect className="custom-class" />);

            expect(screen.getByTestId('connect-button')).toHaveClass('custom-class');
        });
    });

    describe('when connected', () => {
        beforeEach(() => {
            mockAccount = { address: '0x1234567890abcdef' };
        });

        it('should display formatted address', () => {
            render(<WalletConnect />);

            expect(screen.getByText('0x1234...cdef')).toBeInTheDocument();
        });

        it('should show green connection indicator', () => {
            render(<WalletConnect />);

            const indicator = document.querySelector('.bg-green-500');
            expect(indicator).toBeInTheDocument();
        });

        it('should show disconnect button', () => {
            render(<WalletConnect />);

            expect(screen.getByText('Disconnect')).toBeInTheDocument();
        });

        it('should call disconnect when button clicked', () => {
            render(<WalletConnect />);

            const disconnectButton = screen.getByText('Disconnect');
            fireEvent.click(disconnectButton);

            expect(mockDisconnect).toHaveBeenCalled();
        });
    });
});
