import compression from 'compression';
import express from 'express';
import { z } from 'zod';

import { renderContributorStatsCard } from '@/cards/stats-card';
import {
  clampValue,
  CONSTANTS,
  CustomError,
  parseArray,
  parseBoolean,
  renderError,
} from '@/common/utils';
import { fetchAllContributorStats } from '@/fetchAllContributorStats';
import { fetchContributorStats } from '@/fetchContributorStats';
import { isLocaleAvailable } from '@/translations';

// Query parameter validation schema
const querySchema = z.object({
  username: z.string(),
  hide: z.string().optional().transform(parseArray),
  hide_title: z.string().optional().transform(parseBoolean),
  hide_border: z.string().optional().transform(parseBoolean),
  hide_contributor_rank: z.string().optional().transform(parseBoolean),
  order_by: z.enum(['stars', 'contribution_rank']).optional(),
  line_height: z.coerce.number().int().optional(),
  title_color: z.string().optional(),
  icon_color: z.string().optional(),
  text_color: z.string().optional(),
  bg_color: z.string().optional(),
  custom_title: z.string().optional(),
  border_radius: z.coerce.number().optional(),
  border_color: z.string().optional(),
  theme: z.string().optional(),
  cache_seconds: z.coerce.number().int().optional(),
  locale: z
    .string()
    .optional()
    .transform((val) => val?.toLowerCase()),
  combine_all_yearly_contributions: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

// Initialize Express
const app = express();
app.use(compression());

// Create GET request
app.get('/api', async (req, res) => {
  const parsedQuery = querySchema.parse(req.query);
  const { locale, combine_all_yearly_contributions, username, cache_seconds } =
    parsedQuery;
  res.set('Content-Type', 'image/svg+xml');

  if (locale && !isLocaleAvailable(locale)) {
    return res.send(renderError('Something went wrong', 'Language not found'));
  }

  try {
    const result = await (combine_all_yearly_contributions
      ? fetchAllContributorStats(username)
      : fetchContributorStats(username));

    if (result === undefined) {
      throw new Error('Failed to fetch contributor stats');
    }

    const name = result.name;
    const contributorStats = result.repositoriesContributedTo.nodes;

    const cacheSeconds = clampValue(
      cache_seconds ?? CONSTANTS.FOUR_HOURS,
      CONSTANTS.FOUR_HOURS,
      CONSTANTS.ONE_DAY,
    );

    res.setHeader('Cache-Control', `public, max-age=${cacheSeconds}`);

    res.send(
      await renderContributorStatsCard(username, name, contributorStats, parsedQuery),
    );
  } catch (err: unknown) {
    if (err instanceof Error) {
      return res.send(
        renderError(
          err.message,
          err instanceof CustomError ? err.secondaryMessage : undefined,
        ),
      );
    }
  }
});

const port = 9999;

app.listen(port, () => {
  console.log(`Express app listening on port ${port}`);
});
