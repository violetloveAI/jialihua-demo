import React from 'react';

export function Mark() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M6 19 20 7l14 12v15H6Z" fill="currentColor"/><path d="M20 29s-8-4.7-8-9a4.3 4.3 0 0 1 8-2 4.3 4.3 0 0 1 8 2c0 4.3-8 9-8 9Z" fill="var(--mark-heart, #fff9ef)"/></svg>;
}

export function Portrait({ kind = 'girl', className = '' }) {
  const colors = { girl: ['#efcba5', '#5b4537', '#65785c'], woman: ['#d9e1c2', '#443f39', '#a9674e'], man: ['#d2dfeb', '#343d43', '#3e6975'] };
  const [bg, hair, shirt] = colors[kind];
  return <svg className={`portrait ${className}`} viewBox="0 0 180 180" aria-hidden="true">
    <rect width="180" height="180" rx="34" fill={bg}/>
    <circle cx="145" cy="29" r="39" fill="#fff9e8" opacity=".45"/>
    <path d="M-5 155Q40 122 76 159t110-15v45H-5Z" fill="#fff9e8" opacity=".35"/>
    {kind !== 'man' && <path d="M48 90Q40 28 90 26q53 0 46 64l5 46H43Z" fill={hair}/>}
    <path d="M29 185q2-56 47-58h28q43 4 47 58" fill={shirt}/>
    <path d="M77 109v22q13 16 27 0v-22" fill="#deb08b"/>
    <ellipse cx="90" cy="80" rx="37" ry="46" fill="#f3c9a5"/>
    <path d={kind === 'man' ? 'M51 71q-5-47 43-47 43 1 36 50l-13-28q-31 17-56 7Z' : 'M51 79q-7-53 38-53 50 0 42 62l-12-30q-29 3-45-14Q70 65 51 79Z'} fill={hair}/>
    <path d="M71 80q5-3 10 0m20 0q5-3 10 0" stroke="#4c3b32" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <path d="M79 99q11 12 22 0" stroke="#9a5c45" strokeWidth="3" strokeLinecap="round" fill="none"/>
    <ellipse cx="65" cy="95" rx="8" ry="4" fill="#e6a386" opacity=".7"/><ellipse cx="116" cy="95" rx="8" ry="4" fill="#e6a386" opacity=".7"/>
    {kind === 'girl' && <><path d="m73 130 17 15 17-15" stroke="#ecddc1" strokeWidth="9" fill="none"/><path d="M48 52q-7 22 1 40M132 58q8 17 1 36" stroke={hair} strokeWidth="10" strokeLinecap="round"/></>}
    {kind === 'woman' && <><path d="m74 130 16 18 17-18" fill="#f8eed9"/><circle cx="90" cy="163" r="3" fill="#f8eed9"/></>}
    {kind === 'man' && <><path d="m75 130 15 18 16-18" fill="#eff5ee"/><path d="M67 79h18v12H67Zm29 0h18v12H96Zm-11 4h11" stroke="#465558" strokeWidth="2" fill="none"/></>}
  </svg>;
}

export function LetterArt() {
  return <svg className="letter-art" viewBox="0 0 120 106" fill="none" aria-hidden="true"><path d="m20 30 44-13 44 26-14 51-66-1Z" fill="#f0d8bf"/><path d="m17 45 37-22 49 29-21 41-62-1Z" fill="#fffaf0" stroke="#c39a76" strokeWidth="1.5"/><path d="m17 45 30 26 56-19M20 90l29-23 32 26" stroke="#c39a76" strokeWidth="1.5"/><path d="M66 57s-14-8-11-14c2-4 8-4 10 0 4-4 9-1 8 3-1 6-7 11-7 11" fill="#a84633"/><path d="m91 17 5-8m2 14 10-2m-86 3-3-6" stroke="#a84633" strokeWidth="2" strokeLinecap="round"/></svg>;
}
