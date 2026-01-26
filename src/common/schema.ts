import z from 'zod';

import { themeNames, type ThemeNames } from 'themes';

// allows true or false string, returns boolean
export const parseBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

export const parseArray = z
  .string()
  .optional()
  .transform((val) => val?.split(',') ?? []);

// accounts for optional strings that may be empty
export const emptyStringToUndefined = z
  .string()
  .optional()
  .transform((val) => val || undefined);

export const commonSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  combine_all_yearly_contributions: parseBoolean.default('true'),
  hide_contributor_rank: parseBoolean.default('true'),
  order_by: z.enum(['stars', 'contribution_rank']).optional().default('stars'),
  limit: z.coerce.number().int().optional().default(-1),
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
  border_radius: z.coerce.number().nonnegative().optional(),
  hide_title: parseBoolean,
  hide_border: parseBoolean,
  custom_title: emptyStringToUndefined,
  locale: emptyStringToUndefined.transform((val) => val?.toLowerCase()),
});
