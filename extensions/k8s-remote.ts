/**
 * K8s Remote Execution Extension
 *
 * Routes all tool operations (read, write, edit, bash) through kubectl exec
 * to a persistent dev pod on a K8s cluster. Based on pi's SSH extension pattern.
 *
 * Usage:
 *   pi --k8s                           # auto-detect from .pi/k8s.json
 *   pi --k8s dev/plder-dev-pol-0       # namespace/pod explicitly
 *
 * Config (.pi/k8s.json):
 *   { "namespace": "dev", "pod": "plder-dev-pol-0", "container": "dev",
 *     "remoteCwd": "/home/dev", "image": "..." }
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	type BashOperations,
	type ReadOperations,
	type WriteOperations,
	type EditOperations,
	createBashTool,
	createEditTool,
	createReadTool,
	createWriteTool,
} from "@mariozechner/pi-coding-agent";

interface K8sConfig {
	namespace: string;
	pod?: string;
	container: string;
	remoteCwd: string;
	image?: string;
	storageClass?: string;
	storageSize?: string;
	resources?: { cpu?: string; memory?: string };
}

const DEFAULTS: Partial<K8sConfig> = {
	namespace: "dev",
	container: "dev",
	remoteCwd: "/home/dev",
	image: "node:20-bookworm-slim",
	storageClass: "longhorn",
	storageSize: "20Gi",
	resources: { cpu: "2", memory: "4Gi" },
};

// --- kubectl transport ---

function kubectlExec(
	namespace: string,
	pod: string,
	container: string,
	command: string[],
	stdin?: string,
): Promise<{ stdout: Buffer; stderr: Buffer; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const args = ["exec", "-n", namespace, pod, "-c", container];
		if (stdin !== undefined) args.push("-i");
		args.push("--", ...command);

		const child = spawn("kubectl", args, {
			stdio: [stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
		});

		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];
		child.stdout.on("data", (d) => stdoutChunks.push(d));
		child.stderr.on("data", (d) => stderrChunks.push(d));

		if (stdin !== undefined && child.stdin) {
			child.stdin.write(stdin);
			child.stdin.end();
		}

		child.on("error", reject);
		child.on("close", (code) => {
			resolve({
				stdout: Buffer.concat(stdoutChunks),
				stderr: Buffer.concat(stderrChunks),
				exitCode: code ?? 1,
			});
		});
	});
}

function kubectlExecStreaming(
	namespace: string,
	pod: string,
	container: string,
	command: string,
	opts: {
		onData: (data: Buffer) => void;
		signal?: AbortSignal;
		timeout?: number;
	},
): Promise<{ exitCode: number | null }> {
	return new Promise((resolve, reject) => {
		const child = spawn(
			"kubectl",
			[
				"exec",
				"-i",
				"-n",
				namespace,
				pod,
				"-c",
				container,
				"--",
				"bash",
				"-c",
				command,
			],
			{ stdio: ["ignore", "pipe", "pipe"] },
		);

		let timedOut = false;
		const timer = opts.timeout
			? setTimeout(() => {
					timedOut = true;
					child.kill();
				}, opts.timeout * 1000)
			: undefined;

		child.stdout.on("data", opts.onData);
		child.stderr.on("data", opts.onData);

		const onAbort = () => child.kill();
		opts.signal?.addEventListener("abort", onAbort, { once: true });

		child.on("error", (e) => {
			if (timer) clearTimeout(timer);
			reject(e);
		});

		child.on("close", (code) => {
			if (timer) clearTimeout(timer);
			opts.signal?.removeEventListener("abort", onAbort);
			if (opts.signal?.aborted) reject(new Error("aborted"));
			else if (timedOut) reject(new Error(`timeout:${opts.timeout}`));
			else resolve({ exitCode: code });
		});
	});
}

// --- Operations ---

function createRemoteReadOps(
	ns: string,
	pod: string,
	container: string,
	remoteCwd: string,
	localCwd: string,
): ReadOperations {
	const toRemote = (p: string) =>
		p.startsWith(localCwd) ? remoteCwd + p.slice(localCwd.length) : p;
	return {
		readFile: async (p) => {
			const r = await kubectlExec(ns, pod, container, ["cat", toRemote(p)]);
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
			return r.stdout;
		},
		access: async (p) => {
			const r = await kubectlExec(ns, pod, container, [
				"test",
				"-r",
				toRemote(p),
			]);
			if (r.exitCode !== 0) throw new Error("not accessible");
		},
		detectImageMimeType: async (p) => {
			try {
				const r = await kubectlExec(ns, pod, container, [
					"file",
					"--mime-type",
					"-b",
					toRemote(p),
				]);
				const m = r.stdout.toString().trim();
				return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
					m,
				)
					? m
					: null;
			} catch {
				return null;
			}
		},
	};
}

function createRemoteWriteOps(
	ns: string,
	pod: string,
	container: string,
	remoteCwd: string,
	localCwd: string,
): WriteOperations {
	const toRemote = (p: string) =>
		p.startsWith(localCwd) ? remoteCwd + p.slice(localCwd.length) : p;
	return {
		writeFile: async (p, content) => {
			const data = typeof content === "string" ? content : content.toString();
			const r = await kubectlExec(
				ns, pod, container,
				["tee", toRemote(p)],
				data,
			);
			if (r.exitCode !== 0) throw new Error(r.stderr.toString());
		},
		mkdir: async (dir) => {
			await kubectlExec(ns, pod, container, [
				"mkdir",
				"-p",
				toRemote(dir),
			]);
		},
	};
}

function createRemoteEditOps(
	ns: string,
	pod: string,
	container: string,
	remoteCwd: string,
	localCwd: string,
): EditOperations {
	const r = createRemoteReadOps(ns, pod, container, remoteCwd, localCwd);
	const w = createRemoteWriteOps(ns, pod, container, remoteCwd, localCwd);
	return { readFile: r.readFile, access: r.access, writeFile: w.writeFile };
}

function createRemoteBashOps(
	ns: string,
	pod: string,
	container: string,
	remoteCwd: string,
	localCwd: string,
): BashOperations {
	const toRemote = (p: string) =>
		p.startsWith(localCwd) ? remoteCwd + p.slice(localCwd.length) : p;
	return {
		exec: (command, cwd, opts) => {
			const fullCmd = `cd ${JSON.stringify(toRemote(cwd))} && ${command}`;
			return kubectlExecStreaming(ns, pod, container, fullCmd, opts);
		},
	};
}

// --- kubectl management commands ---

function kubectlRun(
	args: string[],
	stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	return new Promise((resolve, reject) => {
		const child = spawn("kubectl", args, {
			stdio: [stdin !== undefined ? "pipe" : "ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (d) => (stdout += d));
		child.stderr.on("data", (d) => (stderr += d));
		if (stdin !== undefined && child.stdin) {
			child.stdin.write(stdin);
			child.stdin.end();
		}
		child.on("error", reject);
		child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 1 }));
	});
}

function generateStatefulSetYaml(config: K8sConfig, user: string): string {
	const name = `plder-dev-${user}`;
	const ns = config.namespace;
	const image = config.image || DEFAULTS.image!;
	const cpu = config.resources?.cpu || DEFAULTS.resources!.cpu!;
	const memory = config.resources?.memory || DEFAULTS.resources!.memory!;
	const storageClass = config.storageClass || DEFAULTS.storageClass!;
	const storageSize = config.storageSize || DEFAULTS.storageSize!;

	return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  clusterIP: None
  selector:
    app: plder-dev
    user: ${user}
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
  namespace: ${ns}
spec:
  serviceName: ${name}
  replicas: 1
  selector:
    matchLabels:
      app: plder-dev
      user: ${user}
  template:
    metadata:
      labels:
        app: plder-dev
        user: ${user}
    spec:
      containers:
      - name: dev
        image: ${image}
        command: ["sleep", "infinity"]
        workingDir: /home/dev
        resources:
          limits:
            cpu: "${cpu}"
            memory: "${memory}"
        volumeMounts:
        - name: home
          mountPath: /home/dev
  volumeClaimTemplates:
  - metadata:
      name: home
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: ${storageClass}
      resources:
        requests:
          storage: ${storageSize}`;
}

// --- Config loading ---

async function loadK8sConfig(cwd: string): Promise<K8sConfig | null> {
	try {
		const raw = await readFile(join(cwd, ".pi", "k8s.json"), "utf-8");
		const parsed = JSON.parse(raw);
		return { ...DEFAULTS, ...parsed } as K8sConfig;
	} catch {
		return null;
	}
}

async function findPod(namespace: string, labels?: string): Promise<string | null> {
	const selector = labels || "app=plder-dev";
	const result = await new Promise<{ stdout: string; exitCode: number }>(
		(resolve, reject) => {
			const child = spawn("kubectl", [
				"get",
				"pods",
				"-n",
				namespace,
				"-l",
				selector,
				"-o",
				"jsonpath={.items[0].metadata.name}",
				"--field-selector=status.phase=Running",
			]);
			let stdout = "";
			child.stdout.on("data", (d) => (stdout += d));
			child.on("error", reject);
			child.on("close", (code) => resolve({ stdout, exitCode: code ?? 1 }));
		},
	);
	return result.exitCode === 0 && result.stdout.trim()
		? result.stdout.trim()
		: null;
}

async function checkPodReady(
	ns: string,
	pod: string,
	container: string,
): Promise<boolean> {
	try {
		const r = await kubectlExec(ns, pod, container, ["echo", "ready"]);
		return r.exitCode === 0;
	} catch {
		return false;
	}
}

// --- Extension entry ---

export default function (pi: ExtensionAPI) {
	pi.registerFlag("k8s", {
		description: "K8s remote: true (auto-detect) or namespace/pod",
		type: "string",
		default: "",
	});

	const localCwd = process.cwd();
	const localRead = createReadTool(localCwd);
	const localWrite = createWriteTool(localCwd);
	const localEdit = createEditTool(localCwd);
	const localBash = createBashTool(localCwd);

	let k8s: { ns: string; pod: string; container: string; remoteCwd: string } | null =
		null;

	const getK8s = () => k8s;

	// Override all four tools
	pi.registerTool({
		...localRead,
		async execute(id, params, signal, onUpdate) {
			const remote = getK8s();
			if (remote) {
				const tool = createReadTool(localCwd, {
					operations: createRemoteReadOps(
						remote.ns,
						remote.pod,
						remote.container,
						remote.remoteCwd,
						localCwd,
					),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localRead.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localWrite,
		async execute(id, params, signal, onUpdate) {
			const remote = getK8s();
			if (remote) {
				const tool = createWriteTool(localCwd, {
					operations: createRemoteWriteOps(
						remote.ns,
						remote.pod,
						remote.container,
						remote.remoteCwd,
						localCwd,
					),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localWrite.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localEdit,
		async execute(id, params, signal, onUpdate) {
			const remote = getK8s();
			if (remote) {
				const tool = createEditTool(localCwd, {
					operations: createRemoteEditOps(
						remote.ns,
						remote.pod,
						remote.container,
						remote.remoteCwd,
						localCwd,
					),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localEdit.execute(id, params, signal, onUpdate);
		},
	});

	pi.registerTool({
		...localBash,
		async execute(id, params, signal, onUpdate) {
			const remote = getK8s();
			if (remote) {
				const tool = createBashTool(localCwd, {
					operations: createRemoteBashOps(
						remote.ns,
						remote.pod,
						remote.container,
						remote.remoteCwd,
						localCwd,
					),
				});
				return tool.execute(id, params, signal, onUpdate);
			}
			return localBash.execute(id, params, signal, onUpdate);
		},
	});

	// Route ! commands through K8s when active
	pi.on("user_bash", () => {
		const remote = getK8s();
		if (!remote) return;
		return {
			operations: createRemoteBashOps(
				remote.ns,
				remote.pod,
				remote.container,
				remote.remoteCwd,
				localCwd,
			),
		};
	});

	// Rewrite system prompt CWD
	pi.on("before_agent_start", async (event) => {
		const remote = getK8s();
		if (!remote) return;
		const modified = event.systemPrompt.replace(
			`Current working directory: ${localCwd}`,
			`Current working directory: ${remote.remoteCwd} (via K8s: ${remote.ns}/${remote.pod})`,
		);
		return { systemPrompt: modified };
	});

	// Initialize on session start
	pi.on("session_start", async (_event, ctx) => {
		const flag = pi.getFlag("k8s") as string | undefined;
		if (flag === undefined) return;

		// Try explicit namespace/pod from flag
		if (flag && flag.includes("/")) {
			const [ns, pod] = flag.split("/");
			const config = await loadK8sConfig(ctx.cwd);
			const container = config?.container || "dev";
			const remoteCwd = config?.remoteCwd || "/home/dev";

			if (await checkPodReady(ns, pod, container)) {
				k8s = { ns, pod, container, remoteCwd };
			} else {
				ctx.ui.notify(`Pod ${ns}/${pod} not ready`, "error");
				return;
			}
		} else {
			// Auto-detect from .pi/k8s.json
			const config = await loadK8sConfig(ctx.cwd);
			if (!config) {
				ctx.ui.notify("No .pi/k8s.json found and no --k8s argument", "warning");
				return;
			}

			let pod = config.pod;
			if (!pod) {
				pod = await findPod(config.namespace);
				if (!pod) {
					ctx.ui.notify(
						`No running pod found in ${config.namespace}. Use /k8s create.`,
						"warning",
					);
					return;
				}
			}

			if (await checkPodReady(config.namespace, pod, config.container)) {
				k8s = {
					ns: config.namespace,
					pod,
					container: config.container,
					remoteCwd: config.remoteCwd,
				};
			} else {
				ctx.ui.notify(`Pod ${config.namespace}/${pod} not ready`, "error");
				return;
			}
		}

		ctx.ui.setStatus(
			"k8s",
			ctx.ui.theme.fg("accent", `K8s: ${k8s.ns}/${k8s.pod} @ ${k8s.remoteCwd}`),
		);
		ctx.ui.notify(`K8s remote: ${k8s.ns}/${k8s.pod}`, "info");
	});

	// /k8s command for status and management
	pi.registerCommand("k8s", {
		description: "K8s remote execution status and management",
		getArgumentCompletions: (prefix) => {
			const cmds = ["status", "local", "connect", "create", "suspend", "resume", "destroy"];
			return cmds
				.filter((c) => c.startsWith(prefix))
				.map((c) => ({ value: c, label: c }));
		},
		handler: async (args, ctx) => {
			const subcmd = args.trim().toLowerCase();

			if (!subcmd || subcmd === "status") {
				if (k8s) {
					ctx.ui.notify(
						`Connected: ${k8s.ns}/${k8s.pod} (${k8s.container}) @ ${k8s.remoteCwd}`,
						"info",
					);
				} else {
					ctx.ui.notify("Not connected to K8s", "info");
				}
				return;
			}

			if (subcmd === "local") {
				k8s = null;
				ctx.ui.setStatus("k8s", undefined);
				ctx.ui.notify("Switched to local execution", "info");
				return;
			}

			if (subcmd === "connect") {
				const config = await loadK8sConfig(ctx.cwd);
				if (!config) {
					ctx.ui.notify("No .pi/k8s.json found", "error");
					return;
				}

				const pod = config.pod || (await findPod(config.namespace));
				if (!pod) {
					ctx.ui.notify(`No running pod in ${config.namespace}`, "error");
					return;
				}

				if (await checkPodReady(config.namespace, pod, config.container)) {
					k8s = {
						ns: config.namespace,
						pod,
						container: config.container,
						remoteCwd: config.remoteCwd,
					};
					ctx.ui.setStatus(
						"k8s",
						ctx.ui.theme.fg("accent", `K8s: ${k8s.ns}/${k8s.pod} @ ${k8s.remoteCwd}`),
					);
					ctx.ui.notify(`Connected: ${k8s.ns}/${k8s.pod}`, "info");
				} else {
					ctx.ui.notify(`Pod ${config.namespace}/${pod} not ready`, "error");
				}
				return;
			}

			if (subcmd === "create") {
				const config = await loadK8sConfig(ctx.cwd);
				if (!config) {
					ctx.ui.notify("No .pi/k8s.json found", "error");
					return;
				}

				const user = process.env.USER || process.env.USERNAME || "dev";
				const yaml = generateStatefulSetYaml(config, user);

				ctx.ui.notify(`Creating StatefulSet plder-dev-${user} in ${config.namespace}...`, "info");
				const r = await kubectlRun(["apply", "-f", "-"], yaml);
				if (r.exitCode !== 0) {
					ctx.ui.notify(`Failed: ${r.stderr}`, "error");
					return;
				}

				ctx.ui.notify("Waiting for pod to be ready...", "info");
				const waitResult = await kubectlRun([
					"wait", "--for=condition=ready", "pod",
					"-l", `app=plder-dev,user=${user}`,
					"-n", config.namespace,
					"--timeout=120s",
				]);

				if (waitResult.exitCode !== 0) {
					ctx.ui.notify(`Pod not ready: ${waitResult.stderr}`, "error");
					return;
				}

				const podName = await findPod(config.namespace, `app=plder-dev,user=${user}`);
				if (podName && await checkPodReady(config.namespace, podName, config.container)) {
					k8s = {
						ns: config.namespace,
						pod: podName,
						container: config.container,
						remoteCwd: config.remoteCwd,
					};
					ctx.ui.setStatus(
						"k8s",
						ctx.ui.theme.fg("accent", `K8s: ${k8s.ns}/${k8s.pod} @ ${k8s.remoteCwd}`),
					);
					ctx.ui.notify(`Created and connected: ${k8s.ns}/${k8s.pod}`, "info");
				}
				return;
			}

			if (subcmd === "suspend") {
				const config = await loadK8sConfig(ctx.cwd);
				if (!config) {
					ctx.ui.notify("No .pi/k8s.json found", "error");
					return;
				}

				const user = process.env.USER || process.env.USERNAME || "dev";
				const name = `plder-dev-${user}`;

				const r = await kubectlRun([
					"scale", "statefulset", name,
					"-n", config.namespace, "--replicas=0",
				]);

				if (r.exitCode !== 0) {
					ctx.ui.notify(`Failed: ${r.stderr}`, "error");
					return;
				}

				k8s = null;
				ctx.ui.setStatus("k8s", undefined);
				ctx.ui.notify(`Suspended ${name} (data preserved)`, "info");
				return;
			}

			if (subcmd === "resume") {
				const config = await loadK8sConfig(ctx.cwd);
				if (!config) {
					ctx.ui.notify("No .pi/k8s.json found", "error");
					return;
				}

				const user = process.env.USER || process.env.USERNAME || "dev";
				const name = `plder-dev-${user}`;

				ctx.ui.notify(`Resuming ${name}...`, "info");
				const r = await kubectlRun([
					"scale", "statefulset", name,
					"-n", config.namespace, "--replicas=1",
				]);

				if (r.exitCode !== 0) {
					ctx.ui.notify(`Failed: ${r.stderr}`, "error");
					return;
				}

				const waitResult = await kubectlRun([
					"wait", "--for=condition=ready", "pod",
					"-l", `app=plder-dev,user=${user}`,
					"-n", config.namespace,
					"--timeout=120s",
				]);

				if (waitResult.exitCode !== 0) {
					ctx.ui.notify(`Pod not ready: ${waitResult.stderr}`, "error");
					return;
				}

				const podName = await findPod(config.namespace, `app=plder-dev,user=${user}`);
				if (podName && await checkPodReady(config.namespace, podName, config.container)) {
					k8s = {
						ns: config.namespace,
						pod: podName,
						container: config.container,
						remoteCwd: config.remoteCwd,
					};
					ctx.ui.setStatus(
						"k8s",
						ctx.ui.theme.fg("accent", `K8s: ${k8s.ns}/${k8s.pod} @ ${k8s.remoteCwd}`),
					);
					ctx.ui.notify(`Resumed and connected: ${k8s.ns}/${k8s.pod}`, "info");
				}
				return;
			}

			if (subcmd === "destroy") {
				const config = await loadK8sConfig(ctx.cwd);
				if (!config) {
					ctx.ui.notify("No .pi/k8s.json found", "error");
					return;
				}

				const user = process.env.USER || process.env.USERNAME || "dev";
				const name = `plder-dev-${user}`;

				const confirm = ctx.hasUI
					? await ctx.ui.confirm("Destroy dev pod", `Delete ${name} and its PVC? Data will be lost.`)
					: true;

				if (!confirm) {
					ctx.ui.notify("Cancelled", "info");
					return;
				}

				await kubectlRun(["delete", "statefulset", name, "-n", config.namespace, "--ignore-not-found"]);
				await kubectlRun(["delete", "service", name, "-n", config.namespace, "--ignore-not-found"]);
				await kubectlRun(["delete", "pvc", `home-${name}-0`, "-n", config.namespace, "--ignore-not-found"]);

				k8s = null;
				ctx.ui.setStatus("k8s", undefined);
				ctx.ui.notify(`Destroyed ${name} and PVC`, "info");
				return;
			}

			ctx.ui.notify(
				`Unknown subcommand: ${subcmd}. Available: status, local, connect, create, suspend, resume, destroy`,
				"warning",
			);
		},
	});
}
