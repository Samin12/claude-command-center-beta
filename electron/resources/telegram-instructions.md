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

## Step-by-Step Workflow

### Step 1: Acknowledge Receipt (immediate)
- `send_telegram("Got it! Looking into this...")`
- Do this FIRST, before any other tool call

### Step 2: Narrate Before Acting
Before each blocking operation, send a short update:
- Before `list_agents`: `send_telegram("Checking which agents are available...")`
- Before `delegate_task`: `send_telegram("Asking [agent name] to handle this. I'll let you know when they're done...")`
- Before `wait_for_agent`: `send_telegram("Waiting on [agent name] to finish...")`
- Before `start_agent`: `send_telegram("Starting [agent name] on [task]...")`

### Step 3: Report Results
- After getting results: `send_telegram("Here's what I found: [concrete details]")`
- On errors: `send_telegram("Something went wrong: [error]. Trying [alternative]...")`
- On timeout: `send_telegram("[Agent] is still working. I'll keep waiting...")`

### Step 4: Final Confirmation (CRITICAL)
- **NEVER consider a task complete without sending a final `send_telegram`**
- Include specific details about what was done, not just "Done"
- Include relevant output, errors, or next steps

## Example: Simple Task

User: "Run the tests for the auth module"

1. `send_telegram("On it! Let me find the right agent for this.")`
2. `list_agents` → find test-agent
3. `send_telegram("Found the test agent. Running auth module tests now... This may take a minute.")`
4. `delegate_task(id="test-agent", prompt="Run tests for auth module")` → wait
5. `send_telegram("Tests completed! Results: 15 passed, 0 failed. All auth tests passing. ✅")`

## Example: Multi-Agent Task

User: "Deploy the new feature and update the docs"

1. `send_telegram("Got it — I'll coordinate the deploy and docs update in parallel.")`
2. `list_agents` → find deploy-agent and docs-agent
3. `send_telegram("Starting deploy-agent on deployment and docs-agent on documentation...")`
4. `start_agent` on both
5. `send_telegram("Both agents are working. Waiting for deploy to finish first...")`
6. `wait_for_agent(id="deploy-agent")` → done
7. `send_telegram("Deploy finished successfully! Now waiting on docs...")`
8. `wait_for_agent(id="docs-agent")` → done
9. `send_telegram("All done! Deploy completed and docs are updated. Here's the summary: [details]")`

## Important Reminders

- The user CANNOT see your terminal output — only `send_telegram` messages reach them
- Short updates are fine: "Working on it..." is better than silence
- Use the agent's name so the user knows who's doing what
- If a task takes longer than expected, send "Still working, this is taking a bit longer..."
- For multi-step tasks, number your updates: "Step 1/3: ..." so the user knows progress
