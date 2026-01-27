import * as core from '@actions/core';

import { type Contributor } from '@/fetchContributors';
import type { ContributorFetcher } from '@/processStats';

// Rate-limited contributor fetcher
let requestCount = 0;
let lastRequestTime = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getRequestCount = (): number => requestCount;

// Secondary rate limit: 900 points/minute for REST API (GET = 1 point)
// To stay safe, we target ~600 requests/minute = 100ms between requests minimum
export const MIN_REQUEST_INTERVAL_MS = 100;

export function createRateLimitedFetcher(): ContributorFetcher {
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
