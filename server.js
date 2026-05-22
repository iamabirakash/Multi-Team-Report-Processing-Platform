const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'OK', message: 'Team Report API Running' });
});

// ===== EMPLOYEE APIs =====
app.post('/employees', async (req, res) => {
  const { name, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO employees(name, email) VALUES($1, $2) RETURNING *',
      [name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/employees', async (req, res) => {
  const result = await pool.query('SELECT * FROM employees');
  res.json(result.rows);
});

// ===== TEAM APIs =====
app.post('/teams', async (req, res) => {
  const { team_name } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO teams(team_name) VALUES($1) RETURNING *',
      [team_name]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/teams', async (req, res) => {
  const result = await pool.query('SELECT * FROM teams');
  res.json(result.rows);
});

// ===== JUNCTION TABLE APIs (MANDATORY - Many-to-Many) =====
// Add employee to team
app.post('/teams/:teamId/employees/:employeeId', async (req, res) => {
  const { teamId, employeeId } = req.params;
  try {
    await pool.query(
      'INSERT INTO employee_teams(employee_id, team_id) VALUES($1, $2)',
      [employeeId, teamId]
    );
    res.json({ message: 'Employee added to team successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all employees in a team (JOIN query - REQUIRED)
app.get('/teams/:teamId/employees', async (req, res) => {
  const { teamId } = req.params;
  const result = await pool.query(`
    SELECT e.id, e.name, e.email 
    FROM employees e
    JOIN employee_teams et ON e.id = et.employee_id
    WHERE et.team_id = $1
  `, [teamId]);
  res.json(result.rows);
});

// Get all teams for an employee (JOIN query - REQUIRED)
app.get('/employees/:employeeId/teams', async (req, res) => {
  const { employeeId } = req.params;
  const result = await pool.query(`
    SELECT t.id, t.team_name
    FROM teams t
    JOIN employee_teams et ON t.id = et.team_id
    WHERE et.employee_id = $1
  `, [employeeId]);
  res.json(result.rows);
});

// ===== S3 UPLOAD API =====
const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');

const s3 = new AWS.S3({ region: 'eu-north-1' });
const upload = multer({ dest: '/tmp/' });

app.post('/upload-report', upload.single('file'), async (req, res) => {
  const { teamId, employeeId } = req.body;
  const file = req.file;
  
  try {
    const fileContent = fs.readFileSync(file.path);
    const key = `team-${teamId}/pending/${Date.now()}-${file.originalname}`;
    
    await s3.upload({
      Bucket: 'team-reports-storage-YOUR_NAME', // Replace with your bucket name
      Key: key,
      Body: fileContent
    }).promise();
    
    await pool.query(
      `INSERT INTO reports(team_id, uploaded_by, file_name, s3_key, status)
       VALUES($1, $2, $3, $4, 'pending')`,
      [teamId, employeeId, file.originalname, key]
    );
    
    res.json({ message: 'Report uploaded successfully', key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== REPORT APIs =====
app.get('/reports', async (req, res) => {
  const result = await pool.query('SELECT * FROM reports ORDER BY uploaded_at DESC');
  res.json(result.rows);
});

app.get('/teams/:teamId/reports', async (req, res) => {
  const { teamId } = req.params;
  const result = await pool.query(
    'SELECT * FROM reports WHERE team_id = $1 ORDER BY uploaded_at DESC',
    [teamId]
  );
  res.json(result.rows);
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
