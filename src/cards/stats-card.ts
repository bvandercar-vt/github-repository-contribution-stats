import {
  calculateStarsRank,
  calculateContributionsRank,
  type Rank,
} from '@/calculateRank';
import { Card } from '@/common/Card';
import { I18n } from '@/common/I18n';
import { type Columns, type OrderByOptions } from '@/common/schema';
import {
  clampValue,
  flexLayout,
  getCardColors,
  getImageBase64FromURL,
  measureText,
  shouldCalculateContributorRank,
  shouldCalculateStarRank,
} from '@/common/utils';
import { type Repository } from '@/fetchContributorStats';
import { getStyles } from '@/getStyles';
import { statCardLocales } from '@/translations';
import { getContributors, type Contributor } from 'getContributors';
import { type ThemeNames } from 'themes';

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

// Type for custom contributor fetcher function
export type ContributorFetcher = (
  username: string,
  nameWithOwner: string,
  token: string,
) => Promise<Contributor[]>;

const createTextNode = ({
  imageBase64,
  name,
  ranks,
  index,
}: {
  imageBase64: string;
  name: string;
  ranks: Rank[];
  index: number;
}) => {
  const staggerDelay = (index + 3) * 150;

  const calculateTextWidth = (text: string) => {
    return measureText(text, 18);
  };

  let offset = clampValue(calculateTextWidth(name), 230, 400);
  offset += offset === 230 ? 5 : 15;

  const rankItems = ranks.map((rank) => {
    const item = `
    <g data-testid="rank-circle" transform="translate(${offset}, 0)">
      <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="14" />
      <g class="rank-text">
        <text x="${rank.includes('+') ? 4 : 7.2}" y="18.5">
        ${rank}
       </text>
      </g>
    </g>
    `;
    offset += 50;
    return item;
  });

  return `
    <g class="stagger" style="animation-delay: ${staggerDelay}ms" transform="translate(25, 0)">
      <defs>
        <clipPath id="myCircle">
          <circle cx="12.5" cy="12.5" r="12.5" fill="#FFFFFF" />
        </clipPath>
      </defs>
      <image xlink:href="${imageBase64}" width="25" height="25" clip-path="url(#myCircle)"/>
      <g transform="translate(30,16)">
        <text class="stat bold">${name}</text>
      </g>
      ${rankItems}
    </g>
  `;
};

export type ContributionsStats = Pick<
  Repository,
  'name' | 'owner' | 'nameWithOwner' | 'url' | 'stargazerCount'
> & {
  numOfMyContributions?: number;
};

