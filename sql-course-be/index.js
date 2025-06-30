const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const { exec } = require('child_process');
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const courses = []; // In-memory course DB metadata

// POST /api/courses — upload CSV and spin up DB
app.post('/api/courses', upload.single('file'), async (req, res) => {
  const { name, description } = req.body;
  const filePath = req.file.path;
  const id = uuidv4();
  const dbName = `course_${id.replace(/-/g, '')}`;
  const containerName = `pg_${id}`;
  const csvPathInContainer = `/tmp/data.csv`;

  // Safe numeric port between 5000–5999
  const numericSuffix = parseInt(id.replace(/\D/g, '').slice(-4), 10) || Math.floor(Math.random() * 10000);
  const dynamicPort = 5000 + (numericSuffix % 1000);

  const dockerCmd = `docker run -d --rm --name ${containerName} \
    -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=${dbName} \
    -v $(pwd)/${filePath}:${csvPathInContainer} \
    -p ${dynamicPort}:5432 postgres`;

  exec(dockerCmd, async (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: 'Failed to create DB container', stderr });

setTimeout(() => {
  const tryConnect = async (retries = 15) => {
    const client = new Client({
      host: 'localhost',
      port: dynamicPort,
      user: 'postgres',
      password: 'secret',
      database: dbName,
    });

    try {
      await client.connect();
      console.log(`Connected to DB on port ${dynamicPort}`);

      const csvRaw = fs.readFileSync(path.resolve(filePath));
      const records = parse(csvRaw, { columns: true, skip_empty_lines: true });

      if (!records.length) {
        throw new Error("CSV has no rows");
      }

      // Infer data types
      const sampleSize = Math.min(records.length, 20);
      const sampleRows = records.slice(0, sampleSize);

const inferType = (values) => {
  if (values.every(v => /^-?\d+$/.test(v))) {
    if (values.every(v => {
      const num = BigInt(v);
      return num >= -2147483648n && num <= 2147483647n;
    })) {
      return 'INTEGER';
    } else {
      return 'BIGINT';
    }
  }

  if (values.every(v => /^-?\d+(\.\d+)?$/.test(v))) return 'REAL';

  return 'TEXT';
};


      const columns = Object.keys(records[0]);
      const columnTypes = {};

      for (const col of columns) {
        const colValues = sampleRows.map(row => (row[col] ?? "").trim());
        columnTypes[col] = inferType(colValues);
      }

      const columnDefs = columns.map(
        (col) => `"${col.toLowerCase()}" ${columnTypes[col]}`
      ).join(", ");

      await client.query(`DROP TABLE IF EXISTS data`);
      await client.query(`CREATE TABLE data (${columnDefs})`);

      for (const row of records) {
        const keys = Object.keys(row);
        const values = keys.map((k) => {
          const val = row[k]?.trim() ?? null;
          if (val === "") return null;

          switch (columnTypes[k]) {
            case 'INTEGER': return parseInt(val, 10);
            case 'REAL': return parseFloat(val);
            default: return val;
          }
        });

        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        await client.query(
          `INSERT INTO data (${keys.map(k => `"${k.toLowerCase()}"`).join(', ')}) VALUES (${placeholders})`,
          values
        );
      }

      await client.end();
      courses.push({ id, name, description, port: dynamicPort });
      res.json({ id, name, description });

    } catch (err) {
      if (retries > 0) {
        console.log(`Retrying DB connection... (${15 - retries + 1})`);
        setTimeout(() => tryConnect(retries - 1), 1000);
      } else {
        res.status(500).json({ error: 'Failed to import CSV', detail: err.message });
      }
    }
  };

  tryConnect();
}, 2000);

  });
});

// GET /api/courses
app.get('/api/courses', (req, res) => {
  res.json(courses);
});

// POST /api/execute/:id
app.post('/api/execute/:id', async (req, res) => {
  const { query } = req.body;
  const course = courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const client = new Client({
    host: 'localhost',
    port: course.port,
    user: 'postgres',
    password: 'secret',
    database: `course_${course.id.replace(/-/g, '')}`,
  });

  try {
    await client.connect();
    const result = await client.query(query);
    await client.end();
    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend API running at http://localhost:${port}`);
});
