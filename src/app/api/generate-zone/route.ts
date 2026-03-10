import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { WORLD_BUILDER_SYSTEM_PROMPT } from '@/lib/generation/skill-prompt';
import { validateZone, stampObjectTiles } from '@/lib/generation/validate-zone';
import { searchTweets, getUser } from '@/lib/generation/socialdata';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { GenerativeZone } from '@/types/world';

// Load sprite catalog at module level (cached)
let spriteCatalog: string | null = null;
function getSpriteCatalog(): string {
  if (!spriteCatalog) {
    try {
      const p = join(process.cwd(), 'public', 'pokemon', 'sprites.json');
      spriteCatalog = readFileSync(p, 'utf-8');
    } catch {
      spriteCatalog = JSON.stringify({ npcs: [], buildings: [], interiors: [] });
    }
  }
  return spriteCatalog;
}

// Tool definitions for Claude API
function getToolDefinitions(hasSocialData: boolean): Anthropic.Tool[] {
  const tools: Anthropic.Tool[] = [
    {
      name: 'list_sprites',
      description: 'Return the full sprite catalog organized by category (npcs, buildings, interiors). Call this once before building a zone.',
      input_schema: { type: 'object' as const, properties: {}, required: [] },
    },
    {
      name: 'create_zone',
      description: `Create a game zone with tilemap, NPCs, buildings, signs, graves, and interiors.

TILE LEGEND: 0=GRASS, 1=TREE(solid), 2=PATH, 3=TALL_GRASS, 6=FLOWER, 7=FENCE(solid), 9=WATER(solid), 10=ROUTE_EXIT
DO NOT place tiles 4,5,8,11 — they are auto-stamped from buildings/signs/graves arrays.
Place ROUTE_EXIT (10) at map edges so the player can leave.`,
      input_schema: {
        type: 'object' as const,
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9-]+$', description: 'Zone ID (lowercase, hyphens only)' },
          name: { type: 'string', description: 'Display name' },
          description: { type: 'string', description: 'Description shown on zone entry' },
          width: { type: 'number', minimum: 8, maximum: 60, description: 'Map width in tiles' },
          height: { type: 'number', minimum: 8, maximum: 60, description: 'Map height in tiles' },
          tilemap: {
            type: 'array',
            items: { type: 'array', items: { type: 'number' } },
            description: '2D array [row][col] of tile IDs. Must match height x width.',
          },
          playerStart: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
          npcs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
                direction: { type: 'string', enum: ['down', 'up', 'left', 'right'] },
                spritePath: { type: 'string' },
                dialogue: { type: 'array', items: { type: 'string' } },
                patrol: { type: 'array', items: { type: 'string', enum: ['down', 'up', 'left', 'right'] } },
              },
              required: ['id', 'name', 'x', 'y', 'direction', 'spritePath', 'dialogue'],
            },
          },
          buildings: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
                width: { type: 'number', minimum: 2, maximum: 6 },
                height: { type: 'number', minimum: 2, maximum: 5 },
                doorX: { type: 'number' },
                doorY: { type: 'number' },
                spriteFile: { type: 'string' },
                closedMessage: { type: 'string' },
              },
              required: ['id', 'label', 'x', 'y', 'width', 'height', 'doorX', 'doorY', 'spriteFile'],
            },
          },
          signs: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                text: { type: 'array', items: { type: 'string' } },
              },
              required: ['x', 'y', 'text'],
            },
          },
          graves: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                name: { type: 'string' },
                epitaph: { type: 'string' },
              },
              required: ['x', 'y', 'name', 'epitaph'],
            },
          },
          interiors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                buildingId: { type: 'string' },
                backgroundImage: { type: 'string' },
                npcs: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      x: { type: 'number', minimum: 0, maximum: 9 },
                      y: { type: 'number', minimum: 0, maximum: 6 },
                      direction: { type: 'string', enum: ['down', 'up', 'left', 'right'] },
                      spritePath: { type: 'string' },
                      dialogue: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['id', 'name', 'x', 'y', 'direction', 'spritePath', 'dialogue'],
                  },
                },
              },
              required: ['buildingId', 'backgroundImage'],
            },
          },
        },
        required: ['id', 'name', 'description', 'width', 'height', 'tilemap', 'playerStart'],
      },
    },
  ];

  if (hasSocialData) {
    tools.push(
      {
        name: 'twitter_search',
        description: 'Search Twitter/X for tweets. Supports operators like from:user, since:YYYY-MM-DD, min_faves:N. Returns up to 10 recent tweets.',
        input_schema: {
          type: 'object' as const,
          properties: {
            query: { type: 'string', description: 'Search query (e.g. "from:elonmusk", "crypto crash")' },
          },
          required: ['query'],
        },
      },
      {
        name: 'twitter_get_user',
        description: 'Get a Twitter/X user profile (bio, followers, location, etc.)',
        input_schema: {
          type: 'object' as const,
          properties: {
            username: { type: 'string', description: 'Twitter username (without @)' },
          },
          required: ['username'],
        },
      },
    );
  }

  return tools;
}

