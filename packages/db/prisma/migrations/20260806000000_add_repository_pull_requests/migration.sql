ALTER TABLE "GitHubRepository"
  ADD COLUMN "primaryLanguageName" TEXT,
  ADD COLUMN "primaryLanguageColor" TEXT,
  ADD COLUMN "pullRequestCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "openPullRequestCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pullRequestsSyncedAt" TIMESTAMP(3);

CREATE TABLE "GitHubPullRequest" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorLogin" TEXT,
    "isDraft" BOOLEAN NOT NULL,
    "commentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubPullRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubPullRequest_repositoryId_number_key" ON "GitHubPullRequest"("repositoryId", "number");
CREATE UNIQUE INDEX "GitHubPullRequest_repositoryId_githubId_key" ON "GitHubPullRequest"("repositoryId", "githubId");
CREATE UNIQUE INDEX "GitHubPullRequest_nodeId_key" ON "GitHubPullRequest"("nodeId");
CREATE INDEX "GitHubPullRequest_repositoryId_state_updatedAt_idx" ON "GitHubPullRequest"("repositoryId", "state", "updatedAt");
CREATE INDEX "GitHubPullRequest_repositoryId_updatedAt_idx" ON "GitHubPullRequest"("repositoryId", "updatedAt");
CREATE INDEX "GitHubPullRequest_syncedAt_idx" ON "GitHubPullRequest"("syncedAt");

ALTER TABLE "GitHubPullRequest" ADD CONSTRAINT "GitHubPullRequest_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
