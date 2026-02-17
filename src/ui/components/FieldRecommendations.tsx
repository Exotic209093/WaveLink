/**
 * Simple list component for displaying field analytics recommendations.
 *
 * Renders an unordered list with the `.wl-recommendations` class,
 * each recommendation as a list item.
 *
 * Complexity: O(R) where R is the number of recommendations.
 */

import { h } from 'preact';
import type { VNode } from 'preact';

export interface FieldRecommendationsProps {
  recommendations: string[];
}

/** Render the recommendations list. O(R). */
export function FieldRecommendations(props: FieldRecommendationsProps): VNode {
  const { recommendations } = props;

  if (recommendations.length === 0) {
    return (
      <div class="wl-muted" style="padding:8px 0">
        No recommendations. All fields look healthy.
      </div>
    );
  }

  return (
    <ul class="wl-recommendations">
      {recommendations.map((rec, i) => (
        <li key={i}>{rec}</li>
      ))}
    </ul>
  );
}
