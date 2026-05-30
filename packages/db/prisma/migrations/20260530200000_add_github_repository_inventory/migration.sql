CREATE TABLE "GitHubRepository" (
    "id" TEXT NOT NULL,
    "githubId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibility" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL,
    "isFork" BOOLEAN NOT NULL,
    "isArchived" BOOLEAN NOT NULL,
    "defaultBranch" TEXT,
    "pushedAt" TIMESTAMP(3),
    "githubUpdatedAt" TIMESTAMP(3),
    "hasLinkedProject" BOOLEAN NOT NULL,
    "linkedProjectCount" INTEGER NOT NULL,
    "hasIssuesCreated" BOOLEAN NOT NULL,
    "issueCount" INTEGER NOT NULL,
    "openIssueCount" INTEGER NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitHubRepositorySyncRun" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "repositoryCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubRepositorySyncRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubRepository_githubId_key" ON "GitHubRepository"("githubId");
CREATE UNIQUE INDEX "GitHubRepository_nodeId_key" ON "GitHubRepository"("nodeId");
CREATE UNIQUE INDEX "GitHubRepository_fullName_key" ON "GitHubRepository"("fullName");
CREATE INDEX "GitHubRepository_fullName_idx" ON "GitHubRepository"("fullName");
CREATE INDEX "GitHubRepository_owner_idx" ON "GitHubRepository"("owner");
CREATE INDEX "GitHubRepository_syncedAt_idx" ON "GitHubRepository"("syncedAt");
CREATE INDEX "GitHubRepositorySyncRun_startedAt_idx" ON "GitHubRepositorySyncRun"("startedAt");
CREATE INDEX "GitHubRepositorySyncRun_status_idx" ON "GitHubRepositorySyncRun"("status");
