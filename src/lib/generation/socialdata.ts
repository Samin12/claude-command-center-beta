const BASE_URL = 'https://api.socialdata.tools';

export async function searchTweets(query: string, apiKey: string): Promise<unknown> {
  const url = `${BASE_URL}/twitter/search?query=${encodeURIComponent(query)}&type=Latest`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SocialData search failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Return condensed tweet data to save Claude's context
  const tweets = (data.tweets || []).slice(0, 10).map((t: Record<string, unknown>) => ({
    text: t.full_text || t.text,
    user: (t.user as Record<string, unknown>)?.screen_name,
    favorites: t.favorite_count,
    retweets: t.retweet_count,
    date: t.created_at,
  }));
  return { tweets, count: tweets.length };
}

export async function getUser(username: string, apiKey: string): Promise<unknown> {
  const clean = username.replace(/^@/, '');
  const url = `${BASE_URL}/twitter/user/${encodeURIComponent(clean)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SocialData user lookup failed (${res.status}): ${text}`);
  }
  const user = await res.json();
  return {
    name: user.name,
    screen_name: user.screen_name,
    description: user.description,
    followers_count: user.followers_count,
    friends_count: user.friends_count,
    statuses_count: user.statuses_count,
    verified: user.verified,
    location: user.location,
    created_at: user.created_at,
  };
}
