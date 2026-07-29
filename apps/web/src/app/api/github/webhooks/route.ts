import { createHmac, timingSafeEqual } from "node:crypto";
import { syncRepositoryIssues } from "@/lib/github-issue-sync";

type GitHubWebhookPayload = {
  action?: string;
  repository?: {
    name?: string;
    owner?: {
      login?: string;
    };
  };
};

const handledIssueActions = new Set([
  "assigned",
  "closed",
  "deleted",
  "edited",
  "labeled",
  "opened",
  "reopened",
  "transferred",
  "unassigned",
  "unlabeled"
]);

function getWebhookSecret() {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("GITHUB_WEBHOOK_SECRET is required to receive GitHub webhooks.");
  }

  return secret;
}

function isValidSignature({
  body,
  secret,
  signature
}: {
  body: string;
  secret: string;
  signature: string | null;
}) {
  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const secret = getWebhookSecret();
  const signature = request.headers.get("x-hub-signature-256");

  if (!isValidSignature({ body, secret, signature })) {
    return Response.json({ error: "Invalid GitHub webhook signature." }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");

  if (event !== "issues") {
    return Response.json({ message: "Event ignored." }, { status: 202 });
  }

  const payload = JSON.parse(body) as GitHubWebhookPayload;
  const action = payload.action ?? "";

  if (!handledIssueActions.has(action)) {
    return Response.json({ message: "Issue action ignored." }, { status: 202 });
  }

  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;

  if (!owner || !repo) {
    return Response.json({ error: "Webhook payload did not include a repository." }, { status: 400 });
  }

  const result = await syncRepositoryIssues({ owner, repo });

  return Response.json({
    message: "Repository issues synced.",
    result
  });
}
