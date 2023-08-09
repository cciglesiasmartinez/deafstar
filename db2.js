const mysql = require('mysql2/promise');

class AsyncMySQLDB {
    constructor(config) {
        this.config = config;
        this.pool = null;
    }

    async createPool() {
        this.pool = mysql.createPool(this.config);
        console.log("Pool created");
    }

    async closePool() {
        if (this.pool !== null) {
            this.pool.end();
            this.pool = null;
        }
    }

    async getUsers() {
        const conn = await this.pool.getConnection();
        console.log("Passed");
        try {
            const [rows] = await conn.query('SELECT * FROM users');
            return rows;
        } catch (error) {
            throw error;
        } finally {
            conn.release();
        }
    }
}

module.exports = { AsyncMySQLDB }

// Code to invoke and use this new way of doing things
// New database using mysql2/promises
/*
const database = require('./db2.js');

async function initDB() {
    const dbConfig = {
        host: '127.0.0.1',
        user: 'root',
        password: 'password',
        database: 'deafstar',
        port: 3306,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    };

    const db = new database.AsyncMySQLDB(dbConfig);
    await db.createPool();

    try {
        const users = await db.getUsers();
        users.forEach(user => {
            console.log(user);
    }); 
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await db.closePool();
    }
}
initDB();
*/