import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import VoicePlayer from './VoicePlayer.jsx';

afterEach(cleanup);

class FakeUtterance {
    constructor(text) {
        this.text = text;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
    }
}

const makeFakeSynth = () => ({
    utterances: [],
    getVoices: () => [{ lang: 'en-IN', name: 'Test Voice' }],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    speak(u) {
        this.utterances.push(u);
    },
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn()
});

beforeEach(() => {
    global.SpeechSynthesisUtterance = FakeUtterance;
});

describe('VoicePlayer under React 19 StrictMode (mount -> cleanup -> mount in dev)', () => {
    it('still successfully starts playback after StrictMode\'s double-invoke of the mount effect', async () => {
        // Reproduces the exact QA-found bug: without nulling sessionRef in the mount
        // effect's cleanup, StrictMode's synthetic unmount/remount left `sessionRef`
        // pointing at an already-destroyed TtsSession, so every speak() call silently
        // no-op'd (TtsSession bails out on `this.destroyed`) and the Play button stayed
        // stuck in the loading spinner state forever, with no error.
        const synth = makeFakeSynth();
        global.window.speechSynthesis = synth;

        render(
            <React.StrictMode>
                <VoicePlayer text="A short explanation." language="English" />
            </React.StrictMode>
        );

        await waitFor(() => expect(screen.getByTitle('Play')).not.toBeDisabled());

        await act(async () => {
            screen.getByTitle('Play').click();
        });

        // The real TtsSession.speak() must have actually reached synth.speak() — if the
        // session were destroyed (the bug), utterances would stay empty forever.
        await waitFor(() => expect(synth.utterances.length).toBeGreaterThan(0));

        act(() => {
            synth.utterances[0].onstart();
        });

        expect(await screen.findByTitle('Pause')).toBeInTheDocument();

        delete global.window.speechSynthesis;
    });
});
