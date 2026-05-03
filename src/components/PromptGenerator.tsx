'use client';

import React, { useState, useEffect, useRef } from 'react';
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

const CHAOS_SUBJECTS = [
    'A cyberpunk samurai eating noodles',
    'A Victorian lady riding a T-Rex',
    'An astronaut discovering a field of giant glowing mushrooms',
    'A toaster possessed by an ancient demon',
    'A majestic city built entirely out of glass on clouds',
    'A medieval knight in a modern grocery store',
    'A mecha-cat fighting a laser-shark'
];

export default function PromptGenerator() {
    const { status } = useSession();
    const router = useRouter();

    interface HistoryItem {
        id: number;
        prompt: string;
        image_base64: string;
        created_at: string;
    }

    const [dbHistory, setDbHistory] = useState<HistoryItem[]>([]);

    const fetchHistory = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await fetch(`${apiUrl}/history`);
            if (res.ok) {
                const data = await res.json();
                setDbHistory(data);
            }
        } catch (e) {
            console.error("Failed to fetch history", e);
        }
    };

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        } else if (status === 'authenticated') {
            fetchHistory();
        }
    }, [status, router]);

    const [styles, setStyles] = useState<string[]>([]);
    const [moods, setMoods] = useState<string[]>(['Cinematic']);
    const [platform, setPlatform] = useState<string>('Midjourney');
    const [subject, setSubject] = useState<string>('');
    const [complexity, setComplexity] = useState<string>('SIMPLE');

    const [mode, setMode] = useState<'prompt' | 'image'>('prompt');
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [prompt, setPrompt] = useState<string>('');
    const [model, setModel] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [copied, setCopied] = useState<boolean>(false);

    
    // Critique State
    const [critique, setCritique] = useState<string>('');
    const [critiqueLoading, setCritiqueLoading] = useState<boolean>(false);
    const [critiquePersonality, setCritiquePersonality] = useState<string>('Snobby Curator');

    // Slot Machine State
    const [spinning, setSpinning] = useState<boolean>(false);
    const [displaySubject, setDisplaySubject] = useState<string>('???');
    const [displayStyle, setDisplayStyle] = useState<string>('???');
    const [displayMood, setDisplayMood] = useState<string>('???');
    
    // Infinite Universe State
    const [continueLoading, setContinueLoading] = useState<boolean>(false);

    // Evolution Engine State
    const [mutationPrompt, setMutationPrompt] = useState<string>('');
    const [mutateLoading, setMutateLoading] = useState<boolean>(false);
    const [mutatedImage, setMutatedImage] = useState<string | null>(null);
    const [sliderValue, setSliderValue] = useState<number>(50);

    // Comic Book State
    const [appMode, setAppMode] = useState<'prompt' | 'comic'>('prompt');
    const [comicStory, setComicStory] = useState<string>('');
    const [comicLoading, setComicLoading] = useState<boolean>(false);
    const [comicPanels, setComicPanels] = useState<{caption: string, image_base64: string}[]>([]);

    const toggleSelection = (array: string[], setArray: React.Dispatch<React.SetStateAction<string[]>>, item: string) => {
        if (array.includes(item)) {
            setArray(array.filter(i => i !== item));
        } else {
            setArray([...array, item]);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setInputImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleChaos = () => {
        if (spinning || loading) return;
        setSpinning(true);
        
        let spins = 0;
        const maxSpins = 20; // 20 frames of animation
        
        const spinInterval = setInterval(() => {
            setDisplaySubject(CHAOS_SUBJECTS[Math.floor(Math.random() * CHAOS_SUBJECTS.length)]);
            setDisplayStyle(ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)]);
            setDisplayMood(MOODS[Math.floor(Math.random() * MOODS.length)]);
            spins++;
            
            if (spins >= maxSpins) {
                clearInterval(spinInterval);
                
                // Final selection
                const finalSubject = CHAOS_SUBJECTS[Math.floor(Math.random() * CHAOS_SUBJECTS.length)];
                const finalStyle = ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)];
                const finalMood = MOODS[Math.floor(Math.random() * MOODS.length)];
                
                setDisplaySubject(finalSubject);
                setDisplayStyle(finalStyle);
                setDisplayMood(finalMood);
                
                setSubject(finalSubject);
                setStyles([finalStyle]);
                setMoods([finalMood]);
                setComplexity('ULTRA-DETAILED');
                
                setTimeout(() => {
                    setSpinning(false);
                    handleGenerate(finalSubject, mode);
                }, 800); // Wait almost 1 sec to let user read it before auto-generating
            }
        }, 100); // 100ms per frame
    };

    const handleGenerate = async (overrideSubject?: string, overrideMode?: 'prompt' | 'image') => {
        const activeMode = overrideMode || mode;
        const activeSubject = overrideSubject || subject;

        if (!activeSubject.trim()) {
            setError('Please provide a subject or description.');
            return;
        }

        setLoading(true);
        setError('');
        setCopied(false);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            
            if (activeMode === 'prompt') {
                const response = await fetch(`${apiUrl}/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        styles,
                        moods,
                        platform,
                        subject: activeSubject,
                        complexity,
                        image_base64: inputImage
                    }),
                });

                if (!response.ok) {
                    let errMessage = 'Failed to generate prompt. Please check backend connection.';
                    try { const errData = await response.json(); if(errData.detail) errMessage = errData.detail; } catch {}
                    throw new Error(errMessage);
                }

                const data = await response.json();
                setPrompt(data.prompt);
                setModel(data.model);

            } else {
                const fullPrompt = `${activeSubject}. Styles: ${styles.join(', ')}. Moods: ${moods.join(', ')}`;
                const response = await fetch(`${apiUrl}/generate/image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: fullPrompt,
                        aspect_ratio: "1:1"
                    }),
                });

                if (!response.ok) {
                    let errMessage = 'Failed to generate image.';
                    try { const errData = await response.json(); if(errData.detail) errMessage = errData.detail; } catch {}
                    throw new Error(errMessage);
                }

                const data = await response.json();
                setGeneratedImage(`data:image/jpeg;base64,${data.image_base64}`);

                // Save to DB
                try {
                    await fetch(`${apiUrl}/history`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: fullPrompt,
                            image_base64: `data:image/jpeg;base64,${data.image_base64}`
                        })
                    });
                    fetchHistory(); // Refresh history
                } catch (e) {
                    console.error("Failed to save history", e);
                }
            }
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

    const handleCritique = async () => {
        if (!generatedImage) return;
        setCritiqueLoading(true);
        setCritique('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/critique`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: generatedImage,
                    personality: critiquePersonality
                }),
            });
            if (!response.ok) throw new Error('Failed to get critique');
            const data = await response.json();
            setCritique(data.critique);
        } catch (err) {
            console.error(err);
            setCritique("The critic refused to look at this piece due to a server error.");
        } finally {
            setCritiqueLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!generatedImage) return;
        setContinueLoading(true);
        setError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/continue`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: generatedImage
                }),
            });
            if (!response.ok) throw new Error('Failed to expand universe');
            const data = await response.json();
            
            setPrompt(data.prompt);
            setGeneratedImage(`data:image/jpeg;base64,${data.image_base64}`);
            setCritique(''); // Clear old critique
            
            // Save new step to DB
            try {
                await fetch(`${apiUrl}/history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: data.prompt,
                        image_base64: `data:image/jpeg;base64,${data.image_base64}`
                    })
                });
                fetchHistory(); // Refresh history
            } catch (e) {
                console.error("Failed to save history", e);
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong.');
            }
        } finally {
            setContinueLoading(false);
        }
    };

    const handleMutate = async () => {
        if (!generatedImage || !mutationPrompt.trim()) return;
        setMutateLoading(true);
        setError('');
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/mutate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_base64: generatedImage,
                    mutation_prompt: mutationPrompt
                }),
            });
            if (!response.ok) throw new Error('Failed to mutate image');
            const data = await response.json();
            
            setMutatedImage(`data:image/jpeg;base64,${data.image_base64}`);
            setPrompt(data.prompt);
            setCritique('');
            
            // Save mutated step to DB
            try {
                await fetch(`${apiUrl}/history`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: data.prompt,
                        image_base64: `data:image/jpeg;base64,${data.image_base64}`
                    })
                });
                fetchHistory(); // Refresh history
            } catch (e) {
                console.error("Failed to save history", e);
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong.');
            }
        } finally {
            setMutateLoading(false);
        }
    };

    const handleGenerateComic = async () => {
        if (!comicStory.trim()) {
            setError('Please provide a story for the comic.');
            return;
        }
        setComicLoading(true);
        setError('');
        setComicPanels([]);
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${apiUrl}/comic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    story: comicStory
                }),
            });
            if (!response.ok) throw new Error('Failed to generate comic');
            const data = await response.json();
            
            const panels = data.panels.map((p: { caption: string, image_base64: string }) => ({
                caption: p.caption,
                image_base64: `data:image/jpeg;base64,${p.image_base64}`
            }));
            
            setComicPanels(panels);
            
            // Optionally save the first panel to history as a representation
            if (panels.length > 0) {
                try {
                    await fetch(`${apiUrl}/history`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: `Comic: ${panels[0].caption}`,
                            image_base64: panels[0].image_base64
                        })
                    });
                    fetchHistory();
                } catch {}
            }
            
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Something went wrong.');
            }
        } finally {
            setComicLoading(false);
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
            <div className="text-center space-y-4 mb-4 pt-6 relative">
                <button onClick={() => signOut()} className="absolute top-0 right-0 text-[10px] tracking-widest text-muted hover:text-white transition-colors border border-border px-3 py-1 rounded-sm">SIGN OUT</button>
                <p className="text-xs tracking-widest text-muted uppercase font-sans">AI Art Prompt Creator</p>
                <h1 className="text-5xl md:text-7xl font-serif text-white tracking-tight">ArtSpark</h1>
                <div className="w-16 h-[1px] bg-gold mx-auto opacity-50 mt-4"></div>
            </div>

            {/* App Mode Toggle */}
            <div className="flex justify-center mb-2">
                <div className="flex bg-black rounded-sm border border-gold/50 p-1 space-x-1 shadow-[0_0_15px_rgba(255,215,0,0.2)]">
                    <button 
                        onClick={() => setAppMode('prompt')} 
                        className={`text-sm px-8 py-3 rounded-sm transition-all tracking-widest uppercase font-serif ${appMode === 'prompt' ? 'bg-gold text-black font-bold' : 'text-gold hover:bg-gold/10'}`}
                    >
                        🎨 Prompt Studio
                    </button>
                    <button 
                        onClick={() => setAppMode('comic')} 
                        className={`text-sm px-8 py-3 rounded-sm transition-all tracking-widest uppercase font-serif ${appMode === 'comic' ? 'bg-gold text-black font-bold' : 'text-gold hover:bg-gold/10'}`}
                    >
                        📖 Comic Creator
                    </button>
                </div>
            </div>

            {appMode === 'prompt' && (
                <>
                {/* Mode Toggle */}
            <div className="flex justify-center mb-6">
                <div className="flex bg-accent rounded-sm border border-border p-1 space-x-1">
                    <button 
                        onClick={() => setMode('prompt')} 
                        className={`text-xs px-6 py-2.5 rounded-sm transition-all tracking-widest uppercase ${mode === 'prompt' ? 'bg-gold text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        ✨ Prompt Alchemy
                    </button>
                    <button 
                        onClick={() => setMode('image')} 
                        className={`text-xs px-6 py-2.5 rounded-sm transition-all tracking-widest uppercase ${mode === 'image' ? 'bg-gold text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        🖼️ Image Generation
                    </button>
                </div>
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

                    {/* SLOT MACHINE UI */}
                    <div className={`transition-all duration-500 overflow-hidden ${spinning ? 'max-h-[500px] opacity-100 mb-6' : 'max-h-0 opacity-0 mb-0'}`}>
                        <div className="bg-black border border-purple-500/50 rounded-sm p-6 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                            <h3 className="text-center text-purple-400 font-sans tracking-[0.2em] uppercase text-xs mb-6 animate-pulse">🎰 Synthesizing Chaos 🎰</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                <div className="bg-accent p-4 border border-border rounded-sm">
                                    <p className="text-xs text-muted tracking-widest uppercase mb-2">Subject</p>
                                    <p className="font-serif text-white truncate">{displaySubject}</p>
                                </div>
                                <div className="bg-accent p-4 border border-border rounded-sm">
                                    <p className="text-xs text-muted tracking-widest uppercase mb-2">Style</p>
                                    <p className="font-serif text-white truncate">{displayStyle}</p>
                                </div>
                                <div className="bg-accent p-4 border border-border rounded-sm">
                                    <p className="text-xs text-muted tracking-widest uppercase mb-2">Mood</p>
                                    <p className="font-serif text-white truncate">{displayMood}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder={mode === 'prompt' ? "Describe your subject... OR upload an image to reverse-engineer it!" : "Describe exactly what you want to see generated..."}
                            className="w-full bg-accent text-white border border-border p-4 h-32 mt-2 focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all resize-none font-serif text-lg leading-relaxed rounded-sm"
                        />
                        {mode === 'prompt' && (
                            <div className="absolute right-4 bottom-4 flex items-center gap-2">
                                {inputImage && (
                                    <div className="relative w-10 h-10 border border-gold rounded-sm overflow-hidden group">
                                        <img src={inputImage} alt="Reference" className="w-full h-full object-cover" />
                                        <button onClick={() => setInputImage(null)} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-sans">
                                            ✕
                                        </button>
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    ref={fileInputRef} 
                                    onChange={handleImageUpload} 
                                    className="hidden" 
                                />
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-10 h-10 flex items-center justify-center bg-surface border border-border text-gray-400 hover:text-gold hover:border-gold transition-colors rounded-sm"
                                    title="Upload Reference Image"
                                >
                                    📷
                                </button>
                            </div>
                        )}
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

                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={handleChaos}
                            disabled={loading || spinning}
                            className={`w-full md:w-48 border px-6 py-3 font-medium text-sm tracking-wide rounded-sm transition-all flex justify-center items-center h-12 outline-none group ${spinning ? 'border-purple-500 bg-purple-500/20 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'border-purple-500/50 hover:border-purple-500 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 disabled:opacity-50'}`}
                            title="Randomize everything and generate!"
                        >
                            <span className={`${spinning ? 'animate-spin' : 'group-hover:animate-spin'} mr-2`}>🎲</span> {spinning ? 'SPINNING...' : 'CHAOS ROULETTE'}
                        </button>
                        <button
                            onClick={() => handleGenerate()}
                            disabled={loading}
                            className="w-full md:w-48 bg-gold hover:bg-yellow-600 disabled:opacity-50 disabled:hover:bg-gold text-black px-6 py-3 font-medium text-sm tracking-wide rounded-sm transition-all flex justify-center items-center h-12 outline-none"
                        >
                            {loading ? <span className="spinner w-4 h-4 rounded-full border-2 border-black border-t-transparent"></span> : (mode === 'prompt' ? 'GENERATE PROMPT' : 'GENERATE IMAGE')}
                        </button>
                    </div>
                </div>
            </section>

            {/* Error Output */}
            {error && (
                <div className="p-4 border border-red-900 bg-red-900/10 text-red-400 text-sm rounded-sm text-center font-sans">
                    {error}
                </div>
            )}

            {/* Result Output */}
            {mode === 'prompt' && prompt && (
                <section className="bg-surface p-6 rounded-sm border border-gold/30 mt-4 relative animate-fade-in">
                    <h2 className="text-xs tracking-widest uppercase text-gold mb-4 font-sans">Generated Prompt</h2>

                    <p className="font-mono text-sm leading-loose text-gray-200 break-words whitespace-pre-wrap">
                        {prompt}
                    </p>

                    <div className="flex flex-wrap items-center justify-between mt-6 pt-4 border-t border-border gap-4">
                        <span className="text-xs text-muted font-sans">Model: {model}</span>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => {
                                    setMode('image');
                                    setSubject(prompt);
                                    handleGenerate(prompt, 'image');
                                }}
                                className="text-xs px-4 py-2 bg-gold/10 border border-gold text-gold hover:bg-gold hover:text-black transition-all rounded-sm tracking-widest font-semibold"
                            >
                                🎨 GENERATE IMAGE
                            </button>
                            <button
                                onClick={() => handleGenerate()}
                                className="text-xs px-4 py-2 border border-border text-gray-300 hover:text-white hover:border-gray-400 transition-colors rounded-sm tracking-widest"
                            >
                                REGENERATE
                            </button>
                            <button
                                onClick={copyToClipboard}
                                className={`text-xs px-4 py-2 border transition-colors rounded-sm tracking-widest ${copied ? 'bg-green-800 border-green-800 text-white' : 'border-gold/50 text-gold/80 hover:border-gold hover:text-gold'}`}
                            >
                                {copied ? '✓ COPIED' : 'COPY'}
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {mode === 'image' && generatedImage && (
                <section className="bg-surface p-6 rounded-sm border border-gold/30 mt-4 text-center animate-fade-in">
                    <h2 className="text-xs tracking-widest uppercase text-gold mb-4 font-sans">Generated Image</h2>
                    <div className="w-full max-w-2xl mx-auto rounded-sm overflow-hidden shadow-2xl border border-border bg-black min-h-[300px] flex items-center justify-center relative select-none">
                        {mutatedImage ? (
                            <div className="relative w-full h-auto aspect-square overflow-hidden group">
                                <img src={mutatedImage} alt="Mutated Art" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" />
                                <div 
                                    className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-gold shadow-[2px_0_10px_rgba(255,215,0,0.5)] pointer-events-none"
                                    style={{ width: `${sliderValue}%` }}
                                >
                                    <img src={generatedImage} alt="Original Art" className="absolute top-0 left-0 w-full h-full object-contain pointer-events-none" style={{ width: '100%', maxWidth: 'none', objectPosition: 'left' }} />
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="100" 
                                    value={sliderValue} 
                                    onChange={(e) => setSliderValue(Number(e.target.value))}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10"
                                />
                                <div className="absolute top-4 left-4 bg-black/60 text-white text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest pointer-events-none">Original</div>
                                <div className="absolute top-4 right-4 bg-black/60 text-gold text-[10px] px-2 py-1 rounded-sm uppercase tracking-widest pointer-events-none">Mutated</div>
                            </div>
                        ) : (
                            <img src={generatedImage} alt="Generated Art" className="w-full h-auto object-contain" />
                        )}
                    </div>
                    
                    <div className="mt-8 p-6 bg-black/30 border border-gold/20 rounded-sm">
                        <h3 className="text-xs tracking-widest uppercase text-gold mb-4 font-sans">🧬 The Evolution Engine</h3>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <input
                                type="text"
                                value={mutationPrompt}
                                onChange={(e) => setMutationPrompt(e.target.value)}
                                placeholder="E.g., 'Make it cyberpunk', 'Add heavy rain'"
                                className="flex-1 bg-accent text-white border border-border p-3 focus:ring-1 focus:ring-gold outline-none w-full"
                            />
                            <button
                                onClick={handleMutate}
                                disabled={mutateLoading || !mutationPrompt.trim()}
                                className="w-full sm:w-auto px-6 py-3 bg-gold/10 border border-gold hover:bg-gold text-gold hover:text-black transition-all rounded-sm tracking-widest uppercase font-bold disabled:opacity-50"
                            >
                                {mutateLoading ? <span className="spinner w-4 h-4 rounded-full border-2 border-gold border-t-transparent"></span> : 'Mutate'}
                            </button>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                        <button 
                            onClick={handleContinue}
                            disabled={continueLoading}
                            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-500/50 text-purple-200 hover:text-white hover:border-purple-400 transition-all rounded-sm tracking-widest uppercase font-bold shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {continueLoading ? <span className="spinner w-4 h-4 rounded-full border-2 border-purple-400 border-t-transparent"></span> : '🌌 Expand The Universe (What Happens Next?)'}
                        </button>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                        <button 
                            onClick={() => {
                                setMode('prompt');
                                setPrompt(''); // Clear current prompt result so it doesn't show old one
                                setMutatedImage(null);
                            }} 
                            className="text-xs px-8 py-4 border border-gold/50 text-gold hover:text-white hover:border-gold transition-colors rounded-sm tracking-widest uppercase font-medium"
                        >
                            ✨ Refine Prompt
                        </button>
                        <button onClick={() => handleGenerate()} className="text-xs px-8 py-4 border border-border text-gray-300 hover:text-white hover:border-gray-400 transition-colors rounded-sm tracking-widest uppercase">
                            REGENERATE
                        </button>
                        <a href={generatedImage} download="artspark_generation.jpg" className="text-xs px-8 py-4 bg-gold text-black transition-colors rounded-sm tracking-widest hover:bg-yellow-600 font-semibold shadow-[0_0_15px_rgba(212,175,55,0.3)] uppercase">
                            ⬇ DOWNLOAD HD IMAGE
                        </a>
                    </div>

                    {/* Art Critic Section */}
                    <div className="mt-8 pt-8 border-t border-border">
                        <h3 className="text-xs tracking-widest uppercase text-muted mb-4 font-sans">🎭 The Art Critic</h3>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-4">
                            <select 
                                value={critiquePersonality}
                                onChange={(e) => setCritiquePersonality(e.target.value)}
                                className="bg-accent text-white border border-border px-4 py-3 text-sm rounded-sm outline-none focus:border-gold transition-colors"
                            >
                                <option value="Snobby Curator">🍷 Snobby Curator</option>
                                <option value="Aggressive Roaster">🔥 Aggressive Roaster</option>
                                <option value="Supportive Bob Ross">🎨 Supportive Bob Ross</option>
                            </select>
                            <button 
                                onClick={handleCritique}
                                disabled={critiqueLoading}
                                className="w-full sm:w-auto px-6 py-3 border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 transition-colors rounded-sm text-sm tracking-widest uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {critiqueLoading ? <span className="spinner w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent"></span> : 'Critique My Art'}
                            </button>
                        </div>
                        {critique && (
                            <div className="bg-black/50 border border-blue-500/30 p-6 rounded-sm max-w-2xl mx-auto animate-fade-in text-left">
                                <p className="text-gray-300 font-serif leading-relaxed italic text-lg">&quot;{critique}&quot;</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* 3D Metaverse Gallery */}
            {mode === 'prompt' && dbHistory.length > 0 && (
                <section className="mt-12">
                    <h3 className="text-xs tracking-widest text-muted uppercase font-sans mb-6 text-center">🌌 The Metaverse Gallery 🌌</h3>
                    <div className="columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4">
                        {dbHistory.map((item) => (
                            <div key={item.id} className="relative group overflow-hidden rounded-sm border border-border bg-black break-inside-avoid">
                                <img 
                                    src={item.image_base64} 
                                    alt={item.prompt} 
                                    className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-700 ease-out"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                                    <p className="text-white font-mono text-xs line-clamp-3 leading-relaxed">
                                        {item.prompt}
                                    </p>
                                    <button 
                                        onClick={() => {
                                            setMode('image');
                                            setPrompt(item.prompt);
                                            setGeneratedImage(item.image_base64);
                                        }}
                                        className="mt-3 w-full bg-gold/20 text-gold border border-gold hover:bg-gold hover:text-black py-2 text-[10px] tracking-widest font-bold uppercase transition-colors rounded-sm"
                                    >
                                        View
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
            </>
            )}

            {/* COMIC CREATOR UI */}
            {appMode === 'comic' && (
                <section className="bg-surface p-6 rounded-sm border border-border shadow-2xl animate-fade-in text-center">
                    <h2 className="text-xs tracking-widest uppercase text-gold mb-6 font-sans">📖 The Comic Book Generator</h2>
                    
                    <textarea
                        value={comicStory}
                        onChange={(e) => setComicStory(e.target.value)}
                        placeholder="Write a short story... (e.g. 'A detective investigates a murder on a space station...')"
                        className="w-full bg-accent text-white border border-border p-4 h-32 focus:ring-1 focus:ring-gold focus:border-gold outline-none transition-all resize-none font-serif text-lg leading-relaxed rounded-sm mb-6"
                    />

                    <button
                        onClick={handleGenerateComic}
                        disabled={comicLoading}
                        className="w-full md:w-64 mx-auto bg-gold hover:bg-yellow-600 disabled:opacity-50 disabled:hover:bg-gold text-black px-6 py-4 font-medium text-sm tracking-widest uppercase rounded-sm transition-all flex justify-center items-center outline-none shadow-[0_0_20px_rgba(255,215,0,0.3)] mb-12"
                    >
                        {comicLoading ? <span className="spinner w-5 h-5 rounded-full border-2 border-black border-t-transparent"></span> : 'GENERATE COMIC'}
                    </button>

                    {comicPanels.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black p-4 border-4 border-black outline outline-2 outline-white rounded-sm shadow-2xl max-w-5xl mx-auto">
                            {comicPanels.map((panel, idx) => (
                                <div key={idx} className="relative bg-white p-2 border-2 border-black flex flex-col group">
                                    <div className="overflow-hidden border border-black flex-1">
                                        <img 
                                            src={panel.image_base64} 
                                            alt={panel.caption} 
                                            className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                                        />
                                    </div>
                                    <div className="bg-white px-3 py-4 border-t-2 border-black mt-2 text-center min-h-[60px] flex items-center justify-center">
                                        <p className="font-sans font-bold text-black text-sm uppercase tracking-wide leading-snug">
                                            {panel.caption}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
