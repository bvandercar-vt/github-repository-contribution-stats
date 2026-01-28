import * as fs from 'fs';
import * as path from 'path';

import { renderContributorStatsCard } from '../stats-card';

import { type RepoWithStats } from '@/processStats';

const mockStats: RepoWithStats[] = [
  {
    name: 'Repo 1',
    owner: {
      id: 'owner1',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
    },
    nameWithOwner: 'owner1/repo1',
    url: 'https://github.com/owner1/repo1',
    stargazerCount: 100,
    numContributedCommits: 246,
    numContributedPrs: 10,
  },
  {
    name: 'Repo 2',
    owner: {
      id: 'owner2',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2?v=4',
    },
    nameWithOwner: 'owner2/repo2',
    url: 'https://github.com/owner2/repo2',
    stargazerCount: 50,
    numContributedCommits: 30,
    numContributedPrs: 5,
  },
  {
    name: 'Repo 3',
    owner: {
      id: 'owner3',
      avatarUrl: 'https://avatars.githubusercontent.com/u/3?v=4',
    },
    nameWithOwner: 'owner3/repo3',
    url: 'https://github.com/owner3/repo3',
    stargazerCount: 2,
    numContributedCommits: 2,
    numContributedPrs: 2,
  },
];

const fixturesFolder = path.resolve(__dirname, '../__fixtures__');
const outputFolder = path.resolve(__dirname, './output');

const saveSvg = (filename: string, svg: string) => {
  const outputPath = path.resolve(outputFolder, filename);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, svg, 'utf-8');
  return outputPath;
};

const generateAndTest = async ({
  filename,
  ...options
}: Parameters<typeof renderContributorStatsCard>[3] & { filename: string }) => {
  const svg = await renderContributorStatsCard('testuser', 'Test User', mockStats, {
    ...options,
    contributor_fetcher: () => Promise.resolve([]),
  });

  const outputPath = saveSvg(filename, svg);
  const generated = fs.readFileSync(outputPath, 'utf-8');
  const expected = fs.readFileSync(path.resolve(fixturesFolder, filename), 'utf-8');
  expect(generated).toEqual(expected);
};

describe('renderContributorStatsCard', () => {
  it('should render with default options', async () => {
    await generateAndTest({ filename: 'default-options.svg' });
  });

  it('should render with custom options', async () => {
    await generateAndTest({
      filename: 'custom-options-1.svg',
      columns: [{ name: 'star_rank' }, { name: 'commits' }],
      theme: 'merko',
      hide_title: false,
      hide_border: true,
      custom_title: 'Custom Stats Card',
    });

    await generateAndTest({
      filename: 'custom-options-2.svg',
      columns: [
        { name: 'commits', minimum: 2 },
        { name: 'contribution_rank' },
        { name: 'pull_requests' },
        { name: 'star_rank' },
      ],
      theme: 'buefy',
    });

    await generateAndTest({
      filename: 'custom-options-3.svg',
      columns: [
        { name: 'commits', minimum: 2 },
        { name: 'pull_requests', minimum: 2 },
        { name: 'contribution_rank' },
        { name: 'star_rank', hide: ['B'] },
      ],
      theme: 'dark',
    });
  });
});
