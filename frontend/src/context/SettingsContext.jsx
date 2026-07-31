import React, { createContext, useState, useContext, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
    // Default settings
    const [settings, setSettings] = useState({
        language: 'English',
        difficulty: 'Beginner',
        theme: 'dark',
        voice: 'aura-asteria-en', // Default voice
        fontSize: 'normal',
        autoPlayVoice: false
    });

    // Load from local storage
    useEffect(() => {
        const savedSettings = localStorage.getItem('conceptBridgeSettings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (e) {
                console.error('Failed to parse settings');
            }
        }
    }, []);

    // Save to local storage on change
    const updateSettings = (newSettings) => {
        const updated = { ...settings, ...newSettings };
        setSettings(updated);
        localStorage.setItem('conceptBridgeSettings', JSON.stringify(updated));
    };

    return (
        <SettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </SettingsContext.Provider>
    );
};
