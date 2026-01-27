import type { AxiosResponse } from 'axios';
import axios from 'axios';

import {
  fetchAllContributorStats,
  type UserContributionsResponse,
  type UserContributorStatsResponse,
} from '../fetchAllContributorStats';

import type { Repository } from '@/fetchContributorStats';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('fetchAllContributorStats', () => {
  const username = 'testuser';

  const mockRepo = ({
    name,
    owner = 'owner',
    stars = 100,
  }: {
    name: string;
    owner?: string;
    stars?: number;
  }): Partial<Repository> => ({
    nameWithOwner: `${owner}/${name}`,
    name,
    stargazerCount: stars,
    url: `https://github.com/${owner}/${name}`,
  });

  const mockContributionYears = (
    years: number[],
  ): Partial<AxiosResponse<UserContributorStatsResponse>> => ({
    data: {
      data: {
        user: {
          id: 'user-id-123',
          name: 'Test User',
          contributionsCollection: {
            contributionYears: years,
          },
        },
      },
    },
  });

  type MockContributionsByRepository = { repo: Partial<Repository>; count: number };

  const mockContributions = ({
    commits,
    prs,
  }: {
    commits: MockContributionsByRepository[];
    prs: MockContributionsByRepository[];
  }): Partial<AxiosResponse<UserContributionsResponse>> => ({
    data: {
      data: {
        user: {
          contributionsCollection: {
            commitContributionsByRepository: commits.map(({ repo, count }) => ({
              contributions: { totalCount: count },
              repository: repo as Repository,
            })),
            pullRequestContributionsByRepository: prs.map(({ repo, count }) => ({
              contributions: { totalCount: count },
              repository: repo as Repository,
            })),
          },
        },
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and combine contributions from multiple years', async () => {
    const repo1 = mockRepo({ name: 'repo1', owner: 'owner', stars: 100 });
    const repo2 = mockRepo({ name: 'repo2', owner: 'owner', stars: 50 });

    mockedAxios.post
      .mockResolvedValueOnce(mockContributionYears([2022, 2023]))
      // 2022 contributions
      .mockResolvedValueOnce(
        mockContributions({
          commits: [{ repo: repo1, count: 10 }],
          prs: [{ repo: repo1, count: 5 }],
        }),
      )
      // 2023 contributions
      .mockResolvedValueOnce(
        mockContributions({
          commits: [
            { repo: repo1, count: 15 },
            { repo: repo2, count: 8 },
          ],
          prs: [{ repo: repo2, count: 3 }],
        }),
      );

    const result = await fetchAllContributorStats(username);

    expect(result.repositoriesContributedTo.nodes).toEqual([
      expect.objectContaining({
        nameWithOwner: 'owner/repo1',
        numContributedCommits: 25, // 10 + 15
        numContributedPrs: 5,
      }),
      expect.objectContaining({
        nameWithOwner: 'owner/repo2',
        numContributedCommits: 8,
        numContributedPrs: 3,
      }),
    ]);

    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
  });

  it('should handle repository with only commits and no PRs', async () => {
    const repo1 = mockRepo({ name: 'repo1', owner: 'owner', stars: 100 });

    mockedAxios.post
      .mockResolvedValueOnce(mockContributionYears([2023]))
      .mockResolvedValueOnce(
        mockContributions({
          commits: [{ repo: repo1, count: 20 }],
          prs: [],
        }),
      );

    const result = await fetchAllContributorStats(username);

    expect(result.repositoriesContributedTo.nodes).toEqual([
      expect.objectContaining({
        nameWithOwner: 'owner/repo1',
        numContributedCommits: 20,
        numContributedPrs: undefined,
      }),
    ]);
  });

  it('should handle empty contribution years', async () => {
    mockedAxios.post.mockResolvedValueOnce(mockContributionYears([]));

    const result = await fetchAllContributorStats(username);

    expect(result.repositoriesContributedTo.nodes).toEqual([]);
  });

  it('should aggregate contributions across multiple repos', async () => {
    const repos = Array.from({ length: 5 }, (_, i) =>
      mockRepo({ name: `repo${i}`, owner: 'owner', stars: 10 * i }),
    );

    mockedAxios.post
      .mockResolvedValueOnce(mockContributionYears([2023]))
      .mockResolvedValueOnce(
        mockContributions({
          commits: repos.map((repo, i) => ({ repo, count: i + 1 })),
          prs: repos.slice(0, 3).map((repo, i) => ({ repo, count: i + 1 })),
        }),
      );

    const result = await fetchAllContributorStats(username);

    expect(result.repositoriesContributedTo.nodes).toEqual([
      expect.objectContaining({
        nameWithOwner: 'owner/repo0',
        numContributedCommits: 1,
        numContributedPrs: 1,
      }),
      expect.objectContaining({
        nameWithOwner: 'owner/repo1',
        numContributedCommits: 2,
        numContributedPrs: 2,
      }),
      expect.objectContaining({
        nameWithOwner: 'owner/repo2',
        numContributedCommits: 3,
        numContributedPrs: 3,
      }),
      expect.objectContaining({
        nameWithOwner: 'owner/repo3',
        numContributedCommits: 4,
        numContributedPrs: undefined,
      }),
      expect.objectContaining({
        nameWithOwner: 'owner/repo4',
        numContributedCommits: 5,
        numContributedPrs: undefined,
      }),
    ]);
  });
});
