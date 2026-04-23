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
			/\b(test|testing|spec|unit\s*test|integration\s*test)/i,
			/\bwrite\s+tests?\s+for/i,
			/\btest[- ]driven/i,
			/\bfailing\s+test/i,
			/\b(implement|build|create|add|fix|bugfix|bug\s*fix)\b/i,
			/\bred[- ]green/i,
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

// Skills that stay in the prompt for the entire session once triggered.
// Most skills are one-shot (load once, guide that turn).
// Persistent skills are re-injected on every subsequent turn.
const PERSISTENT_SKILLS = new Set(["tdd"]);

export default function (pi: ExtensionAPI) {
	// Skills triggered for the first time this turn
	const triggeredSkills = new Set<string>();
	// Skills that have been triggered at least once this session — re-injected every turn
	const persistentActive = new Set<string>();
	// Cache: skillName → file content
	const contentCache = new Map<string, string>();

	async function loadSkill(name: string, cwd: string): Promise<string | null> {
		if (contentCache.has(name)) return contentCache.get(name)!;
		const skillPath = await findSkillFile(name, cwd);
		if (!skillPath) {
			console.warn(`[Smart Skill Loader] Skill ${name} not found in any location`);
			return null;
		}
		try {
			const content = await readFile(skillPath, "utf-8");
			contentCache.set(name, content);
			console.log(`[Smart Skill Loader] Loaded skill: ${name} from ${skillPath}`);
			return content;
		} catch (error) {
			console.error(`[Smart Skill Loader] Failed to load skill ${name}:`, error);
			return null;
		}
	}

	pi.on("before_agent_start", async (event, ctx) => {
		const userMessage = event.messages?.[event.messages.length - 1]?.content;
		if (!userMessage) return;

		const cwd = ctx?.cwd || process.cwd();
		const toInject: string[] = [];

		// 1. Re-inject persistent skills that were triggered in a previous turn
		for (const name of persistentActive) {
			const content = await loadSkill(name, cwd);
			if (content) toInject.push(`\n### Active: ${name}\n${content}`);
		}

		// 2. Check each trigger for newly matched skills this turn
		for (const trigger of SKILL_TRIGGERS) {
			if (triggeredSkills.has(trigger.name)) continue;
			if (persistentActive.has(trigger.name)) continue; // already injected above

			const isMatch = trigger.patterns.some(pattern => pattern.test(userMessage));
			if (!isMatch) continue;

			const content = await loadSkill(trigger.name, cwd);
			if (!content) continue;

			toInject.push(`\n### Auto-loaded: ${trigger.name}\n${content}`);
			triggeredSkills.add(trigger.name);

			if (PERSISTENT_SKILLS.has(trigger.name)) {
				persistentActive.add(trigger.name);
			}
		}

		if (toInject.length === 0) return;

		const skillsSection = [
			"\n\n## Active Skills",
			...toInject,
		].join("\n");

		return { systemPrompt: event.systemPrompt + skillsSection };
	});

	// Clear session state on new session
	pi.on("session_switch", async () => {
		triggeredSkills.clear();
		persistentActive.clear();
		contentCache.clear();
	});
}