import { calculateContributionsRank, calculateStarsRank } from './calculateRank';
import { type ColumnCriteria, type OrderByOptions } from './common/schema';
import { getColumnCriteria, getImageBase64FromURL, matchWildcard } from './common/utils';
import { type Contributor, fetchContributors } from './fetchContributors';
import type { Repository } from './fetchContributorStats';

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

export type RepoWithStats = Pick<
  Repository,
  'name' | 'owner' | 'nameWithOwner' | 'url' | 'stargazerCount'
> & {
  numContributedCommits?: number;
  numContributedPrs?: number;
};

// Type for custom contributor fetcher function
export type ContributorFetcher = (
  username: string,
  nameWithOwner: string,
  token: string,
) => Promise<Contributor[]>;

export async function processStats(
  reposWithStats: RepoWithStats[] = [],
  {
    columns = [{ name: 'star_rank' }],
    username,
    order_by = 'stars',
    limit = -1,
    exclude = [],
    contributor_fetcher = fetchContributors,
  }: {
    username: string;
    /**
     * @default ['star_rank']
     */
    columns?: ColumnCriteria[];
    /**
     * @default 'stars'
     */
    order_by?: OrderByOptions;
    /**
     * @default none
     */
    limit?: number;
    exclude?: string[];
    contributor_fetcher?: ContributorFetcher;
  },
) {
  const starRankCriteria = getColumnCriteria(columns, 'star_rank');
  const contributorRankCriteria = getColumnCriteria(columns, 'contribution_rank');
  const commitsCriteria = getColumnCriteria(columns, 'commits');
  const pullRequestsCriteria = getColumnCriteria(columns, 'pull_requests');

  let allContributorsByRepo: Contributor[][];
  if (contributorRankCriteria) {
    // Fetch sequentially to respect rate limiting (not in parallel with Promise.all)
    allContributorsByRepo = [];
    for (const { nameWithOwner } of Object.values(reposWithStats)) {
      const contributors = await contributor_fetcher(username, nameWithOwner, token!);
      allContributorsByRepo.push(contributors);
    }
  }

  const imageBase64s = await Promise.all(
    Object.values(reposWithStats).map((repo) => {
      const url = new URL(repo.owner.avatarUrl);
      url.searchParams.append('s', '50');
      return getImageBase64FromURL(url.toString());
    }),
  );

  return reposWithStats
    .map(
      (
        {
          url,
          name,
          nameWithOwner,
          stargazerCount,
          numContributedCommits,
          numContributedPrs,
        },
        index,
      ) => {
        if (exclude.some((pattern) => matchWildcard(nameWithOwner, pattern))) {
          return undefined;
        }

        for (const [given, minimum] of [
          [numContributedCommits, commitsCriteria?.minimum],
          [numContributedPrs, pullRequestsCriteria?.minimum],
        ] as const) {
          if (minimum !== undefined && given !== undefined && given < minimum) {
            return undefined;
          }
        }

        const contributionRank =
          contributorRankCriteria && numContributedCommits !== undefined
            ? calculateContributionsRank(
                name,
                allContributorsByRepo[index],
                numContributedCommits,
              )
            : undefined;

        if (
          contributionRank &&
          contributorRankCriteria?.hide?.includes(contributionRank)
        ) {
          return undefined;
        }

        const starRank = starRankCriteria
          ? calculateStarsRank(stargazerCount)
          : undefined;

        if (starRank && starRankCriteria?.hide?.includes(starRank)) {
          return undefined;
        }

        return {
          name,
          imageBase64: imageBase64s[index],
          url,
          contributionRank,
          numContributedCommits,
          numStars: stargazerCount,
          numContributedPrs,
          starRank,
        };
      },
    )
    .filter((s): s is Exclude<typeof s, undefined> => s !== undefined)
    .sort((a, b) =>
      order_by == 'stars'
        ? b.numStars - a.numStars
        : (b.numContributedCommits ?? 0) - (a.numContributedCommits ?? 0),
    )
    .slice(0, limit > 0 ? limit : undefined);
}
