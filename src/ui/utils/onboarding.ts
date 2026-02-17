/**
 * Onboarding step definitions and progress tracking.
 * Provides a structured tutorial flow for new users with category-based
 * progress tracking across getting-started, data-push, query, and advanced topics.
 * Complexity: O(S) for most operations where S=total onboarding steps.
 */

/** A single onboarding tutorial step. */
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetRoute?: string;
  category: 'getting-started' | 'data-push' | 'query' | 'advanced';
}

/** All onboarding steps covering core features of WaveLink. */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  // ── Getting Started ──
  {
    id: 'connect-org',
    title: 'Connect Your First Org',
    description: 'Authenticate with a Salesforce org to start working with your data. Navigate to any Salesforce page and open WaveLink to connect.',
    targetRoute: '/connect',
    category: 'getting-started',
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Learn Keyboard Shortcuts',
    description: 'Speed up your workflow by learning the keyboard shortcuts for common actions like running queries, switching tabs, and navigating.',
    category: 'getting-started',
  },

  // ── Query ──
  {
    id: 'run-query',
    title: 'Run a SOQL Query',
    description: 'Open the Query tab and write your first SOQL query to fetch records from Salesforce. Use the autocomplete to discover fields.',
    targetRoute: '/query',
    category: 'query',
  },
  {
    id: 'export-results',
    title: 'Export Query Results',
    description: 'After running a query, export the results to CSV or Excel format for offline analysis or further processing.',
    targetRoute: '/query',
    category: 'query',
  },

  // ── Data Push ──
  {
    id: 'upload-data',
    title: 'Upload Data from a File',
    description: 'Upload a CSV or Excel file to prepare data for pushing to Salesforce. WaveLink will parse and preview your records.',
    targetRoute: '/push',
    category: 'data-push',
  },
  {
    id: 'push-data',
    title: 'Push Data to Salesforce',
    description: 'Map your uploaded fields to Salesforce fields and push records using insert, update, upsert, or delete operations.',
    targetRoute: '/push',
    category: 'data-push',
  },
  {
    id: 'use-templates',
    title: 'Save and Use Data Templates',
    description: 'Save your field mappings and sample data as reusable templates for repeated data push operations.',
    targetRoute: '/templates',
    category: 'data-push',
  },

  // ── Advanced ──
  {
    id: 'use-cleanser',
    title: 'Cleanse Your Data',
    description: 'Use the data cleanser to trim whitespace, fix casing, remove duplicates, and standardize values before pushing.',
    targetRoute: '/cleanse',
    category: 'advanced',
  },
  {
    id: 'generate-test-data',
    title: 'Generate Test Data',
    description: 'Use the test data generator to create realistic fake records based on your object schema for development and testing.',
    targetRoute: '/generate',
    category: 'advanced',
  },
  {
    id: 'schema-comparison',
    title: 'Compare Object Schemas',
    description: 'Compare field metadata between two orgs or two objects to identify differences in structure, types, and configuration.',
    targetRoute: '/schema-diff',
    category: 'advanced',
  },
  {
    id: 'use-pipelines',
    title: 'Build a Data Pipeline',
    description: 'Create multi-step transformation pipelines with filters, lookups, aggregations, and joins to process data before pushing.',
    targetRoute: '/pipelines',
    category: 'advanced',
  },
  {
    id: 'detect-duplicates',
    title: 'Detect Duplicate Records',
    description: 'Run duplicate detection on your dataset using exact, fuzzy, or Soundex matching to find and merge duplicate records.',
    targetRoute: '/duplicates',
    category: 'advanced',
  },
];

/**
 * Check whether a specific onboarding step has been completed. O(C)
 * where C is the number of completed steps.
 *
 * @param step - The onboarding step to check.
 * @param completedSteps - Array of completed step IDs.
 * @returns True if the step ID exists in the completed list.
 */
export function isStepCompleted(
  step: OnboardingStep,
  completedSteps: string[],
): boolean {
  return completedSteps.includes(step.id);
}

/**
 * Get the next incomplete onboarding step in order. O(S).
 *
 * Returns the first step in ONBOARDING_STEPS that has not been completed,
 * or null if all steps are done.
 *
 * @param completedSteps - Array of completed step IDs.
 * @returns The next OnboardingStep to complete, or null if all are done.
 */
export function getNextStep(completedSteps: string[]): OnboardingStep | null {
  const completedSet = new Set(completedSteps);
  for (const step of ONBOARDING_STEPS) {
    if (!completedSet.has(step.id)) {
      return step;
    }
  }
  return null;
}

/**
 * Get progress statistics for a specific onboarding category. O(S).
 *
 * @param category - The category to compute progress for.
 * @param completedSteps - Array of completed step IDs.
 * @returns An object with total steps, completed count, and percentage (0-100).
 */
export function getCategoryProgress(
  category: OnboardingStep['category'],
  completedSteps: string[],
): { total: number; completed: number; percent: number } {
  const completedSet = new Set(completedSteps);
  const categorySteps = ONBOARDING_STEPS.filter(s => s.category === category);
  const completedCount = categorySteps.filter(s => completedSet.has(s.id)).length;
  const total = categorySteps.length;

  return {
    total,
    completed: completedCount,
    percent: total > 0 ? Math.round((completedCount / total) * 100) : 100,
  };
}

/**
 * Check whether all onboarding steps have been completed. O(S).
 *
 * @param completedSteps - Array of completed step IDs.
 * @returns True if every step in ONBOARDING_STEPS is in the completed list.
 */
export function isOnboardingComplete(completedSteps: string[]): boolean {
  const completedSet = new Set(completedSteps);
  return ONBOARDING_STEPS.every(step => completedSet.has(step.id));
}
