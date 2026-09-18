# Dashboard sticky regions

## Goal
Keep the “Live monitoring / Fire Safety Inspection Monitoring / Real-time…” title pinned beneath the app header at all times, on mobile and large screens.

Keep the dashboard filter pinned beneath that title only while the summary dashboard is visible. Once “Target vs Actual by Province” reaches the dashboard area, the filter scrolls away while the title remains pinned.

## Changes
- Split the current combined sticky title-and-filter block into two independent sticky regions.
- Keep the title outside the bounded summary wrapper so it remains pinned throughout the dashboard.
- Place the filter inside the summary wrapper so CSS sticky naturally releases at the province section boundary.
- Calculate the filter’s top offset from the app header plus the live title height, ensuring correct positioning on mobile and desktop.
- Verify scrolling at mobile and desktop sizes, including the transition at “Target vs Actual by Province.”

## Technical details
Use CSS sticky positioning and a measured CSS custom property for the title height. No duplicated controls or scroll listeners will be introduced.
