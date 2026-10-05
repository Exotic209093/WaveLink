/**
 * Wavey — WaveLink's mascot. A decorative inline SVG used in empty and
 * success states. It is hidden from assistive technology; the surrounding
 * text always carries the meaning. Motion (idle bob, blink, wave) is pure CSS
 * and is disabled under prefers-reduced-motion.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState } from 'preact/hooks';

export type WaveyMood = 'wave' | 'happy' | 'curious';

let instanceCount = 0;

export function Wavey(props: { mood?: WaveyMood; size?: number; class?: string }): VNode {
  const mood = props.mood ?? 'wave';
  const size = props.size ?? 88;
  // Gradient and clip-path ids must be unique when several instances render.
  const [id] = useState(() => `wl-wavey-${++instanceCount}`);
  const happy = mood === 'happy';
  const body = 'M110 42 C156 42 188 82 188 134 C188 186 154 216 110 216 C66 216 32 186 32 134 C32 82 64 42 110 42 Z';

  return (
    <svg
      class={`wl-wavey wl-wavey--${mood}${props.class ? ` ${props.class}` : ''}`}
      viewBox="0 0 220 240"
      width={size}
      height={Math.round(size * 240 / 220)}
      aria-hidden="true"
      focusable="false"
      data-mood={mood}
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#48cae4" /><stop offset="100%" stop-color="#0284a8" />
        </linearGradient>
        <linearGradient id={`${id}-crest`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#9ee6f3" /><stop offset="100%" stop-color="#48cae4" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path d={body} /></clipPath>
      </defs>
      <ellipse class="wl-wavey__shadow" cx="110" cy="230" rx="62" ry="8" />
      <g class="wl-wavey__root">
        <g class="wl-wavey__armL">
          <rect x="14" y="132" width="24" height="52" rx="12" fill="#0e8fb2" transform={happy ? 'rotate(105 30 140)' : 'rotate(28 30 140)'} />
        </g>
        <g class="wl-wavey__armR">
          <rect x="182" y="132" width="24" height="52" rx="12" fill="#0e8fb2" transform={happy ? 'rotate(-105 190 140)' : 'rotate(-28 190 140)'} />
        </g>
        <path d="M88 64 C90 30 124 10 146 22 C158 29 158 45 147 50 C141 39 128 37 123 49 C119 57 106 62 88 64 Z" fill={`url(#${id}-crest)`} />
        <path d={body} fill={`url(#${id}-body)`} />
        <g clip-path={`url(#${id}-clip)`}>
          <path d="M40 176 C56 160 72 160 84 176 S112 192 128 176 S156 160 176 170" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".9" />
          <path d="M40 196 C56 182 72 182 84 196 S112 210 128 196 S156 182 176 190" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".45" />
          <ellipse cx="78" cy="78" rx="26" ry="14" fill="#fff" opacity=".18" transform="rotate(-24 78 78)" />
        </g>
        <ellipse cx="72" cy="140" rx="11" ry="6" fill="#ffc2cc" opacity=".7" />
        <ellipse cx="148" cy="140" rx="11" ry="6" fill="#ffc2cc" opacity=".7" />
        <g class="wl-wavey__eyes">
          <ellipse cx="88" cy="116" rx="10" ry="13" fill="#132029" />
          <ellipse cx="132" cy="116" rx="10" ry="13" fill="#132029" />
          <g transform={mood === 'curious' ? 'translate(3 -3)' : undefined}>
            <circle cx="84" cy="111" r="3.6" fill="#fff" /><circle cx="128" cy="111" r="3.6" fill="#fff" />
          </g>
        </g>
        {happy
          ? <path d="M96 139 Q110 160 124 139 Z" fill="#132029" />
          : mood === 'curious'
            ? <ellipse cx="110" cy="144" rx="6" ry="7" fill="#132029" />
            : <path d="M98 140 Q110 152 122 140" fill="none" stroke="#132029" stroke-width="4.5" stroke-linecap="round" />}
      </g>
    </svg>
  );
}
