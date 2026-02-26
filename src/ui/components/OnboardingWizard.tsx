/**
 * Interactive onboarding/tutorial wizard overlay.
 *
 * What this file does:
 * - Loads the user's onboarding progress from storage via SfApi.
 * - Presents an ordered list of steps grouped by category tabs.
 * - Lets the user navigate between steps, mark them visited, skip the tutorial,
 *   or jump to the relevant screen for each step.
 *
 * Complexity:
 * - O(S) where S is the number of onboarding steps (small constant).
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { SfApi } from '../api/sf';
import {
  ONBOARDING_STEPS,
  getCategoryProgress,
  isOnboardingComplete,
} from '../utils/onboarding';
import type { OnboardingStep } from '../utils/onboarding';

/** Onboarding category type matching the step definitions. */
type OnboardingCategory = OnboardingStep['category'];

/** Category display labels in presentation order. */
const ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  'getting-started',
  'data-push',
  'query',
  'advanced',
];

/** Human-readable labels for each category. */
const CATEGORY_LABELS: Record<OnboardingCategory, string> = {
  'getting-started': 'Getting Started',
  'data-push': 'Data Push',
  'query': 'Query',
  'advanced': 'Advanced',
};

export function OnboardingWizard(props: {
  sf: SfApi;
  onDismiss: () => void;
  onNavigate: (route: string) => void;
}): VNode {
  const { sf, onDismiss, onNavigate } = props;

  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<OnboardingCategory>('getting-started');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load onboarding progress on mount
  useEffect(() => {
    let cancelled = false;
    sf.getOnboarding()
      .then((progress) => {
        if (cancelled) return;
        setCompletedSteps(progress.completedSteps ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sf]);

  // Steps filtered by active category
  const categorySteps = useMemo(
    () => ONBOARDING_STEPS.filter((s) => s.category === activeCategory),
    [activeCategory],
  );

  // Current step
  const currentStep: OnboardingStep | undefined = categorySteps[currentStepIndex];

  // Overall progress
  const totalSteps = ONBOARDING_STEPS.length;
  const totalCompleted = completedSteps.length;
  const overallPercent = totalSteps === 0 ? 100 : Math.round((totalCompleted / totalSteps) * 100);

  // Category progress for the active tab
  const catProgress = getCategoryProgress(activeCategory, completedSteps);

  /** Mark a step as complete and persist. */
  async function markComplete(stepId: string): Promise<void> {
    if (completedSteps.includes(stepId)) return;
    const next = [...completedSteps, stepId];
    setCompletedSteps(next);
    try {
      await sf.setOnboarding({ completedSteps: next });
    } catch {
      // Silently fail; progress will be re-fetched on next open
    }
  }

  /** Navigate to a step's target route and mark it as complete. */
  function goToFeature(step: OnboardingStep): void {
    markComplete(step.id);
    if (step.targetRoute) {
      onNavigate(step.targetRoute);
    }
  }

  /** Navigate between steps. */
  function goNext(): void {
    if (currentStepIndex < categorySteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  }

  function goPrev(): void {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  }

  /** Switch category tab and reset step index. */
  function switchCategory(cat: OnboardingCategory): void {
    setActiveCategory(cat);
    setCurrentStepIndex(0);
  }

  if (loading) {
    return (
      <div class="wl-modalOverlay" role="dialog" aria-modal="true">
        <div class="wl-modal">
          <div class="wl-card">
            <div class="wl-row" style="text-align:center;padding:40px">
              <div class="wl-muted">Loading tutorial...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const allComplete = isOnboardingComplete(completedSteps);

  return (
    <div class="wl-modalOverlay" role="dialog" aria-modal="true">
      <div class="wl-modal">
        <div class="wl-card">
          {/* Header */}
          <div class="wl-cardHeader">
            <h2>WaveLink Tutorial</h2>
            <div class="wl-actions">
              <button class="wl-btn" onClick={onDismiss}>Skip Tutorial</button>
            </div>
          </div>

          {/* Overall progress bar */}
          <div class="wl-row" style="gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font-weight:900;font-size:12px">
                Overall Progress: {totalCompleted} / {totalSteps}
              </span>
              <span class="wl-muted">{overallPercent}%</span>
            </div>
            <div class="wl-meter" style="width:100%">
              <div class="wl-meterFill" style={`width:${overallPercent}%`} />
            </div>
          </div>

          {/* Category tabs */}
          <div style="display:flex;gap:6px;padding:0 14px 10px 14px;flex-wrap:wrap">
            {ONBOARDING_CATEGORIES.map((cat) => {
              const cp = getCategoryProgress(cat, completedSteps);
              return (
                <button
                  key={cat}
                  class={`wl-btn${cat === activeCategory ? ' wl-btnPrimary' : ''}`}
                  onClick={() => switchCategory(cat)}
                >
                  {CATEGORY_LABELS[cat]} ({cp.completed}/{cp.total})
                </button>
              );
            })}
          </div>

          {/* Category progress */}
          <div class="wl-row" style="gap:6px;padding-top:0">
            <div class="wl-meter" style="width:100%">
              <div class="wl-meterFill" style={`width:${catProgress.percent}%`} />
            </div>
          </div>

          {/* Current step content */}
          {currentStep ? (
            <div class="wl-row" style="gap:14px">
              <div style="display:flex;align-items:center;gap:8px">
                <span
                  class="wl-badge"
                  style={
                    completedSteps.includes(currentStep.id)
                      ? 'border-color:rgba(102,187,106,0.55);color:#4caf50'
                      : ''
                  }
                >
                  {completedSteps.includes(currentStep.id) ? 'Done' : `Step ${currentStepIndex + 1}`}
                </span>
                <span style="font-weight:900;font-size:14px">{currentStep.title}</span>
              </div>

              <div class="wl-muted" style="font-size:13px;line-height:1.5">
                {currentStep.description}
              </div>

              <div class="wl-actions">
                {currentStep.targetRoute ? (
                  <button
                    class="wl-btn wl-btnPrimary"
                    onClick={() => goToFeature(currentStep)}
                  >
                    Go to Feature
                  </button>
                ) : null}
                {!completedSteps.includes(currentStep.id) ? (
                  <button
                    class="wl-btn"
                    onClick={() => markComplete(currentStep.id)}
                  >
                    Mark Complete
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div class="wl-row">
              <div class="wl-muted">No steps in this category.</div>
            </div>
          )}

          {/* Step list for the active category */}
          <div style="padding:0 14px 10px 14px">
            <div style="display:flex;flex-direction:column;gap:4px">
              {categorySteps.map((step, idx) => {
                const done = completedSteps.includes(step.id);
                const active = idx === currentStepIndex;
                return (
                  <div
                    key={step.id}
                    style={`display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;font-size:12px;${
                      active ? 'background:rgba(0,166,200,0.10);' : ''
                    }${done ? 'opacity:0.7;' : ''}`}
                    onClick={() => setCurrentStepIndex(idx)}
                  >
                    <span style={`width:16px;height:16px;border-radius:50%;border:2px solid ${done ? '#4caf50' : 'var(--wl-line)'};display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0`}>
                      {done ? '\u2713' : ''}
                    </span>
                    <span style={done ? 'text-decoration:line-through' : ''}>{step.title}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Navigation buttons */}
          <div class="wl-row" style="flex-direction:row;justify-content:space-between;padding-top:0">
            <button
              class="wl-btn"
              onClick={goPrev}
              disabled={currentStepIndex === 0}
            >
              Previous
            </button>
            <div class="wl-actions">
              {allComplete ? (
                <button class="wl-btn wl-btnPrimary" onClick={onDismiss}>
                  Finish Tutorial
                </button>
              ) : null}
              <button
                class="wl-btn"
                onClick={goNext}
                disabled={currentStepIndex >= categorySteps.length - 1}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
