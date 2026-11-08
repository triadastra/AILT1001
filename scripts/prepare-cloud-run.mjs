import { cp, mkdir, rm } from 'node:fs/promises';
const target = '.deploy/cloud-run';
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
for (const file of ['Dockerfile', 'nginx.conf']) {
  await cp(`deploy/cloud-run/${file}`, `${target}/${file}`);
}
await cp('build', `${target}/public`, { recursive: true });
console.log(`Prepared ${target}: static website + Nginx only. Nothing deployed yet.`);
