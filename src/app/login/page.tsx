'use client';

import { signIn } from 'next-auth/react';
import React from 'react';

export default function Login() {
    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative z-10 animate-fade-in">
            <div className="max-w-md w-full bg-surface p-10 border border-border rounded-sm shadow-2xl space-y-8 text-center">
                <div className="space-y-2">
                    <h1 className="text-4xl font-serif text-white tracking-tight">ArtSpark</h1>
                    <div className="w-12 h-[1px] bg-gold mx-auto opacity-50"></div>
                    <p className="text-sm tracking-widest text-muted uppercase font-sans mt-4">Authorized Access Only</p>
                </div>

                <p className="text-sm text-gray-400 font-sans leading-relaxed">
                    Please sign in to access the AI Art Prompt Generator. Your masterpiece awaits.
                </p>

                <div className="space-y-4 pt-4">
                    <button
                        onClick={() => signIn('google', { callbackUrl: '/' })}
                        className="w-full bg-accent hover:bg-gray-800 text-white border border-border hover:border-gray-500 px-6 py-4 font-sans text-sm tracking-wide rounded-sm transition-all focus:outline-none focus:ring-1 focus:ring-gold"
                    >
                        Continue with Google
                    </button>

                    <button
                        onClick={() => signIn('github', { callbackUrl: '/' })}
                        className="w-full bg-accent hover:bg-gray-800 text-white border border-border hover:border-gray-500 px-6 py-4 font-sans text-sm tracking-wide rounded-sm transition-all focus:outline-none focus:ring-1 focus:ring-gold"
                    >
                        Continue with GitHub
                    </button>
                </div>

                <div className="pt-6 border-t border-border mt-8">
                    <p className="text-xs text-muted font-sans">
                        By continuing, you agree to our Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>
        </div>
    );
}
