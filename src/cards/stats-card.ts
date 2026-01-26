import { type ThemeNames } from '../../themes';

import { calculateStarsRank, calculateContributionsRank, ranks } from '@/calculateRank';
import { renderCard } from '@/common/Card';
import { I18n } from '@/common/I18n';
import type { ColumnCriteria } from '@/common/schema';
import { type ColumnName, type OrderByOptions } from '@/common/schema';
import {
  clampValue,
  flexLayout,
  getCardColors,
  getImageBase64FromURL,
  measureText,
  getColumnCriteria,
} from '@/common/utils';
import { fetchContributors, type Contributor } from '@/fetchContributors';
import { type Repository } from '@/fetchContributorStats';
import { getStyles } from '@/getStyles';
import { statCardLocales } from '@/translations';

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

// Type for custom contributor fetcher function
export type ContributorFetcher = (
  username: string,
  nameWithOwner: string,
  token: string,
) => Promise<Contributor[]>;

let maxWidth = 0;

const createRow = ({
  imageBase64,
  name,
  valueCells: valueCellCriteria,
  index,
}: {
  imageBase64: string;
  name: string;
  valueCells: (string | undefined)[];
  index: number;
}) => {
  const staggerDelay = (index + 3) * 150;

  let offset = clampValue(measureText(name, 18), 230, 400);
  offset += offset === 230 ? 5 : 15;

  const circleRadius = 14;
  const xAlign = 4;
  const yAlign = 18.5;
  const cellWidths: number[] = [];

  const renderCellText = (val: string, x: number, y: number) => `
   <g class="cell-text">
      <text x="${val.includes('+') ? x : 7.2}" y="${y}">
      ${val}
      </text>
    </g>
    `;

  const getValueCellContent = (val: string | undefined) => {
    if (val == undefined) {
      return { item: '', width: 0 };
    }
    if ((ranks as readonly string[]).includes(val)) {
      return {
        item: `
    <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="${circleRadius}" />
    ${renderCellText(val, val.includes('+') ? xAlign : 7.2, yAlign)}
    `,
        width: circleRadius * 2,
      };
    }
    return { item: renderCellText(val, xAlign, yAlign), width: measureText(val, 18) };
  };

  const valueCells = valueCellCriteria.map((val) => {
    const { item, width } = getValueCellContent(val);
    cellWidths.push(width);
    maxWidth = Math.max(maxWidth, offset + width);
    const fullItem = `
    <g data-testid="value-cell" transform="translate(${offset}, 0)">
        ${item}
    </g>
        `;
    offset += 50;
    return fullItem;
  });

  return {
    content: `
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
      ${valueCells}
    </g>
  `,
    cellWidths,
  };
};

export type ContributionsStats = Pick<
  Repository,
  'name' | 'owner' | 'nameWithOwner' | 'url' | 'stargazerCount'
> & {
  numContributions?: number;
};

export const renderContributorStatsCard = async (
  username: string,
  name: string,
  contributorStats: ContributionsStats[] = [],
  {
    columns = [{ name: 'star_rank', hide: [] }],
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
    contributor_fetcher = fetchContributors,
  }: {
    /**
     * @default ['star_rank']
     */
    columns?: ColumnCriteria[];
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

  const starRankCriteria = getColumnCriteria(columns, 'star_rank');
  const contributorRankCriteria = getColumnCriteria(columns, 'contribution_rank');
  const commitsCriteria = getColumnCriteria(columns, 'commits');

  let allContributorsByRepo: Contributor[][];
  if (contributorRankCriteria) {
    // Fetch sequentially to respect rate limiting (not in parallel with Promise.all)
    allContributorsByRepo = [];
    for (const { nameWithOwner } of Object.values(contributorStats)) {
      const contributors = await contributor_fetcher(username, nameWithOwner, token!);
      allContributorsByRepo.push(contributors);
    }
  }

  const allCellWidths: number[][] = [];
  const calculatedStats = contributorStats
    .map(({ url, name, stargazerCount, numContributions }, index) => {
      if (
        commitsCriteria?.minimum !== undefined &&
        numContributions !== undefined &&
        numContributions < commitsCriteria.minimum
      ) {
        return undefined;
      }

      const contributionRank =
        contributorRankCriteria && numContributions !== undefined
          ? calculateContributionsRank(
              name,
              allContributorsByRepo[index],
              numContributions,
            )
          : undefined;

      if (contributionRank && contributorRankCriteria?.hide.includes(contributionRank)) {
        return undefined;
      }

      const starRank = starRankCriteria ? calculateStarsRank(stargazerCount) : undefined;

      if (starRank && starRankCriteria?.hide.includes(starRank)) {
        return undefined;
      }

      return {
        name,
        imageBase64: imageBase64s[index],
        url,
        numContributions,
        contributionRank,
        numStars: stargazerCount,
        starRank,
      };
    })
    .filter((s): s is Exclude<typeof s, undefined> => s !== undefined)
    .sort((a, b) =>
      order_by == 'stars'
        ? b.numStars - a.numStars
        : (b.numContributions ?? 0) - (a.numContributions ?? 0),
    )
    .slice(0, limit > 0 ? limit : undefined);

  const statRows = calculatedStats.map((stat, index) => {
    const columnValsMap = {
      star_rank: stat.starRank,
      contribution_rank: stat.contributionRank,
      commits: stat.numContributions?.toString(),
    } satisfies Record<ColumnName, string | undefined>;

    // create the text nodes, and pass index so that we can calculate the line spacing
    const { content, cellWidths } = createRow({
      ...stat,
      index,
      valueCells: columns.map((c) => columnValsMap[c.name]),
    });
    allCellWidths.push(cellWidths);
    return content;
  });

  const columnWidths: number[] = allCellWidths.reduce((acc, row) =>
    acc.map((max, i) => Math.max(max, row[i])),
  );

  // Calculate the card height depending on how many items there are
  // but if rank circle is visible clamp the minimum height to `150`
  const distanceY = 8;
  const height = Math.max(30 + 45 + (statRows.length + 1) * (lheight + distanceY), 150);

  const cssStyles = getStyles({
    titleColor: titleColor as string,
    textColor: textColor as string,
    iconColor: iconColor as string,
    show_icons: true,
  });

  return renderCard({
    customTitle: custom_title,
    defaultTitle: i18n.t('statcard.title'),
    body: `
    <svg overflow="visible">
      ${flexLayout({
        items: statRows,
        gap: lheight + distanceY,
        direction: 'column',
      }).join('')}
    </svg>
  `,
    columns: columns.map((column, i) => ({
      column: column.name,
      width: columnWidths[i],
    })),
    width: maxWidth,
    height,
    border_radius,
    hide_border,
    hide_title,
    css: cssStyles,
    colors: {
      titleColor,
      textColor,
      iconColor,
      bgColor,
      borderColor,
    },
  });
};
