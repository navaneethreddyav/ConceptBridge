import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TechnicalTerms from './TechnicalTerms.jsx';

afterEach(cleanup);

const renderAndWaitForLoad = async () => {
    render(<TechnicalTerms onClose={() => {}} />);
    await waitFor(() => expect(screen.queryByText(/Loading glossary/i)).not.toBeInTheDocument());
};

describe('TechnicalTerms search and filtering', () => {
    it('searching "deadlock" surfaces the Operating Systems term', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'deadlock');

        await waitFor(() => expect(screen.getByText('Deadlock')).toBeInTheDocument());
    });

    it('searching "TCP" surfaces the Computer Networks term', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'TCP');

        await waitFor(() => expect(screen.getByText('TCP')).toBeInTheDocument());
    });

    it('search matches an alias, not just the canonical term text', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'DBMS');

        await waitFor(() => expect(screen.getByText('Database Management System')).toBeInTheDocument());
    });

    it('search is case-insensitive', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'GRADIENT DESCENT');

        await waitFor(() => expect(screen.getByText('Gradient Descent')).toBeInTheDocument());
    });

    it('an empty/unknown search shows the "no terms match" state, not an error', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'zzzznotarealterm');

        await waitFor(() => expect(screen.getByText(/No terms match your search/i)).toBeInTheDocument());
    });

    it('filtering by discipline narrows the subject dropdown and results to that discipline', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        const [disciplineSelect] = screen.getAllByRole('combobox');

        await user.selectOptions(disciplineSelect, 'Mechanical Engineering');
        await waitFor(() => expect(screen.getByText(/total|found/i)).toBeInTheDocument());

        // Torque (Mechanical) should be findable; Deadlock (Computer Science) should not.
        await user.type(screen.getByPlaceholderText(/Search technical terms/i), 'torque');
        await waitFor(() => expect(screen.getByText('Torque')).toBeInTheDocument());
    });

    it('a discipline + subject combination narrows results correctly (subject search)', async () => {
        await renderAndWaitForLoad();
        const user = userEvent.setup();
        const [disciplineSelect, subjectSelect] = screen.getAllByRole('combobox');

        await user.selectOptions(disciplineSelect, 'Computer Science');
        await waitFor(() => expect(screen.getByRole('option', { name: 'Operating Systems' })).toBeInTheDocument());
        await user.selectOptions(subjectSelect, 'Operating Systems');

        await waitFor(() => expect(screen.getByText('Deadlock')).toBeInTheDocument());
        expect(screen.queryByText('Torque')).not.toBeInTheDocument();
    });
});
