import { server } from "../mocks/node";

export interface SentRequest {
  path: string;
  body: unknown;
}

export function recordRequests(): () => Promise<SentRequest[]> {
  const sent: Promise<SentRequest>[] = [];
  server.events.on("request:start", ({ request }) => {
    sent.push(
      request
        .clone()
        .json()
        .then((body) => ({ path: new URL(request.url).pathname, body })),
    );
  });
  return () => Promise.all(sent);
}
