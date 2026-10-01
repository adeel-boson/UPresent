// Errors shared by the Group use cases in this folder.

export class GroupManagementNotPermittedError extends Error {
  constructor(userId: string) {
    super(`User ${userId} is not an org-admin of an approved Organization.`);
    this.name = "GroupManagementNotPermittedError";
  }
}

// Also thrown for a Group of another Organization: from inside one
// Organization's schema, the two can't be told apart.
export class GroupNotFoundError extends Error {
  constructor(groupId: string) {
    super(`Group ${groupId} not found.`);
    this.name = "GroupNotFoundError";
  }
}
