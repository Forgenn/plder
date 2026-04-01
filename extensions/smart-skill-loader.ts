/**
 * Smart Skill Loader Extension
 *
 * Automatically detects when skills should be triggered based on user input
 * and injects the full skill content into the system prompt.
 */

import { readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface SkillTrigger {
	name: string;
	patterns: RegExp[];
}

const SKILL_TRIGGERS: SkillTrigger[] = [
	{
		name: "brainstorming",
		patterns: [
			/\b(implement|build|create|add|make|develop)\s+(?:a\s+)?(?:new\s+)?\w+/i,
			/\bI want to\s+(build|create|implement|add|develop)/i,
			/\blet['\']?s\s+(build|create|implement|add|develop)/i,
			/\bwe want to\s+(implement|build|create|add)/i,
		],
	},
	{
		name: "tdd",
		patterns: [
			/\b(test|testing|spec|unit test)/i,
			/\bwrite\s+tests?\s+for/i,
			/\btest[- ]driven/i,
			/\bfailing\s+test/i,
		],
	},
	{
		name: "git-worktree",
		patterns: [
			/\b(new\s+feature|feature\s+branch|start\s+working\s+on)/i,
			/\bbranch\s+for/i,
			/\bworktree/i,
		],
	},
	{
		name: "code-review",
		patterns: [
			/\b(review|pr|pull request|ready\s+for\s+review)/i,
			/\bmerge\s+(this|the)/i,
			/\bcompleted?\s+(feature|implementation)/i,
		],
	},
	{
		name: "web",
		patterns: [
			/\b(research|investigate|look\s*up|search\s+for|find\s+out|check\s+online)/i,
			/\b(what\s+is|how\s+to|how\s+does|what\s+are|why\s+does|is\s+there)\b/i,
			/\b(latest|current|recent|new|updated?)\s+(version|release|docs?|documentation|api)/i,
			/\b(verify|confirm|fact[- ]?check|validate|double[- ]?check)/i,
			/\b(compare|alternatives|best\s+practice|recommended|which\s+is\s+better)/i,
			/\bhttps?:\/\//i,
			/\b(docs?|documentation|reference|tutorial|guide)\s+(for|on|about)/i,
			/\b(what\s+changed|breaking\s+changes?|migration|upgrade)\b/i,
		],
	}
];

async function findSkillFile(skillName: string, cwd: string): Promise<string | null> {
	const possiblePaths = [
		// plder skills
		"C:/Users/Pol/OpenCloud/Personal/Programacio/plder/skills/" + skillName + "/SKILL.md",
		// Local project skills
		join(cwd, ".pi/skills/" + skillName + "/SKILL.md"),
		join(cwd, ".agents/skills/" + skillName + "/SKILL.md"),
		// Global skills
		join(process.env.HOME || process.env.USERPROFILE || "", ".pi/agent/skills/" + skillName + "/SKILL.md"),
	];

	for (const path of possiblePaths) {
		try {
			await access(path);
			return path;
		} catch {
			// File doesn't exist, continue
		}
	}
	return null;
}

export default function (pi: ExtensionAPI) {
	let triggeredSkills = new Set<string>();

	pi.on("before_agent_start", async (event, ctx) => {
		const userMessage = event.messages?.[event.messages.length - 1]?.content;
		if (!userMessage) return;

		const matchedSkills: string[] = [];
		
		// Check each skill trigger
		for (const trigger of SKILL_TRIGGERS) {
			if (triggeredSkills.has(trigger.name)) continue;
			
			const isMatch = trigger.patterns.some(pattern => 
				pattern.test(userMessage)
			);
			
			if (isMatch) {
				const skillPath = await findSkillFile(trigger.name, ctx?.cwd || process.cwd());
				if (skillPath) {
					try {
						const skillContent = await readFile(skillPath, "utf-8");
						matchedSkills.push(`\n### Auto-loaded: ${trigger.name}\n${skillContent}`);
						triggeredSkills.add(trigger.name);
						console.log(`[Smart Skill Loader] Auto-loaded skill: ${trigger.name} from ${skillPath}`);
					} catch (error) {
						console.error(`[Smart Skill Loader] Failed to load skill ${trigger.name}:`, error);
					}
				} else {
					console.warn(`[Smart Skill Loader] Skill ${trigger.name} not found in any location`);
				}
			}
		}

		if (matchedSkills.length > 0) {
			const skillsSection = [
				"\n\n## Auto-Loaded Skills",
				"The following skills were automatically loaded based on your request:",
				...matchedSkills
			].join("\n");

			return { systemPrompt: event.systemPrompt + skillsSection };
		}
	});
}