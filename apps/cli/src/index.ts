#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";

config({ path: process.env.GPM_ENV_FILE ?? ".env", quiet: true });

const requiredEnvVars = ["DATABASE_URL", "GITHUB_PAT"] as const;

const program = new Command();

function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error("Missing required environment variables:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Environment configuration is valid.");
}

program
  .name("gpm")
  .description("CLI for GitHub project management workflows.")
  .version("0.1.0");

program
  .command("doctor")
  .description("Validate local configuration required by the CLI.")
  .action(validateEnvironment);

const scriptArgs = process.argv.slice(2);
const argv =
  scriptArgs[0] === "--"
    ? [...process.argv.slice(0, 2), ...scriptArgs.slice(1)]
    : process.argv;

program.parse(argv);
