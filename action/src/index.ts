import * as fs from 'fs';
import * as path from 'path';

import * as core from '@actions/core';
import _ from 'lodash';

import { parseInputs } from './parse-input';

import { renderContributorStatsCard, type ContributorFetcher } from '@/cards/stats-card';
import { getColumnCriteria } from '@/common/utils';
import { fetchAllContributorStats } from '@/fetchAllContributorStats';
import { type Contributor } from '@/fetchContributors';
import { fetchContributorStats } from '@/fetchContributorStats';

// Rate-limited contributor fetcher
let requestCount = 0;
let lastRequestTime = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Secondary rate limit: 900 points/minute for REST API (GET = 1 point)
// To stay safe, we target ~600 requests/minute = 100ms between requests minimum
const MIN_REQUEST_INTERVAL_MS = 100;

function createRateLimitedFetcher(): ContributorFetcher {
  return async (
    _username: string,
    nameWithOwner: string,
    token: string,
  ): Promise<Contributor[]> => {
    // Enforce minimum interval between requests (secondary rate limit protection)
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
      await sleep(MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest);
    }
    lastRequestTime = Date.now();

    requestCount++;

    // Log progress
    if (requestCount % 10 === 0) {
      core.info(`  Fetched contributors for ${requestCount} repositories...`);
    }

    const url = `https://api.github.com/repos/${nameWithOwner}/contributors?per_page=100`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'github-contributor-stats-action',
    };

    if (token) {
      headers['Authorization'] = `token ${token}`;
    }

    const response = await fetch(url, { headers });

    // Check rate limit headers
    const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
    const rateLimitReset = response.headers.get('x-ratelimit-reset');
    const rateLimitLimit = response.headers.get('x-ratelimit-limit');
    const retryAfter = response.headers.get('retry-after');

    // Handle rate limit responses (403 for primary, 429 for secondary)
    if (response.status === 403 || response.status === 429) {
      let waitTime: number;

      // Check retry-after header first (secondary rate limit)
      if (retryAfter) {
        waitTime = parseInt(retryAfter) * 1000 + 1000; // +1s buffer
        core.info(
          `Secondary rate limit hit. retry-after: ${retryAfter}s. Waiting ${Math.ceil(
            waitTime / 1000,
          )}s...`,
        );
      }
      // Check x-ratelimit-reset (primary rate limit)
      else if (rateLimitReset) {
        const resetTime = parseInt(rateLimitReset, 10) * 1000;
        waitTime = Math.max(0, resetTime - Date.now()) + 1000; // +1s buffer
        core.info(
          `Primary rate limit reached (${rateLimitRemaining}/${rateLimitLimit}). Waiting ${Math.ceil(
            waitTime / 1000,
          )}s until reset...`,
        );
      }
      // Fallback: wait 60 seconds as recommended by GitHub docs
      else {
        waitTime = 60000;
        core.info(
          `Rate limit hit (no retry info). Waiting 60s as recommended by GitHub docs...`,
        );
      }

      await sleep(waitTime);
      // Retry after waiting
      requestCount--;
      lastRequestTime = 0; // Reset to allow immediate retry
      return createRateLimitedFetcher()(_username, nameWithOwner, token);
    }

    // Log rate limit info on first request for diagnostics
    if (requestCount === 1) {
      core.info(
        `Rate limit info: ${rateLimitRemaining}/${rateLimitLimit} remaining (resets at ${
          rateLimitReset
            ? new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()
            : 'N/A'
        })`,
      );

      // Warn if limit is 60 - this indicates unauthenticated requests (primary rate limit)
      // Per GitHub docs: unauthenticated=60/hr, GITHUB_TOKEN=1000/hr, PAT=5000/hr
      if (rateLimitLimit && parseInt(rateLimitLimit, 10) === 60) {
        core.warning(
          `⚠️ Rate limit is 60/hour (unauthenticated primary rate limit).\n` +
            `   Expected: 1000/hr for GITHUB_TOKEN, 5000/hr for PAT.\n` +
            `   Possible causes:\n` +
            `   - GITHUB_TOKEN may not work for external repos' contributors API\n` +
            `   - Token may be invalid or missing\n` +
            `   Solution: Use a PAT with 'public_repo' scope.\n` +
            `   Create at: https://github.com/settings/tokens`,
        );
      }
    }

    // Proactively wait if we're about to exhaust primary rate limit
    if (rateLimitRemaining && parseInt(rateLimitRemaining, 10) <= 1 && rateLimitReset) {
      const resetTime = parseInt(rateLimitReset, 10) * 1000;
      const waitTime = Math.max(0, resetTime - Date.now()) + 1000;
      core.info(
        `Primary rate limit almost exhausted (${rateLimitRemaining}/${rateLimitLimit}). Waiting ${Math.ceil(
          waitTime / 1000,
        )}s until reset...`,
      );
      await sleep(waitTime);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to fetch contributors for ${nameWithOwner}\n` +
          `  Status: ${response.status} ${response.statusText}\n` +
          `  URL: ${url}\n` +
          `  Rate-Limit-Limit: ${rateLimitLimit}\n` +
          `  Rate-Limit-Remaining: ${rateLimitRemaining}\n` +
          `  Rate-Limit-Reset: ${rateLimitReset} (${
            rateLimitReset
              ? new Date(parseInt(rateLimitReset, 10) * 1000).toISOString()
              : 'N/A'
          })\n` +
          `  Retry-After: ${retryAfter}\n` +
          `  Response body: ${body}`,
      );
    }

    const contributors = (await response.json()) as Contributor[];
    return contributors;
  };
}

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

    const contributorRankCriteria = getColumnCriteria(columns, 'contribution_rank');

    // Fetch contributor stats
    core.info('Fetching contribution data...');
    const result = await (combine_all_yearly_contributions
      ? fetchAllContributorStats(username)
      : fetchContributorStats(username));

    if (result === undefined) {
      throw new Error('Failed to fetch contributor stats');
    }

    const name = result.name;
    const contributorStats = result.repositoriesContributedTo.nodes;

    console.log(
      JSON.stringify(
        contributorStats.map((repo) => {
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

    core.info(`Found ${contributorStats.length} repositories`);

    // Create rate-limited fetcher if needed
    const contributorFetcher = contributorRankCriteria
      ? createRateLimitedFetcher()
      : undefined;

    if (contributorRankCriteria) {
      core.info(
        `Will fetch contributors for ${contributorStats.length} repositories with rate limiting`,
      );
      core.info(
        `Min interval between requests: ${MIN_REQUEST_INTERVAL_MS}ms (secondary rate limit protection)`,
      );
      core.info(`Total contributor API requests made: ${requestCount}`);
    }

    // Render the card
    core.info('Rendering SVG...');
    const svg = await renderContributorStatsCard(username, name, contributorStats, {
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
