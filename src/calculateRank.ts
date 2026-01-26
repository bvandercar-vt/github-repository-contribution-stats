import type { Contributor } from 'getContributors';

export type Ranks = 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B';

const RANK_THRESHOLDS_STARGAZERS = {
  'S+': 10000,
  S: 1000,
  'A+': 500,
  A: 100,
  'B+': 50,
  B: 0,
} as const satisfies Record<Ranks, number>;

export const calculateStarsRank = (stargazers: number): Ranks => {
  for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS_STARGAZERS)) {
    if (stargazers >= threshold) {
      return rank as Ranks;
    }
  }

  return 'B';
};

const RANK_THRESHOLDS_CONTRIBUTIONS = {
  'S+': 90,
  S: 80,
  'A+': 70,
  A: 60,
  'B+': 50,
  B: 0,
} as const satisfies Record<Ranks, number>;

export const calculateContributionsRank = (
  name: string,
  contributors: Contributor[],
  numOfMyContributions: number,
): Ranks => {
  contributors = contributors.filter((contributor) => contributor.type === 'User');

  const numOfOverRankContributors = contributors.filter(
    (contributor) => contributor.contributions > numOfMyContributions,
  );
  const rankOfContribution =
    ((contributors.length - numOfOverRankContributors.length) / contributors.length) *
    100;

  for (const [rank, threshold] of Object.entries(RANK_THRESHOLDS_CONTRIBUTIONS)) {
    if (rankOfContribution >= threshold) {
      return rank as Ranks;
    }
  }

  return 'B';
};
