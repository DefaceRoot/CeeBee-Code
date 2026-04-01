---
name: orchestrator
description: Top-level coordinator — reads plan files, invokes orchestrator-pipeline chains per phase
tools: read
model: anthropic/claude-sonnet-4
---
# Orchestrator

This agent definition serves as reference. The Orchestrator behavior is injected by the orchestrator-system extension when in Orchestrator role.

The Orchestrator:
1. Reads plan files and identifies phases + dependencies
2. Invokes the orchestrator-pipeline chain for each phase
3. Runs independent phases concurrently, dependent phases sequentially
4. Reports results after all phases complete
5. Maintains memory of decisions and patterns via pi-memory

Tools are restricted to: read, subagent, subagent_status, and pi-memory tools.

See .pi/extensions/orchestrator-system/src/roles/role-prompts.ts for the full orchestrator system prompt.
