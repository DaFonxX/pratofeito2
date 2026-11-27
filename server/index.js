const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error(`\n  O PratoFeito precisa do Node.js 22.13 ou mais novo (você tem ${process.versions.node}).`);
  console.error('  Baixe a versão LTS em https://nodejs.org e rode de novo.\n');
  process.exit(1);
}

const originalEmit = process.emitWarning;
process.emitWarning = function emitWarning(warning, ...args) {
  if (String(warning?.message ?? warning).includes('SQLite is an experimental feature')) return;
  return originalEmit.call(process, warning, ...args);
};

const { main } = await import('./main.js');
await main();
