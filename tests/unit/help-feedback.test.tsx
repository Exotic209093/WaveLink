import { h } from 'preact';
import { render } from '@testing-library/preact';
import { HelpScreen, feedbackLinks } from '../../src/ui/screens/HelpScreen';
import type { SfApi } from '../../src/ui/api/sf';

describe('Help feedback links', () => {
  test('pre-fill only the version and point at the repo forms and store reviews', () => {
    const links = feedbackLinks('1.0.0');
    expect(links.map((l) => l.label)).toEqual(['Report a bug', 'Request a feature', 'Rate WaveLink']);
    expect(links[0].href).toBe('https://github.com/Exotic209093/WaveLink/issues/new?template=bug_report.yml&version=1.0.0');
    expect(links[1].href).toContain('template=feature_request.yml');
    expect(links[2].href).toMatch(/^https:\/\/chromewebstore\.google\.com\/detail\/wavelink\/[a-z]+\/reviews$/);
  });

  test('omits the version parameter when it is unknown', () => {
    expect(feedbackLinks('')[0].href).not.toContain('version=');
  });

  test('renders as new-tab links on the Help screen', () => {
    (chrome.runtime.getManifest as jest.Mock).mockReturnValueOnce({ manifest_version: 3, version: '1.0.0' });
    const { getByText } = render(<HelpScreen sf={{} as SfApi} onNavigate={() => undefined} />);
    const bug = getByText('Report a bug').closest('a');
    expect(bug?.getAttribute('href')).toContain('version=1.0.0');
    expect(bug?.getAttribute('target')).toBe('_blank');
    expect(bug?.getAttribute('rel')).toBe('noreferrer');
  });
});
