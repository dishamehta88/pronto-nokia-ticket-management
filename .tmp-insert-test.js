const mysql = require('mysql2');
const db = mysql.createConnection({ host: 'localhost', user: 'root', password: '', database: 'pronto_db' });
db.connect(err => {
  if (err) { console.error(err); process.exit(1); }
  const sql = `INSERT INTO tickets (intimate_date, country, pronto_no, part_code, unit_name, part_group, part_family, unit_version, serial_number, fault_description, owner_type, owner_name, created_by, priority, rc_analysis_steps, feedback_to_rd, rd_instructions_feedback_to_rc, component_replaced, final_summary, pronto_rca_analysis_status, normal_repair_status, rca_end_date, closed_date, additional_remarks, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  const values = ['2026-07-06','India','PR-TEST-002','P001','Unit','PG','PF','V1','S1','Test','RC Owner','Test Owner','tester','No Priority','Tracking',null,null,null,null,null,'Visual Check',null,null,null,'Open'];
  db.query(sql, values, (err, result) => { console.log('err', err); console.log('result', result); db.end(); });
});
