import z from 'zod';

import { themeNames, type ThemeNames } from 'themes';

const parseBoolean = (value: string | undefined): boolean | undefined => {
  if (value === 'true') {
    return true;
  } else if (value === 'false') {
    return false;
  } else if (value === undefined || value === null) {
    return undefined;
  } else {
    return Boolean(value);
  }
};

// accounts for optional strings that may be empty
export const emptyStringToUndefined = z
  .string()
  .optional()
  .transform((val) => val || undefined);

export const commonSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  combine_all_yearly_contributions: z
    .string()
    .optional()
    .default('true')
    .transform(parseBoolean),
  hide_contributor_rank: z.string().optional().default('true').transform(parseBoolean),
  order_by: z.enum(['stars', 'contribution_rank']).optional().default('stars'),
  limit: z.coerce.number().int().optional().default(-1),
  hide: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',') : [])),
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
  hide_title: z.string().optional().transform(parseBoolean),
  hide_border: z.string().optional().transform(parseBoolean),
  custom_title: emptyStringToUndefined,
  locale: emptyStringToUndefined.transform((val) => val?.toLowerCase()),
});
