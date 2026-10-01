import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

import { dumpMigratedTestDatabase } from "@/lib/db/testing";

// Vitest globalSetup: migrates one PGlite database per run and hands its
// dump to the workers, where createTestDatabase() starts from it.
export default async function setup(project: TestProject) {
  const dir = await mkdtemp(path.join(tmpdir(), "upresent-test-db-"));
  const templatePath = path.join(dir, "template.tar");
  const dump = await dumpMigratedTestDatabase();
  await writeFile(templatePath, new Uint8Array(await dump.arrayBuffer()));
  project.provide("testDatabaseTemplate", templatePath);

  return async () => {
    await rm(dir, { recursive: true, force: true });
  };
}