// Execute a tool call and return the result
async function executeTool(
  name: string,
  input: Record<string, unknown>,
  socialDataKey: string | null,
): Promise<{ result: string; zone?: GenerativeZone }> {
  switch (name) {
    case 'list_sprites':
      return { result: getSpriteCatalog() };

    case 'create_zone': {
      const now = new Date().toISOString();
      const zone: GenerativeZone = {
        id: input.id as string,
        name: input.name as string,
        description: input.description as string,
        version: 1,
        createdAt: now,
        updatedAt: now,
        width: input.width as number,
        height: input.height as number,
        tilemap: input.tilemap as number[][],
        playerStart: input.playerStart as { x: number; y: number },
        npcs: (input.npcs as GenerativeZone['npcs']) || [],
        buildings: (input.buildings as GenerativeZone['buildings']) || [],
        signs: (input.signs as GenerativeZone['signs']) || [],
        graves: (input.graves as GenerativeZone['graves']) || [],
        interiors: (input.interiors as GenerativeZone['interiors'])?.map(i => ({
          ...i,
          npcs: i.npcs || [],
        })),
      };

      stampObjectTiles(zone);

      const error = validateZone(zone);
      if (error) {
        return { result: `Validation error: ${error}` };
      }

      return {
        result: `Zone "${zone.name}" (${zone.id}) created. ${zone.width}x${zone.height} tiles, ${zone.npcs.length} NPCs, ${zone.buildings.length} buildings, ${zone.signs.length} signs, ${zone.graves.length} graves.`,
        zone,
      };
    }

    case 'twitter_search': {
      if (!socialDataKey) return { result: 'Twitter search not available (no API key)' };
      try {
        const data = await searchTweets(input.query as string, socialDataKey);
        return { result: JSON.stringify(data) };
      } catch (e) {
        return { result: `Twitter search error: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    case 'twitter_get_user': {
      if (!socialDataKey) return { result: 'Twitter user lookup not available (no API key)' };
      try {
        const data = await getUser(input.username as string, socialDataKey);
        return { result: JSON.stringify(data) };
      } catch (e) {
        return { result: `Twitter user error: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    default:
      return { result: `Unknown tool: ${name}` };
  }
}

// Map tool names to user-friendly progress messages
function getProgressMessage(toolName: string): string {
  switch (toolName) {
    case 'list_sprites': return 'Browsing sprites...';
    case 'twitter_search': return 'Researching on Twitter/X...';
    case 'twitter_get_user': return 'Looking up profile...';
    case 'create_zone': return 'Building your world...';
    default: return 'Working...';
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const prompt: string = body.prompt;

  if (!prompt || typeof prompt !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicKey = req.headers.get('x-anthropic-key');
  if (!anthropicKey) {
    return new Response(JSON.stringify({ error: 'Missing Anthropic API key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const socialDataKey = req.headers.get('x-socialdata-key') || null;

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(type: string, data: unknown) {
        const payload = JSON.stringify({ type, ...data as Record<string, unknown> });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }

      try {
        const client = new Anthropic({ apiKey: anthropicKey });
        const tools = getToolDefinitions(!!socialDataKey);

        let messages: Anthropic.MessageParam[] = [
          {
            role: 'user',
            content: `Create a PokAImon game zone about: ${prompt}`,
          },
        ];

        sendEvent('progress', { message: 'Starting generation...' });

        const MAX_ITERATIONS = 15;
        let generatedZone: GenerativeZone | null = null;

        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            system: WORLD_BUILDER_SYSTEM_PROMPT,
            tools,
            messages,
          });

          // Check if there are tool_use blocks
          const toolBlocks = response.content.filter(
            (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use'
          );

          if (toolBlocks.length === 0) {
            // No more tool calls — generation complete
            break;
          }

          // Process each tool call
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolBlock of toolBlocks) {
            sendEvent('progress', { message: getProgressMessage(toolBlock.name) });

            const { result, zone } = await executeTool(
              toolBlock.name,
              toolBlock.input as Record<string, unknown>,
              socialDataKey,
            );

            if (zone) {
              generatedZone = zone;
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: result,
            });
          }

          // Add assistant message + tool results for next iteration
          messages = [
            ...messages,
            { role: 'assistant', content: response.content },
            { role: 'user', content: toolResults },
          ];

          // If we got a zone, we can stop after this iteration
          if (generatedZone && response.stop_reason === 'end_turn') {
            break;
          }
        }

        if (generatedZone) {
          sendEvent('complete', { zone: generatedZone });
        } else {
          sendEvent('error', { message: 'Generation completed but no zone was created. Try a different prompt.' });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes('401') || message.includes('authentication')) {
          sendEvent('error', { message: 'Invalid API key. Please check your Anthropic API key.' });
        } else {
          sendEvent('error', { message: `Generation failed: ${message}` });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
