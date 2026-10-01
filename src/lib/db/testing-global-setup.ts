import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

import { dumpMigratedTestDatabase } from "@/lib/db/testing";

// Vitest globalSetup: migrates one PGlite database per run and hands its
// data-directory dump (the template) to the workers, where
// createTestDatabase() starts from it.

let templateDir: string | undefined;

export async function setup(project: TestProject): Promise<void> {
  // Migrate before creating the directory, so a failing migration leaves
  // nothing behind to clean up.
  const template = await dumpMigratedTestDatabase();
  templateDir = await mkdtemp(path.join(tmpdir(), "upresent-test-db-"));
  const templatePath = path.join(templateDir, "template.tar");
  await writeTemplate(templatePath, template);
  project.provide("testDatabaseTemplatePath", templatePath);

  // Watch mode reruns tests without rerunning globalSetup. Rebuild the
  // template so a migration generated mid-session is picked up.
  project.onTestsRerun(async () => {
    await writeTemplate(templatePath, await dumpMigratedTestDatabase());
  });
}

export async function teardown(): Promise<void> {
  if (templateDir) {
    await rm(templateDir, { recursive: true, force: true });
  }
}

async function writeTemplate(templatePath: string, template: Blob): Promise<void> {
  await writeFile(templatePath, new Uint8Array(await template.arrayBuffer()));
}
