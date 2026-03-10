import { agents, saveAgents } from '../../core/agent-manager';
import { findAgentByIdOrSession } from './utils';
import { RouteApp, RouteContext } from './types';
import { AgentStatus } from '../../types';

export function registerHooksRoutes(app: RouteApp, ctx: RouteContext): void {
  // POST /api/hooks/output — capture clean text output from agent transcript
  app.post('/api/hooks/output', (req, sendJson) => {
    const { agent_id, session_id, output } = req.body as {
      agent_id: string;
      session_id?: string;
      output: string;
    };

    if (!agent_id || !output) {
      sendJson({ error: 'agent_id and output are required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    if (agent) {
      agent.lastCleanOutput = output;
      saveAgents();
    }

    sendJson({ success: true });
  });

  // POST /api/hooks/status
  app.post('/api/hooks/status', (req, sendJson) => {
    const { agent_id, session_id, status, waiting_reason } = req.body as {
      agent_id: string;
      session_id: string;
      status: 'running' | 'waiting' | 'idle' | 'completed';
      source?: string;
      reason?: string;
      waiting_reason?: string;
    };

    if (!agent_id || !status) {
      sendJson({ error: 'agent_id and status are required' }, 400);
      return;
    }

    const agent: AgentStatus | undefined = findAgentByIdOrSession(agent_id, session_id);
    if (!agent) {
      sendJson({ success: false, message: 'Agent not found' });
      return;
    }

    const oldStatus = agent.status;

    if (status === 'running' && agent.status !== 'running') {
      agent.status = 'running';
      agent.currentSessionId = session_id;
    } else if (status === 'waiting' && agent.status !== 'waiting') {
      agent.status = 'waiting';
    } else if (status === 'idle') {
      agent.status = 'idle';
      agent.currentSessionId = undefined;
    } else if (status === 'completed') {
      agent.status = 'completed';
    }

    agent.lastActivity = new Date().toISOString();

    if (oldStatus !== agent.status) {
      ctx.handleStatusChangeNotificationCallback(agent, agent.status);
      ctx.agentStatusEmitter.emit(`status:${agent.id}`);

      if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
        ctx.mainWindow.webContents.send('agent:status', {
          agentId: agent.id,
          status: agent.status,
          waitingReason: waiting_reason
        });
      }
    }

    sendJson({ success: true, agent: { id: agent.id, status: agent.status } });
  });

  // POST /api/hooks/notification
  app.post('/api/hooks/notification', (req, sendJson) => {
    const { agent_id, session_id, type, title, message } = req.body as {
      agent_id: string;
      session_id: string;
      type: string;
      title: string;
      message: string;
    };

    if (!agent_id || !type) {
      sendJson({ error: 'agent_id and type are required' }, 400);
      return;
    }

    const agent = findAgentByIdOrSession(agent_id, session_id);
    const agentName = agent?.name || 'Claude';

    if (type === 'permission_prompt') {
      if (ctx.appSettings.notifyOnWaiting) {
        ctx.sendNotificationCallback(
          `${agentName} needs permission`,
          message || 'Claude needs your permission to proceed',
          agent?.id
        );
      }
    } else if (type === 'idle_prompt') {
      if (ctx.appSettings.notifyOnWaiting) {
        ctx.sendNotificationCallback(
          `${agentName} is waiting`,
          message || 'Claude is waiting for your input',
          agent?.id
        );
      }
    }

    if (ctx.mainWindow && !ctx.mainWindow.isDestroyed()) {
      ctx.mainWindow.webContents.send('agent:notification', {
        agentId: agent?.id,
        type,
        title,
        message
      });
    }

    sendJson({ success: true });
  });
}
