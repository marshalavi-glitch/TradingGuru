const path = require('path');
const ts = require(path.resolve(__dirname, '../frontend/node_modules/typescript'));

const configPath = path.resolve(__dirname, '../frontend/tsconfig.app.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedCommandLine = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.resolve(__dirname, '../frontend')
);

const program = ts.createProgram(parsedCommandLine.fileNames, parsedCommandLine.options);
const diagnostics = ts.getPreEmitDiagnostics(program);

console.log('Total diagnostics:', diagnostics.length);
for (const diag of diagnostics) {
  if (diag.file && diag.file.fileName.includes('ChartContainer.tsx')) {
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
    console.log(`Line ${diag.file.getLineAndCharacterOfPosition(diag.start).line + 1}: ${message}`);
  }
}
