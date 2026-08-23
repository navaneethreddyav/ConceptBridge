import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Header from './Header.jsx';
import { SettingsProvider } from '../context/SettingsContext.jsx';

afterEach(cleanup);

const renderHeader = () =>
    render(
        <SettingsProvider>
            <Header onHome={() => {}} onOpenGlossary={() => {}} />
        </SettingsProvider>
    );

// Button order in Header.jsx: [0] home/logo, [1] "Technical Terms" glossary, [2] gear.
const getGearButton = () => screen.getAllByRole('button')[2];

describe('Header settings panel', () => {
    it('opens on gear click and the language/difficulty selects become visible', () => {
        renderHeader();
        fireEvent.click(getGearButton());
        expect(screen.getByText('Language')).toBeInTheDocument();
        expect(screen.getByText('Difficulty')).toBeInTheDocument();
    });

    it('closes when clicking outside the panel — the reported "stays open forever" bug', () => {
        renderHeader();
        fireEvent.click(getGearButton());
        expect(screen.getByText('Language')).toBeInTheDocument();

        fireEvent.mouseDown(document.body);

        expect(screen.queryByText('Language')).not.toBeInTheDocument();
    });

    it('does not close when clicking inside the panel (e.g. selecting a language)', () => {
        renderHeader();
        fireEvent.click(getGearButton());

        const languageSelect = screen.getAllByRole('combobox')[0];
        fireEvent.mouseDown(languageSelect);
        fireEvent.change(languageSelect, { target: { value: 'Marathi' } });

        expect(screen.getByText('Language')).toBeInTheDocument();
        expect(languageSelect.value).toBe('Marathi');
    });

    it('still closes via the gear button itself (toggle)', () => {
        renderHeader();
        const gearButton = getGearButton();
        fireEvent.click(gearButton);
        expect(screen.getByText('Language')).toBeInTheDocument();

        fireEvent.click(gearButton);
        expect(screen.queryByText('Language')).not.toBeInTheDocument();
    });
});
