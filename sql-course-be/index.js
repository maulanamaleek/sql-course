const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const { parse } = require("csv-parse/sync");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Database = require("better-sqlite3");
const mkdirp = require("mkdirp");

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: "uploads/" });

app.use(cors());
app.use(express.json());

const courses = [];
const dbDir = path.join(__dirname, "databases");
mkdirp.sync(dbDir);

app.post("/api/courses", upload.single("file"), (req, res) => {
  try {
    const { name, description } = req.body;
    const filePath = req.file.path;
    const id = uuidv4();
    const dbPath = path.join(dbDir, `course_${id}.db`);

    const csvRaw = fs.readFileSync(filePath);
    const records = parse(csvRaw, { columns: true, skip_empty_lines: true });

    if (!records.length) return res.status(400).json({ error: "CSV is empty" });

    const sampleRows = records.slice(0, Math.min(20, records.length));
    const inferType = (values) => {
      if (values.every((v) => /^-?\d+$/.test(v))) return "INTEGER";
      if (values.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "REAL";
      return "TEXT";
    };

    const columns = Object.keys(records[0]);
    const columnTypes = {};
    for (const col of columns) {
      const values = sampleRows.map((row) => (row[col] ?? "").trim());
      columnTypes[col] = inferType(values);
    }

    const columnDefs = columns
      .map((col) => `"${col}" ${columnTypes[col]}`)
      .join(", ");

    const db = new Database(dbPath);
    db.exec(`DROP TABLE IF EXISTS data`);
    db.exec(`CREATE TABLE data (${columnDefs})`);

    const insert = db.prepare(`
      INSERT INTO data (${columns.map((c) => `"${c}"`).join(", ")})
      VALUES (${columns.map(() => "?").join(", ")})
    `);

    const insertMany = db.transaction((rows) => {
      for (const row of rows) {
        const values = columns.map((col) => {
          const val = (row[col] ?? "").trim();
          if (val === "") return null;
          if (columnTypes[col] === "INTEGER") return parseInt(val, 10);
          if (columnTypes[col] === "REAL") return parseFloat(val);
          return val;
        });
        insert.run(values);
      }
    });

    insertMany(records);

    db.close();
    courses.push({ id, name, description, dbPath });
    res.json({ id, name, description });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Failed to import CSV", detail: err.message });
  }
});

app.get("/api/courses", (req, res) => {
  res.json(courses);
});

app.post("/api/execute/:id", (req, res) => {
  const { query } = req.body;
  const course = courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: "Course not found" });

  try {
    const db = new Database(course.dbPath, { readonly: true });
    const rows = db.prepare(query).all();
    db.close();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
