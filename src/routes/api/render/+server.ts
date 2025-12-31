import { spawn } from 'child_process';
import { readFile, unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

export async function POST({ request }) {
  const body = await request.json();
  const code = body.code || '';
  const scale = body.scale || 2;
  const format = body.format || 'png';

  const id = Date.now() + '-' + Math.random().toString(36).slice(2);
  const mmdPath = path.join(os.tmpdir(), `diagram-${id}.mmd`);
  const outPath = path.join(os.tmpdir(), `diagram-${id}.${format}`);

  try {
    await writeFile(mmdPath, code, 'utf8');

    // Try to run the local binary, but fall back to `npx` if it's not available.
    const localBin =
      path.join(process.cwd(), 'node_modules', '.bin', 'mmdc') +
      (process.platform === 'win32' ? '.cmd' : '');
    let useNpx = false;
    try {
      // simple existence check
      await readFile(localBin)
        .then(() => {})
        .catch(() => {
          useNpx = true;
        });
    } catch {
      useNpx = true;
    }

    const args = ['-i', mmdPath, '-o', outPath, '-s', String(scale)];

    await new Promise((resolve, reject) => {
      const cmd = useNpx ? 'npx' : localBin;
      const cmdArgs = useNpx ? ['@mermaid-js/mermaid-cli', ...args] : args;
      const proc = spawn(cmd, cmdArgs, { shell: true });
      const out: string[] = [];
      const errOut: string[] = [];
      proc.stdout?.on('data', (d) => out.push(String(d)));
      proc.stderr?.on('data', (d) => errOut.push(String(d)));
      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0) resolve(undefined);
        else
          reject(
            new Error(
              `mmdc failed (code=${code})\nstdout:\n${out.join('')}\nstderr:\n${errOut.join('')}`
            )
          );
      });
    });

    const data = await readFile(outPath);
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': format === 'png' ? 'image/png' : 'application/octet-stream',
        'Content-Disposition': `attachment; filename="diagram.${format}"`
      }
    });
  } catch (err) {
    console.error('render error', err);
    return new Response('Render failed', { status: 500 });
  } finally {
    // best-effort cleanup
    try {
      await unlink(mmdPath).catch(() => {});
      await unlink(outPath).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}
