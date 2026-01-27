import axios from 'axios';
import _ from 'lodash';

import {
  repositoryQuery,
  type Repository,
  type UserResponse,
} from './fetchContributorStats';

const MAX_REPOS_PER_QUERY = 100;

interface TimeRange {
  from: string;
  to: string;
}

export type ContributionsByRepository = {
  contributions: { totalCount: number };
  repository: Repository;
};

export type ContributionResponse = {
  commitContributionsByRepository: ContributionsByRepository[];
  pullRequestContributionsByRepository: ContributionsByRepository[];
};

export type UserContributionsResponse = UserResponse<{
  contributionsCollection: ContributionResponse;
}>;

/**
 * Fetch contributions for a specific time range
 */
async function fetchContributionsForRange(
  username: string,
  range: TimeRange,
): Promise<ContributionResponse> {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const response = await axios.post<UserContributionsResponse>(
    'https://api.github.com/graphql',
    {
      query: `query {
        user(login: ${JSON.stringify(username)}) {
          contributionsCollection(from: "${range.from}", to: "${range.to}") {
            commitContributionsByRepository(maxRepositories: ${MAX_REPOS_PER_QUERY}) {
              contributions {
                totalCount
              }
              repository {
                ${repositoryQuery}
              }
            }
            pullRequestContributionsByRepository(maxRepositories: ${MAX_REPOS_PER_QUERY}) {
              contributions {
                totalCount
              }
              repository {
                ${repositoryQuery}
              }
            }
          }
        }
      }`,
    },
    {
      headers: {
        Authorization: `token ${token}`,
      },
      validateStatus: (status) => status == 200,
    },
  );

  return response.data.data.user.contributionsCollection;
}

/**
 * Split a time range into smaller chunks
 */
function splitTimeRange(range: TimeRange): TimeRange[] {
  const from = new Date(range.from);
  const to = new Date(range.to);
  const diffMonths =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

  if (diffMonths >= 6) {
    // Split into halves
    const mid = new Date(from);
    mid.setMonth(mid.getMonth() + Math.floor(diffMonths / 2));
    mid.setDate(1);
    const midEnd = new Date(mid);
    midEnd.setDate(midEnd.getDate() - 1);
    midEnd.setHours(23, 59, 59, 999);

    return [
      { from: range.from, to: midEnd.toISOString() },
      { from: mid.toISOString(), to: range.to },
    ];
  } else if (diffMonths >= 2) {
    // Split into months
    const ranges: TimeRange[] = [];
    const current = new Date(from);

    while (current < to) {
      const monthStart = new Date(current);
      const monthEnd = new Date(current);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setDate(0);
      monthEnd.setHours(23, 59, 59, 999);

      ranges.push({
        from: monthStart.toISOString(),
        to: monthEnd > to ? range.to : monthEnd.toISOString(),
      });

      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    return ranges;
  }

  // Cannot split further (single month or less)
  return [range];
}

/**
 * Recursively fetch contributions, splitting time ranges when hitting the 100 repo limit
 */
async function fetchContributionsWithSplitting(
  username: string,
  range: TimeRange,
  depth: number = 0,
): Promise<ContributionResponse> {
  const results = await fetchContributionsForRange(username, range);

  // If we hit the limit and can split further, split the range
  if (
    (results.pullRequestContributionsByRepository.length >= MAX_REPOS_PER_QUERY ||
      results.commitContributionsByRepository.length >= MAX_REPOS_PER_QUERY) &&
    depth < 4
  ) {
    const subRanges = splitTimeRange(range);

    // If we can't split further, just return what we have
    if (subRanges.length === 1) {
      return results;
    }

    // Fetch each sub-range recursively
    const subResults = await Promise.all(
      subRanges.map((subRange) =>
        fetchContributionsWithSplitting(username, subRange, depth + 1),
      ),
    );

    return {
      commitContributionsByRepository: subResults.flatMap(
        (c) => c.commitContributionsByRepository,
      ),
      pullRequestContributionsByRepository: subResults.flatMap(
        (c) => c.pullRequestContributionsByRepository,
      ),
    };
  }

  return results;
}

export type UserContributorStatsResponse = UserResponse<{
  id: string;
  name: string;
  contributionsCollection: {
    contributionYears: number[];
  };
}>;

/**
 * The Fetch All Contributor Stats Function.
 *
 * This function combines all the yearly `contributionsCollection` from the
 * github graphql APIs, with automatic splitting for years with >100 repos.
 *
 * @param {String} username The target github username for contribution stats.
 *
 * @return {*}
 */
export async function fetchAllContributorStats(username: string) {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  // First, get the contribution years
  const {
    data: {
      data: {
        user: {
          id,
          name,
          contributionsCollection: { contributionYears },
        },
      },
    },
  } = await axios.post<UserContributorStatsResponse>(
    'https://api.github.com/graphql',
    {
      query: `query {
          user(login: "${username}") {
            id
            name
            contributionsCollection {
              contributionYears
            }
          }
        }`,
    },
    {
      headers: {
        Authorization: `token ${token}`,
      },
      validateStatus: (status) => status == 200,
    },
  );

  // Fetch contributions for each year with automatic splitting
  const yearlyContributions = await Promise.all(
    contributionYears.map((year) =>
      fetchContributionsWithSplitting(username, {
        from: `${year}-01-01T00:00:00Z`,
        to: `${year}-12-31T23:59:59Z`,
      }),
    ),
  );

  // Flatten all contributions
  const allContributions = yearlyContributions.flat();

  // Group by repository and sum contributions
  const getStatsByName = (items: ContributionsByRepository[]) =>
    _.chain(items)
      .groupBy((item) => item.repository.nameWithOwner)
      .map((contributions) => {
        const totalCount = _.sumBy(contributions, (c) => c.contributions.totalCount);
        return {
          ...contributions[0].repository,
          numContributions: totalCount,
        };
      })
      .value();

  const commitsRepositories = getStatsByName(
    allContributions.flatMap((c) => c.commitContributionsByRepository),
  );

  const pullRequestsRepositories = getStatsByName(
    allContributions.flatMap((c) => c.pullRequestContributionsByRepository),
  );

  return {
    id,
    name,
    repositoriesContributedTo: {
      nodes: commitsRepositories.map((repo) => ({
        ...repo,
        numContributedCommits: repo.numContributions,
        numContributedPrs: pullRequestsRepositories.find(
          (prRepo) => prRepo.nameWithOwner === repo.nameWithOwner,
        )?.numContributions,
      })),
    },
  };
}
