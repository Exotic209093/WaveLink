/**
 * Help center screen.
 *
 * What this file does:
 * - Displays help topics organized by category in a searchable grid layout.
 * - Each category card lists topics that link to the relevant application screen.
 * - Provides a "Restart Tutorial" button that resets onboarding progress and
 *   opens the OnboardingWizard overlay.
 *
 * Complexity:
 * - O(S) where S is the number of onboarding steps for filtering and rendering.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import { ONBOARDING_STEPS } from '../utils/onboarding';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { APP_ROUTES } from '../app/routes';

/** Help category definitions with descriptions. */
const HELP_CATEGORIES: Array<{
  name: string;
  description: string;
  filter: (step: typeof ONBOARDING_STEPS[number]) => boolean;
}> = [
  {
    name: 'Getting Started',
    description: 'Connect to Salesforce, explore your schema, and check org health.',
    filter: (s) => s.category === 'getting-started',
  },
  {
    name: 'Data Push',
    description: 'Upload files, map fields, push records, and review push history.',
    filter: (s) => s.category === 'data-push',
  },
  {
    name: 'Query & Objects',
    description: 'Run SOQL queries, use the visual builder, and manage saved queries.',
    filter: (s) => s.category === 'query',
  },
  {
    name: 'Data Cleanser',
    description: 'Trim, deduplicate, standardize, and validate your data before pushing.',
    filter: () => false, // Static topics below
  },
  {
    name: 'Advanced Features',
    description: 'Templates, pipelines, schema comparison, relationships, and more.',
    filter: (s) => s.category === 'advanced',
  },
];

/** Static help topics for the Data Cleanser category (not in ONBOARDING_STEPS). */
const CLEANSER_TOPICS = [
  { title: 'Open the Cleanser', route: 'push', description: 'Upload data, then click "Open Cleanser" to start cleaning.' },
  { title: 'Column Operations', route: 'push', description: 'Rename, remove, reorder, and transform individual columns.' },
  { title: 'Bulk Actions', route: 'push', description: 'Apply transformations across multiple columns at once.' },
  { title: 'Validation Rules', route: 'push', description: 'Set up quality rules to catch errors before pushing.' },
];

export function HelpScreen(props: {
  sf: SfApi;
  onNavigate: (route: string) => void;
}): VNode {
  const { sf, onNavigate } = props;

  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);

  /** All help topics (onboarding steps + static cleanser topics) as a flat list. */
  const allTopics = useMemo(() => {
    const fromSteps = ONBOARDING_STEPS.map((s) => ({
      title: s.title,
      description: s.description,
      route: s.targetRoute,
      category: s.category,
    }));

    const fromCleanser = CLEANSER_TOPICS.map((t) => ({
      title: t.title,
      description: t.description,
      route: t.route,
      category: 'Data Cleanser' as const,
    }));

    return [...fromSteps, ...fromCleanser];
  }, []);

  /** Filtered topics based on search query. */
  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTopics;
    return allTopics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }, [allTopics, search]);

  /** Restart tutorial: reset progress and show wizard. */
  async function restartTutorial(): Promise<void> {
    try {
      await sf.setOnboarding({ completedSteps: [], dismissedAt: undefined });
    } catch {
      // Ignore errors - wizard will still open
    }
    setShowWizard(true);
  }

  /** Map display category names to internal category values. */
  const CATEGORY_NAME_MAP: Record<string, string> = {
    'Getting Started': 'getting-started',
    'Data Push': 'data-push',
    'Query & Objects': 'query',
    'Data Cleanser': 'Data Cleanser',
    'Advanced Features': 'advanced',
  };

  /** Get topics for a given category display name. */
  function getTopicsForCategory(categoryName: string): typeof filteredTopics {
    const mapped = CATEGORY_NAME_MAP[categoryName] ?? categoryName;
    return filteredTopics.filter((t) => t.category === mapped);
  }

  return (
    <div style="display:flex;flex-direction:column;gap:14px">
      {/* Header */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Help Center</h2>
          <div class="wl-actions">
            <button class="wl-btn wl-btnPrimary" onClick={restartTutorial}>
              Restart Tutorial
            </button>
          </div>
        </div>

        <div class="wl-row">
          <input
            class="wl-input"
            type="text"
            aria-label="Search help topics"
            value={search}
            onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            placeholder="Search help topics..."
          />
          <div class="wl-muted">
            {filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Category grid */}
      <div class="wl-templateGrid">
        {HELP_CATEGORIES.map((cat) => {
          const topics = getTopicsForCategory(cat.name);
          if (search && topics.length === 0) return null;

          return (
            <div key={cat.name} class="wl-templateCard">
              <div style="font-weight:900;font-size:14px">{cat.name}</div>
              <div class="wl-muted" style="margin-bottom:8px">{cat.description}</div>

              {topics.length > 0 ? (
                <div style="display:flex;flex-direction:column;gap:4px">
                  {topics.map((topic, idx) => (
                    <button
                      type="button"
                      key={`${cat.name}-${idx}`}
                      disabled={!topic.route}
                      style="display:flex;align-items:flex-start;gap:6px;padding:4px 0;cursor:pointer;border:0;background:transparent;width:100%;font:inherit;color:inherit;text-align:left"
                      onClick={() => topic.route && onNavigate(topic.route)}
                    >
                      <span style="color:var(--wl-accent);font-weight:800;font-size:12px;flex-shrink:0;margin-top:1px">
                        &rarr;
                      </span>
                      <div style="min-width:0">
                        <div style="font-weight:700;font-size:12px;color:var(--wl-accent)">
                          {topic.title}
                        </div>
                        <div class="wl-muted" style="font-size:11px">{topic.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div class="wl-muted" style="font-size:11px">No topics match your search.</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Links */}
      <div class="wl-card">
        <div class="wl-cardHeader">
          <h2>Quick Links</h2>
        </div>
        <div class="wl-row" style="gap:8px">
          <div class="wl-actions" style="flex-wrap:wrap">
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.settings)}>Settings</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.advancedObjects)}>Objects</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.export)}>Query</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.import)}>Data Push</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.templates)}>Templates</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.advancedPipeline)}>Pipelines</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.advancedOrgHealth)}>Org Health</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.advancedSchemaCompare)}>Schema Compare</button>
            <button class="wl-btn" onClick={() => onNavigate(APP_ROUTES.advancedRelationships)}>Relationships</button>
          </div>
        </div>
      </div>

      {/* Onboarding wizard overlay */}
      {showWizard ? (
        <OnboardingWizard
          sf={sf}
          onDismiss={() => setShowWizard(false)}
          onNavigate={(route) => {
            setShowWizard(false);
            onNavigate(route);
          }}
        />
      ) : null}
    </div>
  );
}
