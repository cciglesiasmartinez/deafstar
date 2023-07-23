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
