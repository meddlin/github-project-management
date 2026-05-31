CREATE TABLE "GitHubIssue" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "authorLogin" TEXT,
    "labels" TEXT[],
    "assignees" TEXT[],
    "commentCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubIssue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubIssue_repositoryId_number_key" ON "GitHubIssue"("repositoryId", "number");
CREATE UNIQUE INDEX "GitHubIssue_repositoryId_githubId_key" ON "GitHubIssue"("repositoryId", "githubId");
CREATE UNIQUE INDEX "GitHubIssue_nodeId_key" ON "GitHubIssue"("nodeId");
CREATE INDEX "GitHubIssue_repositoryId_state_updatedAt_idx" ON "GitHubIssue"("repositoryId", "state", "updatedAt");
CREATE INDEX "GitHubIssue_repositoryId_number_idx" ON "GitHubIssue"("repositoryId", "number");
CREATE INDEX "GitHubIssue_syncedAt_idx" ON "GitHubIssue"("syncedAt");

ALTER TABLE "GitHubIssue" ADD CONSTRAINT "GitHubIssue_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
