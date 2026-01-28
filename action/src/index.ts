import * as fs from 'fs';
import * as path from 'path';

import * as core from '@actions/core';
import _ from 'lodash';

import {
  createRateLimitedFetcher,
  getRequestCount,
  MIN_REQUEST_INTERVAL_MS,
} from './createRateLimitedFetcher';
import { parseInputs } from './parseInputs';

import { getColumnCriteria } from '@/common/utils';
import { fetchAllContributorStats } from '@/fetchAllContributorStats';
import { fetchContributorStats } from '@/fetchContributorStats';
import { renderContributorStatsCard } from '@/svg-rendering/stats-card';

async function run(): Promise<void> {
  try {
    // Parse and validate inputs
    const {
      username,
      output_file,
      combine_all_yearly_contributions,
      columns,
      order_by,
      limit,
      exclude,
      theme,
      title_color,
      text_color,
      icon_color,
      bg_color,
      border_color,
      border_radius,
      hide_title,
      hide_border,
      custom_title,
      locale,
    } = parseInputs();

    core.info(`Generating stats for user: ${username}`);
    core.info(`Combine all yearly contributions: ${combine_all_yearly_contributions}`);
    core.info(`Columns: ${columns.map((col) => col.name).join(', ')}`);

    const fetchOtherContributors = Boolean(
      getColumnCriteria(columns, 'contribution_rank'),
    );

    // Fetch contributor stats
    core.info('Fetching contribution data...');
    const result = await (combine_all_yearly_contributions
      ? fetchAllContributorStats(username)
      : fetchContributorStats(username));

    if (result === undefined) {
      throw new Error('Failed to fetch contributor stats');
    }

    const name = result.name;
    const reposWithStats = result.repositoriesContributedTo.nodes;

    console.log(
      JSON.stringify(
        reposWithStats.map((repo) => {
          _.pick(repo, [
            'nameWithOwner',
            'stargazerCount',
            'numContributedCommits',
            'numContributedPrs',
          ]);
        }),
        null,
        2,
      ),
    );

    core.info(`Found ${reposWithStats.length} repositories`);

    // Create rate-limited fetcher if needed
    const contributorFetcher = fetchOtherContributors
      ? createRateLimitedFetcher()
      : undefined;

    if (fetchOtherContributors) {
      core.info(
        `Will fetch contributors for ${reposWithStats.length} repositories with rate limiting`,
      );
      core.info(
        `Min interval between requests: ${MIN_REQUEST_INTERVAL_MS}ms (secondary rate limit protection)`,
      );
    }

    // Render the card
    core.info('Rendering SVG...');
    const svg = await renderContributorStatsCard(username, name, reposWithStats, {
      columns,
      hide_title,
      hide_border,
      order_by,
      title_color,
      icon_color,
      text_color,
      bg_color,
      custom_title,
      border_radius,
      border_color,
      theme,
      locale,
      limit,
      exclude,
      contributor_fetcher: contributorFetcher,
    });

    if (fetchOtherContributors) {
      core.info(`Total contributor API requests made: ${getRequestCount()}`);
    }

    // Write SVG to file
    const outputPath = path.resolve(process.cwd(), output_file);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, svg);

    core.info(`SVG written to: ${outputPath}`);
    core.setOutput('svg-path', outputPath);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unknown error occurred');
    }
  }
}

run();
