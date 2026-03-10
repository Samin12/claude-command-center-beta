import { RouteApp, RouteContext } from './types';

export function registerSlackRoutes(app: RouteApp, ctx: RouteContext): void {
  // POST /api/slack/send
  app.post('/api/slack/send', async (req, sendJson) => {
    const { message } = req.body as { message: string };
    if (!message) {
      sendJson({ error: 'message is required' }, 400);
      return;
    }

    const slackApp = ctx.getSlackApp();
    if (!slackApp || !ctx.appSettings.slackChannelId) {
      sendJson({ error: 'Slack not configured or no channel ID' }, 400);
      return;
    }

    try {
      const postParams: { channel: string; text: string; mrkdwn: boolean; thread_ts?: string } = {
        channel: ctx.slackResponseChannel || ctx.appSettings.slackChannelId,
        text: `:crown: ${message}`,
        mrkdwn: true,
      };
      if (ctx.slackResponseThreadTs) {
        postParams.thread_ts = ctx.slackResponseThreadTs;
      }
      await slackApp.client.chat.postMessage(postParams);
      sendJson({ success: true });
    } catch (err) {
      sendJson({ error: `Failed to send: ${err}` }, 500);
    }
  });
}
