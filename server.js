// server.js
const express = require("express");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const port = 4000;

app.use(express.json({ limit: "2mb" }));

app.post("/", (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: "No code provided." });
  }

  const lines = code.split('\n');
  const importLines = [];
  const otherLines = [];
  let inMultiLineImport = false;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('import')) {
      importLines.push(line);
      // If it's a multi-line import starter like `import {`
      if (trimmedLine.includes('{') && !trimmedLine.includes('}')) {
        inMultiLineImport = true;
      }
    } else if (inMultiLineImport) {
      importLines.push(line);
      // If this is the line that closes the multi-line import
      if (trimmedLine.includes('}')) {
        inMultiLineImport = false;
      }
    } else {
      otherLines.push(line);
    }
  }

  const wrappedCode = `
    ${importLines.join('\n')}

    (async () => {
      ${otherLines.join('\n')}
    })().catch(err => {
      console.error(err);
      process.exit(1);
    });
  `;

  const tempFilePath = path.join(__dirname, "temp_code.ts");
  fs.writeFileSync(tempFilePath, wrappedCode);

  exec(`npx ts-node --swc ${tempFilePath}`, (error, stdout, stderr) => {
    fs.unlinkSync(tempFilePath);

    if (error) {
      console.error("Execution Error:", stderr || error.message);
      return res.status(200).json({ stdout: stderr || error.message });
    }

    console.log("Execution Success:", stdout);
    if (stderr) {
      console.warn("Execution Warning (ignored):", stderr);
    }
    res.status(200).json({ stdout: stdout });
  });
});

app.listen(port, () => {
  console.log(`🚀 Local code runner listening at http://localhost:${port}`);
});