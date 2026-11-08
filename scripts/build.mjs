import { cp, rm } from 'node:fs/promises';
await rm('build', { recursive: true, force: true });
await cp('dist', 'build', { recursive: true });
console.log('Built complete static website in build/');
