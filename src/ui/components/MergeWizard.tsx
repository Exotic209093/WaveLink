/**
 * 3-step wizard for resolving and merging duplicate record groups.
 *
 * What this file does:
 * - Step 1 (Overview): Shows duplicate summary stats.
 * - Step 2 (Resolution): Iterates through each DuplicateGroup with DuplicateGroupView
 *   and lets the user pick field values.
 * - Step 3 (Confirm & Apply): Shows a summary and applies merges via `mergeRecords`.
 *
 * Why:
 * - Guided workflow prevents accidental data loss and gives granular control over merges.
 *
 * Complexity:
 * - O(G * F) where G=groups and F=fields for the merge application step.
 */

import { h } from 'preact';
import type { VNode } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import type { DuplicateGroup } from '../utils/duplicateDetection';
import { mergeRecords } from '../utils/duplicateDetection';
import { DuplicateGroupView } from './DuplicateGroupView';

export interface MergeWizardProps {
  records: Record<string, unknown>[];
  groups: DuplicateGroup[];
  fields: string[];
  onMergeComplete: (mergedRecords: Record<string, unknown>[]) => void;
  onCancel: () => void;
}

/** Steps in the merge wizard. O(1). */
const STEPS = ['Overview', 'Resolution', 'Confirm'] as const;

/**
 * Compute total duplicate count across all groups. O(G).
 */
function countDuplicates(groups: DuplicateGroup[]): number {
  let total = 0;
  for (const g of groups) {
    total += g.duplicateIndexes.length;
  }
  return total;
}

/**
 * MergeWizard implements a 3-step guided duplicate merge workflow.
 * O(G * F) for the full merge pass.
 */
export function MergeWizard(props: MergeWizardProps): VNode {
  const { records, groups, fields, onMergeComplete, onCancel } = props;

  const [step, setStep] = useState(0);
  const [currentGroup, setCurrentGroup] = useState(0);

  // Per-group field resolutions: groupIndex -> { field -> source }
  const [allResolutions, setAllResolutions] = useState<
    Record<number, Record<string, 'master' | number>>
  >(() => {
    const init: Record<number, Record<string, 'master' | number>> = {};
    for (let i = 0; i < groups.length; i++) {
      const fieldRes: Record<string, 'master' | number> = {};
      for (const f of fields) {
        fieldRes[f] = 'master';
      }
      init[i] = fieldRes;
    }
    return init;
  });

  const duplicateCount = useMemo(() => countDuplicates(groups), [groups]);

  /** Handle resolution change for the current group. O(1). */
  function handleResolutionChange(field: string, source: 'master' | number): void {
    setAllResolutions((prev) => ({
      ...prev,
      [currentGroup]: {
        ...prev[currentGroup],
        [field]: source,
      },
    }));
  }

  /** Apply all merges across groups. O(G * F). */
  function applyMerges(): void {
    // Start with all records
    const mergedSet = new Map<number, Record<string, unknown>>();
    for (let i = 0; i < records.length; i++) {
      mergedSet.set(i, records[i]);
    }

    // For each group, merge and replace master, remove duplicates
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const resolutions = allResolutions[gi] ?? {};
      const merged = mergeRecords(records, group, resolutions);
      mergedSet.set(group.masterIndex, merged);

      for (const dupIdx of group.duplicateIndexes) {
        mergedSet.delete(dupIdx);
      }
    }

    const result = Array.from(mergedSet.values());
    onMergeComplete(result);
  }

  /** Navigate to next step or next group. O(1). */
  function goNext(): void {
    if (step === 0) {
      setStep(1);
    } else if (step === 1) {
      if (currentGroup < groups.length - 1) {
        setCurrentGroup((prev) => prev + 1);
      } else {
        setStep(2);
      }
    }
  }

  /** Navigate to previous step or previous group. O(1). */
  function goBack(): void {
    if (step === 2) {
      setStep(1);
      setCurrentGroup(groups.length - 1);
    } else if (step === 1) {
      if (currentGroup > 0) {
        setCurrentGroup((prev) => prev - 1);
      } else {
        setStep(0);
      }
    }
  }

  return (
    <div class="wl-card">
      <div class="wl-cardHeader">
        <h2>Merge Wizard</h2>
        <div class="wl-actions">
          {STEPS.map((label, i) => (
            <span
              key={label}
              class="wl-chip"
              style={i === step ? 'border-color:var(--wl-accent);font-weight:900' : ''}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      <div class="wl-row">
        {/* Step 1: Overview */}
        {step === 0 && (
          <div class="wl-wizardStep">
            <div style="font-weight:900;font-size:16px">Duplicate Summary</div>
            <div class="wl-chipRow">
              <span class="wl-chip">
                <span>Groups</span>
                <strong>{groups.length}</strong>
              </span>
              <span class="wl-chip">
                <span>Total Records</span>
                <strong>{records.length}</strong>
              </span>
              <span class="wl-chip">
                <span>Duplicates</span>
                <strong style="color:var(--wl-danger)">{duplicateCount}</strong>
              </span>
              <span class="wl-chip">
                <span>After Merge</span>
                <strong>{records.length - duplicateCount}</strong>
              </span>
            </div>
            <div class="wl-muted">
              Review each duplicate group and choose which field values to keep.
              The master record provides the default values for all fields.
            </div>
          </div>
        )}

        {/* Step 2: Per-group resolution */}
        {step === 1 && groups[currentGroup] && (
          <div class="wl-wizardStep">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-weight:900;font-size:14px">
                Group {currentGroup + 1} of {groups.length}
              </div>
              <span class="wl-muted">
                Master: #{groups[currentGroup].masterIndex} | Duplicates: {groups[currentGroup].duplicateIndexes.length}
              </span>
            </div>

            <DuplicateGroupView
              records={records}
              group={groups[currentGroup]}
              fields={fields}
              resolutions={allResolutions[currentGroup] ?? {}}
              onResolutionChange={handleResolutionChange}
            />
          </div>
        )}

        {/* Step 3: Confirm & Apply */}
        {step === 2 && (
          <div class="wl-wizardStep">
            <div style="font-weight:900;font-size:16px">Confirm Merge</div>
            <div class="wl-muted">
              {groups.length} group(s) will be merged. {duplicateCount} duplicate record(s) will
              be removed, producing {records.length - duplicateCount} unique records.
            </div>

            <div class="wl-tableWrap" style="max-height:300px">
              <table class="wl-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Master #</th>
                    <th>Duplicates</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((g, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>#{g.masterIndex}</td>
                      <td>{g.duplicateIndexes.map((d) => `#${d}`).join(', ')}</td>
                      <td>{g.score.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              class="wl-btn wl-btnPrimary"
              style="align-self:flex-start"
              onClick={applyMerges}
            >
              Apply Merge
            </button>
          </div>
        )}

        {/* Navigation */}
        <div class="wl-wizardNav">
          <button class="wl-btn" onClick={onCancel}>
            Cancel
          </button>
          <button class="wl-btn" onClick={goBack} disabled={step === 0 && currentGroup === 0}>
            Back
          </button>
          {step < 2 && (
            <button class="wl-btn wl-btnPrimary" onClick={goNext}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
