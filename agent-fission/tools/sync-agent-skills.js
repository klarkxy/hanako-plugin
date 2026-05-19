import {
  addEnabledSkillsToAgent,
  ensurePrimaryCaller,
  listAgents,
  normalizeStringList,
  optionalString,
  readAgentSkills,
  readLocalServerInfo,
  requireNonEmptyString,
  resolveHanakoHome,
} from "./lib/runtime.js";

export const name = "sync_agent_skills";
export const description = "Primary agent only. Preview or apply a skill across persistent agents so you can decide whether it belongs on every agent or only a subset.";
export const parameters = {
  type: "object",
  properties: {
    skillName: {
      type: "string",
      description: "Skill name to inspect or enable across agents."
    },
    mode: {
      type: "string",
      enum: ["preview", "apply"],
      description: "Preview shows which agents can receive the skill. Apply enables it for the selected agents."
    },
    agentIds: {
      type: "array",
      items: { type: "string" },
      description: "Optional target agent ids. If omitted, all known agents are considered."
    },
    excludeAgentIds: {
      type: "array",
      items: { type: "string" },
      description: "Optional agent ids to skip from the target set."
    }
  },
  required: ["skillName"]
};

export async function execute(input = {}, ctx = {}) {
  const currentAgentId = requireNonEmptyString(ctx.agentId, "runtime agentId");
  const skillName = requireNonEmptyString(input.skillName, "skillName");
  const mode = optionalString(input.mode) || "preview";
  if (!(["preview", "apply"].includes(mode))) {
    throw new Error("mode must be one of: preview, apply");
  }

  const requestedAgentIds = normalizeStringList(input.agentIds);
  const excludedAgentIds = new Set(normalizeStringList(input.excludeAgentIds));
  const server = readLocalServerInfo(resolveHanakoHome(ctx));

  const agentList = await listAgents(server);
  const agents = Array.isArray(agentList?.agents) ? agentList.agents : [];
  ensurePrimaryCaller(currentAgentId, agents);

  const agentById = new Map(agents.map((agent) => [agent?.id, agent]));
  const baseTargets = requestedAgentIds.length > 0
    ? requestedAgentIds
    : agents.map((agent) => agent.id);
  const targetIds = normalizeStringList(baseTargets).filter((agentId) => agentById.has(agentId) && !excludedAgentIds.has(agentId));

  if (targetIds.length === 0) {
    throw new Error("No valid target agents found for skill sync.");
  }

  const previewRows = [];
  const alreadyEnabled = [];
  const canEnable = [];
  const notVisible = [];

  for (const agentId of targetIds) {
    const agent = agentById.get(agentId);
    const skillView = await readAgentSkills(server, agentId);
    const skills = Array.isArray(skillView?.skills) ? skillView.skills : [];
    const visibleSkill = skills.find((skill) => skill?.name === skillName) || null;
    const enabled = visibleSkill?.enabled === true;
    const currentEnabled = skills.filter((skill) => skill?.enabled).map((skill) => skill.name);
    const row = {
      id: agentId,
      name: agent?.name || agent?.agentName || agentId,
      isPrimary: agent?.isPrimary === true,
      visible: !!visibleSkill,
      enabled,
      currentEnabled,
      currentEnabledCount: currentEnabled.length,
    };

    if (!visibleSkill) {
      row.status = "not-visible";
      notVisible.push(agentId);
    } else if (enabled) {
      row.status = "already-enabled";
      alreadyEnabled.push(agentId);
    } else {
      row.status = "can-enable";
      canEnable.push(agentId);
    }

    previewRows.push(row);
  }

  if (mode === "preview") {
    const lines = [
      `Previewed skill "${skillName}" for ${previewRows.length} agent(s).`,
      `${canEnable.length} can receive it, ${alreadyEnabled.length} already have it, ${notVisible.length} cannot see it.`,
      "Review the target list before applying.",
    ];

    return {
      content: [{ type: "text", text: lines.join("\n") }],
      details: {
        skillName,
        mode,
        summary: {
          targetCount: previewRows.length,
          canEnableCount: canEnable.length,
          alreadyEnabledCount: alreadyEnabled.length,
          notVisibleCount: notVisible.length,
        },
        agents: previewRows,
      },
    };
  }

  const applyRows = previewRows.filter((row) => row.status === "can-enable");

  const applied = [];
  const unchanged = previewRows
    .filter((row) => row.status === "already-enabled")
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
    }));
  const skipped = previewRows
    .filter((row) => row.status === "not-visible")
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
    }));

  for (const row of applyRows) {
    const result = await addEnabledSkillsToAgent(server, row.id, [skillName]);
    if (result.added.includes(skillName)) {
      applied.push({
        id: row.id,
        name: row.name,
        status: "enabled",
      });
      continue;
    }

    unchanged.push({
      id: row.id,
      name: row.name,
      status: "already-enabled",
    });
  }

  const lines = [
    `Applied skill "${skillName}" to ${applied.length} agent(s).`,
    `${unchanged.length} were already enabled and ${skipped.length} were skipped.`,
  ];

  return {
    content: [{ type: "text", text: lines.join("\n") }],
    details: {
      skillName,
      mode,
      summary: {
        targetCount: targetIds.length,
        appliedCount: applied.length,
        alreadyEnabledCount: unchanged.length,
        skippedCount: skipped.length,
      },
      applied,
      unchanged,
      skipped,
    },
  };
}