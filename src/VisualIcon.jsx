import React from 'react';

// Original UI pictograms. Colors and materials are defined by each prototype theme.
export default function VisualIcon({ kind = 'voice', className = '' }) {
  return <svg className={`visual-icon ${className}`} viewBox="0 0 80 80" fill="none" aria-hidden="true">
    <g stroke="var(--icon-line, currentColor)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'voice' && <><path d="M10 31h14L44 15v50L24 50H10Z" fill="var(--icon-fill, #f3c36c)"/><path d="m25 31 19-16v50L25 50Z" fill="var(--icon-accent, #ef9e56)"/><path d="M56 28q13 12 0 24M64 17q24 23 0 46"/><path d="M16 37v7" stroke="var(--icon-shine, #fff)"/></>}
      {kind === 'image' && <><rect x="17" y="10" width="51" height="55" rx="8" fill="var(--icon-accent, #ef9e56)" transform="rotate(8 42 38)"/><rect x="9" y="19" width="52" height="53" rx="8" fill="var(--icon-fill, #f3c36c)"/><circle cx="45" cy="34" r="6" fill="var(--icon-shine, #fff)" stroke="none"/><path d="m11 60 15-18 12 13 9-9 12 14v5q0 5-6 5H17q-6 0-6-5Z" fill="var(--icon-accent, #ef9e56)"/><path d="m65 8 3-5m4 13 5-1"/></>}
      {kind === 'mic' && <><rect x="28" y="8" width="25" height="45" rx="12.5" fill="var(--icon-fill, #f3c36c)"/><path d="M18 37v5a22 22 0 0 0 44 0v-5M40 64v9M29 73h22"/><path d="M34 18h12M34 27h12M34 36h12" stroke="var(--icon-accent, #ef9e56)"/></>}
      {kind === 'mail' && <><path d="m9 28 30-19 31 19v37H9Z" fill="var(--icon-accent, #ef9e56)"/><rect x="21" y="14" width="38" height="43" rx="4" fill="var(--icon-shine, #fff)"/><path d="M29 25h22M29 33h15"/><path d="m9 29 30 20 31-20v37H9Z" fill="var(--icon-fill, #f3c36c)"/><path d="m10 64 21-21m38 21L48 43"/><path d="M40 60s-9-5-9-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5-9 10-9 10Z" fill="var(--icon-accent, #ef9e56)" strokeWidth="2"/></>}
      {kind === 'home' && <><path d="M14 35v35h52V35L40 12Z" fill="var(--icon-fill, #f3c36c)"/><path d="m7 37 33-28 33 28" strokeWidth="6"/><path d="M31 70V47h18v23" fill="var(--icon-accent, #ef9e56)"/><path d="M57 16V9h9v15"/></>}
      {kind === 'help' && <><path d="M12 15h56v43H37L21 72V58h-9Z" fill="var(--icon-fill, #f3c36c)"/><path d="M32 29a9 9 0 0 1 18 0c0 7-10 7-10 13" strokeWidth="5"/><circle cx="40" cy="50" r="2.5" fill="var(--icon-line, currentColor)" stroke="none"/></>}
      {kind === 'heart' && <><path d="M40 67S9 50 9 29a17 17 0 0 1 31-9 17 17 0 0 1 31 9c0 21-31 38-31 38Z" fill="var(--icon-fill, #f3c36c)"/><path d="M20 30q0-10 10-10" stroke="var(--icon-shine, #fff)" strokeWidth="5"/></>}
      {kind === 'play' && <><circle cx="40" cy="40" r="31" fill="var(--icon-fill, #f3c36c)"/><path d="m34 25 21 15-21 15Z" fill="var(--icon-accent, #ef9e56)"/><path d="M19 36q1-14 14-18" stroke="var(--icon-shine, #fff)"/></>}
    </g>
  </svg>;
}
