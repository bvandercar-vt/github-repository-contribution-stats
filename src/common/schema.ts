import _ from 'lodash';
import z from 'zod';

import { themeNames, type ThemeNames } from '../../themes';

// allows true or false string, returns boolean
export const parseBoolean = z
  .union([z.literal('true'), z.literal('false'), z.boolean()])
  .transform((value) => (typeof value === 'boolean' ? value : value === 'true'))
  .optional();

// accounts for optional strings that may be empty
export const emptyStringToUndefined = z
  .string()
  .optional()
  .transform((val) => val || undefined);

export const parseArray = emptyStringToUndefined.transform(
  (val) => val?.split(',').map((v) => v.trim()) ?? [],
);

const commonColumnCriteria = {
  icon: z.enum(['commit', 'pull_request', 'star', 'github', 'rankings']).optional(),
};

const rankColumns = z.enum(['star_rank', 'contribution_rank']);

const rankColumnsCriteria = z.object({
  name: rankColumns,
  hide: parseArray.optional(),
  ...commonColumnCriteria,
});

const columnCriteriaSchema = z.union([
  rankColumnsCriteria,
  z.object({
    name: z.enum(['commits', 'pull_requests']),
    minimum: z.number().optional(),
    ...commonColumnCriteria,
  }),
]);

export type ColumnCriteria = z.infer<typeof columnCriteriaSchema>;
export type ColumnName = ColumnCriteria['name'];
export type ColumnIcon = Exclude<ColumnCriteria['icon'], undefined>;

const parseColumns = z
  .string()
  .transform((val): { name: string }[] => {
    const trimmed = val.trim();

    // Try to parse as JSON array
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Fall through to comma-separated parsing
      }
    }

    // Parse comma-separated string and transform to object format
    return parseArray.parse(trimmed).map((col) => ({ name: col }));
  })
  .pipe(z.array(columnCriteriaSchema));

export const commonInputSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  combine_all_yearly_contributions: parseBoolean.default('true'),
  columns: parseColumns,
  order_by: z.enum(['stars', 'contributions']).optional().default('stars'),
  limit: emptyStringToUndefined.pipe(z.coerce.number().int().optional()),
  exclude: parseArray,
  hide: parseArray,
  theme: z
    .enum(themeNames as [ThemeNames, ...ThemeNames[]])
    .optional()
    .default('default'),
  title_color: emptyStringToUndefined,
  text_color: emptyStringToUndefined,
  icon_color: emptyStringToUndefined,
  bg_color: emptyStringToUndefined,
  border_color: emptyStringToUndefined,
  border_radius: emptyStringToUndefined.pipe(z.coerce.number().nonnegative().optional()),
  hide_title: parseBoolean,
  hide_border: parseBoolean,
  custom_title: emptyStringToUndefined,
  locale: emptyStringToUndefined.transform((val) => val?.toLowerCase()),
});

type CommonInput = z.infer<typeof commonInputSchema>;

export type OrderByOptions = CommonInput['order_by'];

const isRankColumnCriteria = (
  col: ColumnCriteria,
): col is z.infer<typeof rankColumnsCriteria> =>
  (rankColumns.options as string[]).includes(col.name);

export const mergeHideIntoColumnCriteria = <T extends CommonInput>({
  hide,
  columns,
  ...v
}: T) => ({
  columns: columns.map((col) => {
    if (isRankColumnCriteria(col) && hide.length > 0) {
      col.hide = _.uniq((col.hide ?? []).concat(hide));
    }
    return col;
  }),
  ...v,
});
