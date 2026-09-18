# Restore bounded dashboard filters

## Changes
- Keep the dashboard heading and filter controls together in the sticky top band on mobile and larger screens.
- Place that sticky band and the dashboard summaries above “Target vs Actual by Province” in one bounded section.
- Let the sticky band scroll away when “Target vs Actual by Province” reaches the visible dashboard area.

## Validation
- Check the dashboard at desktop and mobile widths.
- Confirm the controls stay pinned while summary data scrolls, then release before the province chart.
- Confirm the current build remains healthy.

## Technical details
- Reuse the existing sticky page wrapper and its app-header offset.
- Correct the dashboard DOM grouping rather than adding scroll listeners or duplicate controls.
