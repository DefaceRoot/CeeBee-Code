---
name: orchestrator-pipeline
description: Full orchestration pipeline — plan, implement, validate, document
---

## planning-lead

{task}

## engineering-lead

Verify the planning output below against the original user intent. Confirm the file paths, directories, and proposed changes are correct before delegating to workers. Then implement.

{previous}

## parallel
- qa-worker: Test the changes described below. Write tests, run test suites, report pass/fail. {previous}
- security-reviewer: Review the security of changes described below. Check for vulnerabilities, injection, auth issues, data exposure. {previous}
- performance-tester: Analyze the performance of changes described below. Check for algorithmic complexity, N+1 queries, memory issues. {previous}

## parallel
- changelog-doc-worker: Update CHANGELOG.md for the changes described below. {previous}
- readme-doc-worker: Update README.md if needed for the changes described below. {previous}
- docs-worker: Update relevant documentation files in docs/ for the changes described below. {previous}
