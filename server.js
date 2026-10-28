// ---------------------------------------------------------
// DATABASE CONNECTION - Fixed for Railway & Render
// ---------------------------------------------------------
const dbConfig = process.env.DATABASE_URL || process.env.MYSQL_URL
  ? process.env.DATABASE_URL || process.env.MYSQL_URL
  : {
    host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'mysql.railway.internal',
    user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || 'jmHwUvCkvufdwaLnEjajHtxRwo1RVjUsU',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'railway',
    port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306
  };

console.log("Trying DB connection with:", typeof dbConfig === 'string' ? 'DATABASE_URL' : dbConfig);

const db = mysql.createConnection(dbConfig);

// ===========================================================

app.listen(3000, () => {
    console.log("Server Running On Port 3000");
});
