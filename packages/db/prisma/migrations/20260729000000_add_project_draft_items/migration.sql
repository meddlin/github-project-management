CREATE TYPE "GitHubProjectItemContentType" AS ENUM ('ISSUE', 'DRAFT_ISSUE');

ALTER TABLE "GitHubProjectItem"
  ADD COLUMN "contentType" "GitHubProjectItemContentType" NOT NULL DEFAULT 'ISSUE',
  ADD COLUMN "draftTitle" TEXT,
  ADD COLUMN "draftBodyText" TEXT,
  ADD COLUMN "draftAuthorLogin" TEXT,
  ADD COLUMN "draftAssignees" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "draftCreatedAt" TIMESTAMP(3),
  ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
  ALTER COLUMN "issueId" DROP NOT NULL;
