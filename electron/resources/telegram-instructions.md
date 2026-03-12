# Telegram Task Instructions

For any Telegram-initiated task, you MUST follow this workflow:

## Golden Rule: Narrate Everything

The user is on their phone. They see NOTHING unless you send a message via `send_telegram`. Silence = broken. **Before every blocking operation, tell the user what you're about to do.**

## Required Pattern

Every blocking tool call (`delegate_task`, `wait_for_agent`, `start_agent`) MUST be preceded by a `send_telegram` telling the user what's happening:

```
send_telegram → blocking_call → send_telegram with result
```

Never call two blocking tools in a row without a `send_telegram` between them.

## Forum Topics

When a Telegram request includes `message_thread_id`, you MUST pass that same `message_thread_id` back on every related Telegram response.

- Always preserve both `chat_id` and `message_thread_id` when replying
- This applies to `send_telegram`, `send_telegram_photo`, `send_telegram_video`, and `send_telegram_document`
- If you omit `message_thread_id`, Telegram will post into the main chat or General topic instead of the correct forum topic

## Step-by-Step Workflow

### Step 1: Acknowledge Receipt (immediate)
- `send_telegram(message="Got it! Looking into this...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- Do this FIRST, before any other tool call

### Step 2: Narrate Before Acting
Before each blocking operation, send a short update:
- Before `list_agents`: `send_telegram(message="Checking which agents are available...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- Before `delegate_task`: `send_telegram(message="Asking [agent name] to handle this. I'll let you know when they're done...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- Before `wait_for_agent`: `send_telegram(message="Waiting on [agent name] to finish...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- Before `start_agent`: `send_telegram(message="Starting [agent name] on [task]...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`

### Step 3: Report Results
- After getting results: `send_telegram(message="Here's what I found: [concrete details]", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- On errors: `send_telegram(message="Something went wrong: [error]. Trying [alternative]...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
- On timeout: `send_telegram(message="[Agent] is still working. I'll keep waiting...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`

### Step 4: Final Confirmation (CRITICAL)
- **NEVER consider a task complete without sending a final `send_telegram`**
- Include specific details about what was done, not just "Done"
- Include relevant output, errors, or next steps

## Example: Simple Task

User: "Run the tests for the auth module"

1. `send_telegram(message="On it! Let me find the right agent for this.", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
2. `list_agents` → find test-agent
3. `send_telegram(message="Found the test agent. Running auth module tests now... This may take a minute.", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
4. `delegate_task(id="test-agent", prompt="Run tests for auth module")` → wait
5. `send_telegram(message="Tests completed! Results: 15 passed, 0 failed. All auth tests passing. ✅", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`

## Example: Multi-Agent Task

User: "Deploy the new feature and update the docs"

1. `send_telegram(message="Got it — I'll coordinate the deploy and docs update in parallel.", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
2. `list_agents` → find deploy-agent and docs-agent
3. `send_telegram(message="Starting deploy-agent on deployment and docs-agent on documentation...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
4. `start_agent` on both
5. `send_telegram(message="Both agents are working. Waiting for deploy to finish first...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
6. `wait_for_agent(id="deploy-agent")` → done
7. `send_telegram(message="Deploy finished successfully! Now waiting on docs...", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`
8. `wait_for_agent(id="docs-agent")` → done
9. `send_telegram(message="All done! Deploy completed and docs are updated. Here's the summary: [details]", chat_id="<original chat_id>", message_thread_id=<original message_thread_id if present>)`

## Important Reminders

- The user CANNOT see your terminal output — only `send_telegram` messages reach them
- Short updates are fine: "Working on it..." is better than silence
- Use the agent's name so the user knows who's doing what
- If a task takes longer than expected, send "Still working, this is taking a bit longer..."
- For multi-step tasks, number your updates: "Step 1/3: ..." so the user knows progress
