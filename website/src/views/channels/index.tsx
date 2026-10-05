import type { ComponentType } from 'react';
import ChannelGridPage from './ChannelGridPage';
import ChannelPlayerPage from './ChannelPlayerPage';

/**
 * Live Channels page registry (phase-04 WS-05) — merged into the generic tool
 * route (views/dashboard/ToolPage.tsx) the same way as ACADEMY_PAGES /
 * INSTRUCTOR_PAGES / CUSTOMER_PAGES / GYAN_PAGES. Each page renders its own
 * chrome via ToolShell.
 */
export const CHANNEL_PAGES: Record<string, ComponentType> = {
  liveChannels: ChannelGridPage,
  channelPlayer: ChannelPlayerPage,
};

export { ChannelGridPage, ChannelPlayerPage };
