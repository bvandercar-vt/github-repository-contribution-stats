import * as core from '@actions/core';
import type z from 'zod';

import {
  commonInputSchema,
  emptyStringToUndefined,
  mergeHideIntoColumnCriteria,
} from '@/common/schema';

const inputSchema = commonInputSchema
  .extend({
    output_file: emptyStringToUndefined.default('github-contributor-stats.svg'),
  })
  .transform(mergeHideIntoColumnCriteria);

export type ValidatedInputs = z.infer<typeof inputSchema>;

export function parseInputs(): ValidatedInputs {
  return inputSchema.parse({
    username: core.getInput('username', { required: true }),
    output_file: core.getInput('output-file'),
    combine_all_yearly_contributions: core.getInput('combine-all-yearly-contributions'),
    columns: core.getInput('columns'),
    hide: core.getInput('hide'),
    order_by: core.getInput('order-by'),
    limit: core.getInput('limit'),
    exclude: core.getInput('exclude'),
    theme: core.getInput('theme'),
    title_color: core.getInput('title-color'),
    text_color: core.getInput('text-color'),
    icon_color: core.getInput('icon-color'),
    bg_color: core.getInput('bg-color'),
    border_color: core.getInput('border-color'),
    border_radius: core.getInput('border-radius'),
    hide_title: core.getBooleanInput('hide-title'),
    hide_border: core.getBooleanInput('hide-border'),
    custom_title: core.getInput('custom-title'),
    locale: core.getInput('locale'),
  });
}
