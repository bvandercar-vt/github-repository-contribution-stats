import compression from 'compression';
import express from 'express';
import { z } from 'zod';

import { renderContributorStatsCard } from '@/cards/stats-card';
import { commonInputSchema, mergeHideIntoColumnCriteria } from '@/common/schema';
import { clampValue, TIMES_S, CustomError, renderError } from '@/common/utils';
import { fetchAllContributorStats } from '@/fetchAllContributorStats';
import { fetchContributorStats } from '@/fetchContributorStats';
import { isLocaleAvailable } from '@/translations';

// Query parameter validation schema
const querySchema = commonInputSchema
  .extend({
    line_height: z.coerce.number().int().optional(),
    cache_seconds: z.coerce.number().int().optional(),
  })
  .transform(mergeHideIntoColumnCriteria);

// Initialize Express
const app = express();
app.use(compression());

// Create GET request
app.get('/api', async (req, res) => {
  const parsedQuery = querySchema.parse(req.query);
  const {
    locale,
    combine_all_yearly_contributions,
    username,
    cache_seconds = TIMES_S.FOUR_HOURS,
  } = parsedQuery;
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

    const cacheSeconds = clampValue(cache_seconds, TIMES_S.FOUR_HOURS, TIMES_S.ONE_DAY);

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
