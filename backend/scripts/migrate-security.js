require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const mysql=require('mysql2/promise');
(async()=>{
    let connection;
    try {
        connection=await mysql.createConnection({ssl:require('../src/security/transport').databaseTlsOptions(),host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectTimeout:5000});
        await connection.query(require('node:fs').readFileSync(require('node:path').join(__dirname,'../migrations/20261107_security.sql'),'utf8'));
        console.log('Security migration applied. Existing orders were not modified.');
    } catch(e) { console.error('Security migration failed:',e.code || 'DATABASE_ERROR');process.exitCode=1; }
    finally {if(connection) await connection.end();}
})();
