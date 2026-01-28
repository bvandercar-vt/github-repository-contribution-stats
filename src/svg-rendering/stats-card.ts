import { type ThemeNames } from '../../themes';

import { ranks } from '@/calculateRank';
import { I18n } from '@/common/I18n';
import type { ColumnCriteria } from '@/common/schema';
import { type ColumnName, type OrderByOptions } from '@/common/schema';
import { clampValue, flexLayout, getCardColors, measureText } from '@/common/utils';
import { fetchContributors } from '@/fetchContributors';
import type { Repository } from '@/fetchContributorStats';
import { getStyles } from '@/getStyles';
import type { RepoWithStats, ContributorFetcher } from '@/processStats';
import { processStats } from '@/processStats';
import { renderCard } from '@/svg-rendering/_outer_card';
import { statCardLocales } from '@/translations';

let maxWidth = 0;

const renderRow = ({
  imageBase64,
  name,
  url,
  valueCells: valueCellCriteria,
  index,
}: {
  imageBase64: string;
  valueCells: (string | undefined)[];
  index: number;
} & Pick<Repository, 'name' | 'url'>) => {
  const staggerDelay = (index + 3) * 150;

  let offset = clampValue(measureText(name, 18), 230, 400);
  offset += offset === 230 ? 5 : 15;

  const circleRadius = 14;
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
      return { item: '', width: 0, addlOffset: 0 };
    }
    if ((ranks as readonly string[]).includes(val)) {
      return {
        item: `
    <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="${circleRadius}" />
    ${renderCellText(val, val.includes('+') ? 4 : 7.2, yAlign)}
    `,
        width: circleRadius * 2,
        addlOffset: 0,
      };
    }
    return {
      item: renderCellText(val, 0, yAlign),
      width: measureText(val, 18),
      addlOffset: -6,
    };
  };

  const valueCells = valueCellCriteria.map((val) => {
    const { item, width, addlOffset } = getValueCellContent(val);
    cellWidths.push(width);
    maxWidth = Math.max(maxWidth, offset + width);
    const fullItem = `
    <g data-testid="value-cell" transform="translate(${offset + addlOffset}, 0)">
        ${item}
    </g>
        `;
    offset += 50;
    return fullItem;
  });

  return {
    content: `
    <g class="stagger" style="animation-delay: ${staggerDelay}ms" transform="translate(25, 0)">
    <a xlink:href="${url}" target="_blank">
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
    </a>
    </g>
  `,
    cellWidths,
  };
};

export const renderContributorStatsCard = async (
  username: string,
  name: string,
  reposWithStats: RepoWithStats[] = [],
  {
    columns = [{ name: 'star_rank' }],
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
    exclude = [],
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
    exclude?: string[];
    contributor_fetcher?: ContributorFetcher;
  } = {},
) => {
  const processedStats = await processStats(reposWithStats, {
    username,
    columns,
    order_by,
    limit,
    exclude,
    contributor_fetcher,
  });

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

  const allCellWidths: number[][] = [];

  const statRows = processedStats.map((repo, index) => {
    const columnValsMap = {
      star_rank: repo.starRank,
      contribution_rank: repo.contributionRank,
      commits: repo.numContributedCommits?.toString(),
      pull_requests: repo.numContributedPrs?.toString(),
    } satisfies Record<ColumnName, string | undefined>;

    // create the text nodes, and pass index so that we can calculate the line spacing
    const { content, cellWidths } = renderRow({
      ...repo,
      index,
      valueCells: columns.map((c) => columnValsMap[c.name]),
    });
    allCellWidths.push(cellWidths);
    return content;
  });

  const columnWidths: number[] =
    allCellWidths.length > 0
      ? allCellWidths.reduce((acc, row) => acc.map((max, i) => Math.max(max, row[i])))
      : [];

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
    columns: columns.map((column, i) => ({ ...column, width: columnWidths[i] })),
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