export const renderContributorStatsCard = async (
  username: string,
  name: string,
  contributorStats: ContributionsStats[] = [],
  {
    columns = ['star_rank'],
    hide = [],
    line_height = 25,
    hide_title = false,
    hide_border = false,
    order_by = 'stars',
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_radius,
    border_color,
    custom_title,
    theme = 'default',
    locale,
    limit = -1,
    contributor_fetcher,
  }: {
    /**
     * @default ['star_rank']
     */
    columns?: Columns[];
    hide?: string[];
    /**
     * @default 25
     */
    line_height?: number;
    /**
     * @default false
     */
    hide_title?: boolean;
    /**
     * @default false
     */
    hide_border?: boolean;
    /**
     * @default 'stars'
     */
    order_by?: OrderByOptions;
    title_color?: string;
    icon_color?: string;
    text_color?: string;
    bg_color?: string;
    border_radius?: number;
    border_color?: string;
    custom_title?: string;
    /**
     * @default 'default'
     */
    theme?: ThemeNames;
    locale?: string;
    /**
     * @default none
     */
    limit?: number;
    contributor_fetcher?: ContributorFetcher;
  } = {},
) => {
  const lheight = parseInt(String(line_height), 10);

  // returns theme based colors with proper overrides and defaults
  const { titleColor, textColor, iconColor, bgColor, borderColor } = getCardColors({
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_color,
    theme,
  });

  const apostrophe = ['x', 's'].includes(name.slice(-1).toLocaleLowerCase()) ? '' : 's';
  const i18n = new I18n({
    locale,
    translations: statCardLocales({ name, apostrophe }),
  });

  const imageBase64s = await Promise.all(
    Object.values(contributorStats).map((contributorStat) => {
      const url = new URL(contributorStat.owner.avatarUrl);
      url.searchParams.append('s', '50');
      return getImageBase64FromURL(url.toString());
    }),
  );

  const calculateStarRank = shouldCalculateStarRank(columns);
  const calculateContributorRank = shouldCalculateContributorRank(columns);

  let allContributorsByRepo: Contributor[][];
  if (calculateContributorRank) {
    // Use custom fetcher if provided, otherwise use default
    const fetchContributors: ContributorFetcher = contributor_fetcher || getContributors;
    // Fetch sequentially to respect rate limiting (not in parallel with Promise.all)
    allContributorsByRepo = [];
    for (const { nameWithOwner } of Object.values(contributorStats)) {
      const contributors = await fetchContributors(username, nameWithOwner, token!);
      allContributorsByRepo.push(contributors);
    }
  }

  const RANK_VALUES = {
    'S+': 5,
    S: 4,
    'A+': 3,
    A: 2,
    'B+': 1,
    B: 0,
  } satisfies Record<Rank, number>;

  type TransformedContributionStat = {
    name: string;
    imageBase64: string;
    url: string;
    stars: number;
    contributionRank: Rank | undefined;
    starRank: Rank | undefined;
  };

  const getContributionRank = (i: TransformedContributionStat) =>
    i.contributionRank === undefined ? -1 : RANK_VALUES[i.contributionRank];

  const sortFunction = (a: TransformedContributionStat, b: TransformedContributionStat) =>
    order_by == 'stars'
      ? b.stars - a.stars
      : getContributionRank(b) - getContributionRank(a);

  const transformedContributorStats: TransformedContributionStat[] = contributorStats
    .map(({ url, name, stargazerCount, numOfMyContributions }, index) => {
      const contributionRank =
        calculateContributorRank && numOfMyContributions !== undefined
          ? calculateContributionsRank(
              name,
              allContributorsByRepo[index],
              numOfMyContributions,
            )
          : undefined;

      if (contributionRank && hide.includes(contributionRank)) {
        return undefined;
      }

      const starRank = calculateStarRank ? calculateStarsRank(stargazerCount) : undefined;

      if (starRank && hide.includes(starRank)) {
        return undefined;
      }

      return {
        name,
        imageBase64: imageBase64s[index],
        url,
        stars: stargazerCount,
        contributionRank,
        starRank,
      } as const;
    })
    .filter(
      (s: TransformedContributionStat | undefined): s is TransformedContributionStat =>
        s !== undefined,
    )
    .sort(sortFunction);

  let statItems = Object.values(transformedContributorStats).map((stat, index) => {
    const ranksMap = {
      star_rank: stat.starRank,
      contribution_rank: stat.contributionRank,
    } satisfies Record<Columns, Rank | undefined>;

    // create the text nodes, and pass index so that we can calculate the line spacing
    return createTextNode({
      ...stat,
      index,
      ranks: columns
        .map((column) => ranksMap[column])
        .filter((rank) => rank !== undefined) as Rank[],
    });
  });

  statItems = limit > 0 ? statItems.slice(0, limit) : statItems.slice();

  // Calculate the card height depending on how many items there are
  // but if rank circle is visible clamp the minimum height to `150`
  const distanceY = 8;
  const height = Math.max(30 + 45 + (statItems.length + 1) * (lheight + distanceY), 150);

  const cssStyles = getStyles({
    titleColor,
    textColor,
    iconColor,
    show_icons: true,
  });

  const width = 495;

  const card = new Card({
    customTitle: custom_title,
    defaultTitle: i18n.t('statcard.title'),
    titlePrefixIcon: '',
    columns,
    width,
    height,
    border_radius,
    colors: {
      titleColor,
      textColor,
      iconColor,
      bgColor,
      borderColor,
    },
  });

  card.setHideBorder(hide_border);
  card.setHideTitle(hide_title);
  card.setCSS(cssStyles);

  return card.render(`
    <svg overflow="visible">
      ${flexLayout({
        items: statItems,
        gap: lheight + distanceY,
        direction: 'column',
      }).join('')}
    </svg>
  `);
};
