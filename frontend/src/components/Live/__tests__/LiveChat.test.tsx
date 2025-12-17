/**
 * Tests for LiveChat Component
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LiveChat from '../LiveChat';

// Mock the Surflux client
jest.mock('@/utils/surfluxClient', () => ({
    subscribeToPackageEvents: jest.fn(() => jest.fn()),
    TAI_EVENTS: {
        TIP_SENT: 'tai::tipping::TipSent',
    },
}));

// Mock environment variables
process.env.NEXT_PUBLIC_SURFLUX_API_KEY = undefined;
process.env.NEXT_PUBLIC_TAI_PACKAGE_ID = undefined;

describe('LiveChat', () => {
    it('should render chat header', () => {
        render(<LiveChat />);

        expect(screen.getByText('Stream Chat')).toBeInTheDocument();
    });

    it('should display initial mock messages', () => {
        render(<LiveChat />);

        expect(screen.getByText(/SuiFan99/)).toBeInTheDocument();
        expect(screen.getByText(/This stream is amazing/)).toBeInTheDocument();
    });

    it('should have a message input field', () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...');
        expect(input).toBeInTheDocument();
    });

    it('should allow typing in the input', () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...') as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'Hello world!' } });

        expect(input.value).toBe('Hello world!');
    });

    it('should send a message when form is submitted', async () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...');
        const form = input.closest('form')!;

        fireEvent.change(input, { target: { value: 'Test message' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText('Test message')).toBeInTheDocument();
        });
    });

    it('should show "You" as sender for user messages', async () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...');
        const form = input.closest('form')!;

        fireEvent.change(input, { target: { value: 'My message' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(screen.getByText('You:')).toBeInTheDocument();
        });
    });

    it('should clear input after sending', async () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...') as HTMLInputElement;
        const form = input.closest('form')!;

        fireEvent.change(input, { target: { value: 'Test' } });
        fireEvent.submit(form);

        await waitFor(() => {
            expect(input.value).toBe('');
        });
    });

    it('should not send empty messages', () => {
        render(<LiveChat />);

        const input = screen.getByPlaceholderText('Send a message...');
        const form = input.closest('form')!;

        // Count initial messages
        const initialMessages = screen.getAllByText(/:/);

        // Try to submit empty form
        fireEvent.submit(form);

        // Should have same number of messages
        expect(screen.getAllByText(/:/)).toHaveLength(initialMessages.length);
    });

    it('should show connection status', () => {
        render(<LiveChat />);

        expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show viewer count', () => {
        render(<LiveChat />);

        expect(screen.getByText('1.2k')).toBeInTheDocument();
    });
});
