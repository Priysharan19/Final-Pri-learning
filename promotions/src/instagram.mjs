export function extractInstagramMessages(payload) {
  const result = [];
  for (const entry of payload?.entry ?? []) {
    for (const event of entry?.messaging ?? []) {
      const senderId = event?.sender?.id;
      const text = event?.message?.text;
      if (!senderId || typeof text !== 'string' || event?.message?.is_echo) continue;
      result.push({ senderId: String(senderId), text: text.trim(), messageId: event?.message?.mid ?? null });
    }
  }
  return result;
}

export async function fetchInstagramProfile({ scopedId, accessToken, apiVersion = 'v23.0', fetchImpl = fetch }) {
  const url = new URL(`https://graph.instagram.com/${apiVersion}/${encodeURIComponent(scopedId)}`);
  url.searchParams.set('fields', 'id,name,username,is_user_follow_business,is_business_follow_user');
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Instagram profile lookup failed with ${response.status}`;
    throw new Error(message);
  }
  return {
    id: String(body.id ?? scopedId),
    name: body.name ?? null,
    username: body.username ?? null,
    followsBusiness: typeof body.is_user_follow_business === 'boolean' ? body.is_user_follow_business : null,
    businessFollowsUser: typeof body.is_business_follow_user === 'boolean' ? body.is_business_follow_user : null,
  };
}

export async function sendInstagramText({ accountId, recipientScopedId, text, accessToken, apiVersion = 'v23.0', fetchImpl = fetch }) {
  const url = `https://graph.instagram.com/${apiVersion}/${encodeURIComponent(accountId)}/messages`;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: recipientScopedId },
      message: { text },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `Instagram send failed with ${response.status}`;
    throw new Error(message);
  }
  return body;
}
