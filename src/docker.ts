import { spawn } from "node:child_process";
import { writeFileSync, copyFileSync, mkdirSync, rmSync } from "fs";
import { basename, join } from "path";

export interface BuildContext {
  scriptPath: string;
  dockerfile: string;
  scriptFilename: string;
}

export async function dockerBuildWithContext(tag: string, context: BuildContext): Promise<void> {
  // Create temporary build directory
  const buildDir = `/tmp/docker-build-${Date.now()}`;
  mkdirSync(buildDir, { recursive: true });
  
  try {
    // Copy script to build directory
    const targetScriptPath = join(buildDir, context.scriptFilename);
    copyFileSync(context.scriptPath, targetScriptPath);
    
    // Write Dockerfile to build directory
    const dockerfilePath = join(buildDir, 'Dockerfile');
    writeFileSync(dockerfilePath, context.dockerfile);
    
    // Build from the temporary directory
    await execLogged("docker", ["build", "-t", tag, buildDir], { prefix: "build" });
  } finally {
    // Clean up temporary directory
    rmSync(buildDir, { recursive: true, force: true });
  }
}

export async function dockerBuild(tag: string): Promise<void> {
  await execLogged("docker", ["build", "-t", tag, "."], { prefix: "build" });
}

export async function dockerRun(tag: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number; }> {
  return execCapture("docker", ["run", "--rm", tag, ...args]);
}

function execLogged(cmd: string, argv: string[], opts?: { prefix?: string }): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ["inherit", "pipe", "pipe"] });
    p.stdout.on("data", (d: any) => process.stdout.write(opts?.prefix ? `[${opts.prefix}] ${d}` : d));
    p.stderr.on("data", (d: any) => process.stderr.write(opts?.prefix ? `[${opts.prefix}] ${d}` : d));
    p.on("close", (code: number | null) => code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`)));
  });
}

function execCapture(cmd: string, argv: string[]): Promise<{ stdout: string; stderr: string; exitCode: number; }> {
  return new Promise((resolve) => {
    const p = spawn(cmd, argv, { stdio: ["inherit", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d: any) => out += String(d));
    p.stderr.on("data", (d: any) => err += String(d));
    p.on("close", (code: number | null) => resolve({ stdout: out.trim(), stderr: err.trim(), exitCode: code ?? -1 }));
  });
}
