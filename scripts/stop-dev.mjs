/**
 * Stop ONLY this project's dev server — the process listening on PORT (3000).
 * Use this instead of a blanket `taskkill /IM node.exe`, which kills every Node
 * process on the machine (including unrelated apps).
 */
import { execFileSync } from "node:child_process";

const PORT = Number(process.env.PORT ?? 3000);

function pidsOnPort(port) {
  const pids = new Set();
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "tcp"], { encoding: "utf8" });
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/:(\d+)\s+\S+\s+LISTENING\s+(\d+)/);
        if (m && Number(m[1]) === port) pids.add(m[2]);
      }
    } else {
      const out = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], {
        encoding: "utf8",
      });
      for (const p of out.split(/\s+/).filter(Boolean)) pids.add(p);
    }
  } catch {
    /* nothing listening */
  }
  return [...pids];
}

const pids = pidsOnPort(PORT);
if (pids.length === 0) {
  console.log(`nothing listening on :${PORT}`);
  process.exit(0);
}
for (const pid of pids) {
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(Number(pid), "SIGTERM");
    }
    console.log(`stopped pid ${pid} on :${PORT}`);
  } catch (e) {
    console.error(`could not stop pid ${pid}: ${e.message}`);
  }
}
