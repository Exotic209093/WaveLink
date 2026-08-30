import { h } from 'preact';
import type { VNode } from 'preact';

export type IconName =
  | 'activity' | 'advanced' | 'arrow-down' | 'arrow-up' | 'calendar'
  | 'compare' | 'convert' | 'database' | 'file' | 'folder' | 'home'
  | 'import' | 'export' | 'moon' | 'refresh' | 'search' | 'settings'
  | 'shield' | 'sparkles' | 'sun' | 'play' | 'pause';

const PATHS: Record<IconName, VNode> = {
  activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
  advanced: <><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /><circle cx="12" cy="12" r="3" /></>,
  'arrow-down': <><path d="M12 3v15M6 12l6 6 6-6" /></>,
  'arrow-up': <><path d="M12 21V6M6 12l6-6 6 6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  compare: <><path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" /></>,
  convert: <><path d="m7 7-4 4 4 4M3 11h13a5 5 0 0 1 5 5M17 17l4-4M21 13v5" /></>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
  file: <><path d="M6 2h8l4 4v16H6zM14 2v5h5" /></>,
  folder: <><path d="M3 6h7l2 2h9v11H3z" /></>,
  home: <><path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7" /></>,
  import: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></>,
  export: <><path d="M12 16V4M7 9l5-5 5 5M4 21h16" /></>,
  moon: <><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5M6.1 8a7 7 0 0 1 11.7-2.6L20 8M4 16l2.2 2.6A7 7 0 0 0 17.9 16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.7.6 1 .3.3.7.4 1.1.4H21v4h-.09c-.6 0-1.1.2-1.51.6Z" /></>,
  shield: <><path d="M12 2 4 5v6c0 5 3.4 9 8 11 4.6-2 8-6 8-11V5z" /><path d="m9 12 2 2 4-4" /></>,
  sparkles: <><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8zM19 13l.7 1.8 1.8.7-1.8.7L19 18l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  play: <><path d="m8 5 11 7-11 7z" /></>,
  pause: <><path d="M8 5v14M16 5v14" /></>,
};

export function Icon(props: { name: IconName; size?: number; label?: string; class?: string }): VNode {
  const size = props.size ?? 20;
  return (
    <svg
      class={props.class}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      role={props.label ? 'img' : undefined}
      aria-label={props.label}
      aria-hidden={props.label ? undefined : 'true'}
    >
      {PATHS[props.name]}
    </svg>
  );
}
