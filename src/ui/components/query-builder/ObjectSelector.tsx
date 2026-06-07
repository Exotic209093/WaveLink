import type { VNode } from 'preact';
import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { DescribeGlobalSObject } from '../../../services/salesforce/api-client';
import { fuzzyFilter } from '../../utils/fuzzyMatch';

export function ObjectSelector(props: {
  objects: DescribeGlobalSObject[];
  loading: boolean;
  value: string;
  onChange: (objectName: string) => void;
}): VNode {
  const { objects, loading, value, onChange } = props;
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => fuzzyFilter(objects, search, o => o.name).slice(0, 80),
    [objects, search],
  );

  function select(name: string): void {
    onChange(name);
    setSearch('');
    setOpen(false);
  }

  return (
    <div class="wl-qb-section">
      <div class="wl-qb-sectionLabel">Object</div>
      {value ? (
        <div class="wl-qb-objSelected">
          <span class="wl-qb-objChip">
            <span class="wl-mono">{value}</span>
            <button
              type="button"
              class="wl-qb-chipX"
              aria-label={`Clear selected object ${value}`}
              onClick={() => { onChange(''); setOpen(true); }}
            >&times;</button>
          </span>
        </div>
      ) : (
        <div style="position:relative">
          <input
            class="wl-input"
            placeholder={loading ? 'Loading objects...' : 'Search objects...'}
            value={search}
            onInput={(e) => {
              setSearch((e.currentTarget as HTMLInputElement).value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            disabled={loading}
          />
          {open && filtered.length > 0 && (
            <div class="wl-qb-objList">
              {filtered.map(o => (
                <div
                  key={o.name}
                  class="wl-qb-objItem"
                  onMouseDown={(e) => { e.preventDefault(); select(o.name); }}
                >
                  <span class="wl-mono">{o.name}</span>
                  <span class="wl-muted">{o.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
