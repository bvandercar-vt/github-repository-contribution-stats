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

const columns = ['star_rank', 'contribution_rank', 'commits'] as const;

export type Columns = (typeof columns)[number];

const orderByOptions = ['stars', 'contribution_rank'] as const;

export type OrderByOptions = (typeof orderByOptions)[number];

export const commonSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  combine_all_yearly_contributions: parseBoolean.default('true'),
  columns: parseArray.pipe(z.array(z.enum(columns))),
  order_by: z.enum(orderByOptions).optional().default('stars'),
  limit: emptyStringToUndefined.pipe(z.coerce.number().int().optional()),
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
