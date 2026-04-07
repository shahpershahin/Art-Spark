'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const ART_STYLES = [
    'Realistic / Photographic', 'Fantasy & Surreal', 'Analog Photography',
    'Monochrome', 'Oil Painting', 'Watercolor', 'Charcoal',
    'Architectural', 'Sketch / Line Art', 'Minimalist', 'Impressionist', 'Dark Academia'
];

const MOODS = [
    'Cinematic', 'Golden Hour', 'Melancholic', 'Misty / Foggy',
    'Dramatic Shadows', 'Ethereal / Dreamy', 'High Contrast', 'Soft & Pastel'
];

const PLATFORMS = ['Midjourney', 'DALL·E', 'Stable Diffusion', 'Universal'];
const COMPLEXITY_LEVELS = ['SIMPLE', 'DETAILED', 'ULTRA-DETAILED'];

export default function PromptGenerator() {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    const [styles, setStyles] = useState<string[]>([]);
    const [moods, setMoods] = useState<string[]>(['Cinematic']);
    const [platform, setPlatform] = useState<string>('Midjourney');
    const [subject, setSubject] = useState<string>('');
    const [complexity, setComplexity] = useState<string>('SIMPLE');

    const [prompt, setPrompt] = useState<string>('');
    const [model, setModel] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);
    const [history, setHistory] = useState<string[]>([]);

    const toggleSelection = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (array.includes(item)) {
            setArray(array.filter(i => i !== item));
        } else {
            setArray([...array, item]);
        }
    };

    const generatePrompt = async () => {
        if (!subject.trim()) {
            setError('Please provide a subject for the artwork.');
            return;
        }

        setLoading(true);
        setError('');
        setCopied(false);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    styles,
                    moods,
                    platform,
                    subject,
                    complexity,
                }),
            });

            if (!response.ok) {
                let errMessage = 'Failed to generate prompt. Please check backend connection.';
                try {
                    const errData = await response.json();
                    if (errData.detail) {
                        errMessage = errData.detail;
                    }
                } catch { }
                throw new Error(errMessage);
            }

            const data = await response.json();
            setPrompt(data.prompt);
            setModel(data.model);

            setHistory(prev => {
                const newHistory = [data.prompt, ...prev];
                return newHistory.slice(0, 10); // Keep last 10
            });
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong.');
            }
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (status === 'loading' || status === 'unauthenticated') {
        return (
            <div className="w-full max-w-4xl mx-auto flex items-center justify-center min-h-[50vh]">
                <span className="spinner w-8 h-8 rounded-full border-2 border-gold border-t-transparent"></span>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col gap-8 duration-500 ease-out opacity-100 transition-opacity relative">
            {/* Header */}
            <div className="text-center space-y-4 mb-8 pt-6 relative">
                <button onClick={() => signOut()} className="absolute top-0 right-0 text-[10px] tracking-widest text-muted hover:text-white transition-colors border border-border px-3 py-1 rounded-sm">SIGN OUT</button>
                <p className="text-xs tracking-widest text-muted uppercase font-sans">AI Art Prompt Creator</p>
                <h1 className="text-5xl md:text-7xl font-serif text-white tracking-tight">ArtSpark</h1>
                <div className="w-16 h-[1px] bg-gold mx-auto opacity-50 mt-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Style Selection */}
                <section className="bg-surface p-6 rounded-sm border border-border">
                    <h2 className="text-sm tracking-widest uppercase text-muted mb-4 font-sans border-b border-border pb-2">Art Style</h2>
                    <div className="flex flex-wrap gap-2">
                        {ART_STYLES.map(s => (
                            <button
                                key={s}
                                onClick={() => toggleSelection(styles, setStyles, s)}
                                className={`text-xs px-3 py-1.5 rounded-sm transition-all duration-300 border ${styles.includes(s) ? 'border-gold text-gold bg-gold/5' : 'border-border text-gray-400 hover:border-gray-300 hover:text-gray-300'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </section>

                {/* Mood Selection */}
                <section className="bg-surface p-6 rounded-sm border border-border">
                    <h2 className="text-sm tracking-widest uppercase text-muted mb-4 font-sans border-b border-border pb-2">Mood & Lighting</h2>
                    <div className="flex flex-wrap gap-2">
                        {MOODS.map(m => (
                            <button
                                key={m}
                                onClick={() => toggleSelection(moods, setMoods, m)}
                                className={`text-xs px-3 py-1.5 rounded-sm transition-all duration-300 border ${moods.includes(m) ? 'border-gray-200 text-white bg-white/5' : 'border-border text-gray-400 hover:border-gray-300 hover:text-gray-300'}`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            {/* Main Input Form */}
            <section className="bg-surface p-6 rounded-sm border border-border shadow-2xl">
                <div className="mb-6">
                    <div className="flex flex-wrap gap-4 mb-4">
                        {PLATFORMS.map(p => (
                            <label key={p} className="flex items-center space-x-2 cursor-pointer group">
                                <div className={`w-3 h-3 rounded-full border transition-all ${platform === p ? 'bg-gold border-gold' : 'border-gray-500 group-hover:border-gray-300'}`}></div>
                                <span className={`text-sm tracking-wide ${platform === p ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}>{p}</span>
                                <input type="radio" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="hidden" />
                            </label>
                        ))}
                    </div>

                    <div className="relative">
                        <textarea
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Describe your subject... (e.g. A vintage pocket watch resting on an old map)"
                            className="w-full bg-accent text-white border border-border p-4 h-32 mt-2 focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all resize-none font-serif text-lg leading-relaxed rounded-sm"
                        />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-border mt-4">
                    <div className="flex space-x-2 w-full md:w-auto">
                        {COMPLEXITY_LEVELS.map(c => (
                            <button
                                key={c}
                                onClick={() => setComplexity(c)}
                                className={`flex-1 md:flex-none text-xs px-4 py-2 border rounded-sm transition-colors tracking-widest ${complexity === c ? 'bg-white text-black border-white font-medium' : 'text-gray-400 border-border hover:border-gray-300 hover:text-gray-200'}`}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={generatePrompt}
                        disabled={loading}
                        className="w-full md:w-48 bg-gold hover:bg-yellow-600 disabled:opacity-50 disabled:hover:bg-gold text-black px-6 py-3 font-medium text-sm tracking-wide rounded-sm transition-all flex justify-center items-center h-12 outline-none"
                    >
                        {loading ? <span className="spinner w-4 h-4 rounded-full border-2 border-black border-t-transparent"></span> : 'GENERATE'}
                    </button>
                </div>
            </section>

            {/* Error Output */}
            {error && (
                <div className="p-4 border border-red-900 bg-red-900/10 text-red-400 text-sm rounded-sm text-center font-sans">
                    {error}
                </div>
            )}

            {/* Result Output */}
            {prompt && (
                <section className="bg-surface p-6 rounded-sm border border-gold/30 mt-4 relative">
                    <h2 className="text-xs tracking-widest uppercase text-gold mb-4 font-sans">Generated Prompt</h2>

                    <p className="font-mono text-sm leading-loose text-gray-200 break-words whitespace-pre-wrap">
                        {prompt}
                    </p>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                        <span className="text-xs text-muted font-sans">Model: {model}</span>
                        <div className="space-x-3">
                            <button
                                onClick={generatePrompt}
                                className="text-xs px-4 py-2 border border-border text-gray-300 hover:text-white hover:border-gray-400 transition-colors rounded-sm tracking-widest"
                            >
                                REGENERATE
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className={`text-xs px-4 py-2 border transition-colors rounded-sm tracking-widest ${copied ? 'bg-green-800 border-green-800 text-white' : 'border-gold text-gold hover:bg-gold hover:text-black'}`}
                            >
                                {copied ? '✓ COPIED' : 'COPY'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* History */}
            {history.length > 0 && (
                <section className="mt-8 space-y-3">
                    <h3 className="text-xs tracking-widest text-muted uppercase font-sans">Recent Prompts</h3>
                    <div className="space-y-2">
                        {history.map((h, i) => (
                            <div key={i} className={`bg-surface p-4 border rounded-sm cursor-pointer transition-colors group ${prompt === h ? 'border-gold' : 'border-border hover:border-gray-500'}`} onClick={() => setPrompt(h)}>
                                <p className={`font-mono text-xs truncate transition-colors ${prompt === h ? 'text-gold' : 'text-gray-400 group-hover:text-gray-300'}`}>{h}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
