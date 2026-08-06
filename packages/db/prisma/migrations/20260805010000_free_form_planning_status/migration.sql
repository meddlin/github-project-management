ALTER TABLE "GitHubIssue" ALTER COLUMN "planningStatus" DROP DEFAULT;

ALTER TABLE "GitHubIssue" ALTER COLUMN "planningStatus" DROP NOT NULL;

ALTER TABLE "GitHubIssue" ALTER COLUMN "planningStatus" TYPE TEXT USING (
  CASE "planningStatus"::text
    WHEN 'NO_STATUS' THEN NULL
    WHEN 'BACKLOG' THEN 'Backlog'
    WHEN 'READY' THEN 'Ready'
    WHEN 'IN_PROGRESS' THEN 'In progress'
    WHEN 'IN_REVIEW' THEN 'In review'
    WHEN 'DONE' THEN 'Done'
    ELSE NULL
  END
);

DROP TYPE "PlanningStatus";
