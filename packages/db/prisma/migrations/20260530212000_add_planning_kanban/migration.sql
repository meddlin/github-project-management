CREATE TYPE "PlanningStatus" AS ENUM ('NO_STATUS', 'BACKLOG', 'READY', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
CREATE TYPE "PlanningStatusSource" AS ENUM ('NONE', 'GITHUB_LABEL', 'GITHUB_PROJECT', 'LOCAL');

ALTER TABLE "GitHubIssue"
ADD COLUMN "planningStatus" "PlanningStatus" NOT NULL DEFAULT 'NO_STATUS',
ADD COLUMN "planningStatusSource" "PlanningStatusSource" NOT NULL DEFAULT 'NONE',
ADD COLUMN "planningStatusUpdatedAt" TIMESTAMP(3);

CREATE TABLE "GitHubProject" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitHubRepositoryProject" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GitHubRepositoryProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitHubProjectItem" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "importedStatusName" TEXT,
    "importedStatusOption" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL,
    "itemUpdatedAt" TIMESTAMP(3),

    CONSTRAINT "GitHubProjectItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubProject_nodeId_key" ON "GitHubProject"("nodeId");
CREATE INDEX "GitHubProject_owner_title_idx" ON "GitHubProject"("owner", "title");
CREATE INDEX "GitHubProject_importedAt_idx" ON "GitHubProject"("importedAt");

CREATE UNIQUE INDEX "GitHubRepositoryProject_repositoryId_projectId_key" ON "GitHubRepositoryProject"("repositoryId", "projectId");
CREATE INDEX "GitHubRepositoryProject_projectId_idx" ON "GitHubRepositoryProject"("projectId");

CREATE UNIQUE INDEX "GitHubProjectItem_nodeId_key" ON "GitHubProjectItem"("nodeId");
CREATE UNIQUE INDEX "GitHubProjectItem_projectId_issueId_key" ON "GitHubProjectItem"("projectId", "issueId");
CREATE INDEX "GitHubProjectItem_issueId_idx" ON "GitHubProjectItem"("issueId");
CREATE INDEX "GitHubProjectItem_projectId_importedAt_idx" ON "GitHubProjectItem"("projectId", "importedAt");

CREATE INDEX "GitHubIssue_repositoryId_planningStatus_updatedAt_idx" ON "GitHubIssue"("repositoryId", "planningStatus", "updatedAt");

ALTER TABLE "GitHubRepositoryProject" ADD CONSTRAINT "GitHubRepositoryProject_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubRepositoryProject" ADD CONSTRAINT "GitHubRepositoryProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitHubProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubProjectItem" ADD CONSTRAINT "GitHubProjectItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GitHubProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GitHubProjectItem" ADD CONSTRAINT "GitHubProjectItem_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "GitHubIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
