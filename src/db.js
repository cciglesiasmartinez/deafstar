/*
 * MySQL Database Management
 *
 * This file contains the DB class, which handles MySQL database connectivity 
 * and operations. The class manages user-related queries such as retrieval, 
 * structure creation, as well as vector storing operations for chatbots.
 *
 */

// Dependencies
const mysql = require('mysql2');
const { Logger } = require('./log.js');
const { User } = require('./struct.js');

// Initialize logger
const logger = new Logger();

// Class with all methods needed for management
class DB {
    // Constructor call 
    constructor(host, user, password, database) {
        if (DB.instance) {
            return DB.instance; // Singleton!
        }
        this.host = host;
        this.user = user;
        this.password = password;
        this.database = database;
        DB.instance = this;
    }
    // Connect function
    connect() {
        this.connection = mysql.createConnection({
            host: this.host,
            user: this.user,
            password: this.password,
            database: this.database
        });
        return new Promise ((resolve,reject) => {
            // Sending message
            this.connection.connect((error) => {
                if (error) { 
                    throw logger.error(error);
                    reject(error);
                } else { 
                    logger.info('[MySQL] Connected to database');
                    resolve();
                }
            });
        });
    }
    // Disconnect function
    disconnect() {
        return new Promise ((resolve,reject) => {
            this.connection.end((error) => {
                if (error) { 
                    throw logger.error(error);
                    reject(error);
                } else {
                    logger.info('[MySQL] Disconnected from database');
                    resolve(); 
                }
            });
        });
    }
    // Checking users fucntion
    getUsers(callback) {
        this.connect();
        const query = `
            SELECT 
            id, handler, name, email, token, url, chat_id, 
            system_msg, temp, vectors_per_answer, greet_msg, url_suggestions_text, ai_model
            FROM users
            `;
        this.connection.query(query, (error, results) => {
            if (error) throw logger.error(error);
            const users = results.map((row) => {
                const user = new User(
                    row.id, row.token, row.handler, row.name, row.email, 
                    row.url, row.chat_id, row.system_msg, row.temp, 
                    row.vectors_per_answer, row.greet_msg, row.url_suggestions_text, row.ai_model,
                    );
                return user;
            });
            callback(users);
        });
        this.disconnect();
    }
    // Create a new user
    createUser(user, callback) {
        this.connect();
        const query = `
            INSERT INTO users 
            (token, handler, name, email, system_msg, temp) 
            VALUES (?, ?, ?, ?, ?, ?)
            `;
        const values = [user.token, user.handler, user.name, user.email, "Default bot message", 0];
        this.connection.query(query, values, (error, results) => {
            if (error) throw logger.error(err);
            const createdUser = new User(user.token, user.handler, user.name, user.email);
            callback(createdUser);
        });
        this.disconnect();
    }
    // Create the database and tables
    createStructure() {
        this.connect();
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                token VARCHAR(255),
                handler VARCHAR(255),
                url VARCHAR(255),
                chat_id VARCHAR(255),
                system_msg TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                temp INT,
                vectors_per_answer INT,
                greet_msg TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                url_suggestions_text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
            )
        `;
        this.connection.query(createUsersTable, (error, results) => {
            if (error) throw logger.error(error);
            else { logger.info("[MySQL] Users table successfully created.") }
        });
        const createChatbotsTable = `
            CREATE TABLE IF NOT EXISTS vectors (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                vector_id VARCHAR(255),
                embeddings JSON,
                title VARCHAR(255),
                text TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                url VARCHAR(255),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        this.connection.query(createChatbotsTable, (error, results) => {
            if (error) throw logger.error(error);
            else { logger.info("[MySQL] Vectors table successfully created.") }
        });
        const createChatlogsTable = `
            CREATE TABLE IF NOT EXISTS chat_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                date INT,
                question TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                answer TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `;
        this.connection.query(createChatlogsTable, (error, results) => {
            if (error) throw logger.error(error);
            else { logger.info("[MySQL] Chat logs table successfully created.") }
        });
        this.disconnect();
    }
    // Add a vector attached to an user ID
    async addVector(vector, userId) {
        console.log("Calling function addVector");
        try {
            this.connect();
            const insertVector = `
                INSERT INTO vectors (
                    user_id,
                    vector_id,
                    embeddings,
                    title,
                    text,
                    url
                )
                VALUES (?,?,?,?,?,?)
            `;
            return new Promise((resolve, reject) => {
                this.connection.query(
                    insertVector,
                    [userId, vector.id, JSON.stringify(vector.embedding),vector.metadata.title, 
                        vector.metadata.text, vector.metadata.url ],
                    (error,result) => {
                        if (error) {
                            reject(error); 
                            logger.error("[MySQL] Error inserting vector: " + error); 
                        }
                        else {
                            resolve();
                            logger.info("[MySQL] Vector inserted in database."); 
                        }
                    }
    
                );
                this.disconnect();
            });

        } catch (error) {
            throw logger.error("[MySQL] Error in addVector: " + error )
        }
    }
    // Get ID for a given user (handler)
    async getUserId(handler) {
        try {
            this.connect();
            const query = 'SELECT id FROM users WHERE handler = ?';
            return new Promise((resolve,reject) => {
                this.connection.query(query, handler, (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        //console.log("[MySQL] GOT THE ID FOR USER " + JSON.stringify(results));
                        resolve(results[0].id);
                    }
                    this.disconnect();
                });
            });
        } catch(error) {
            throw logger.error(error);
        }
    }
    // All purpose query handler
    async makeQuery(query, values) {
        try {
            this.connect();
            return new Promise((resolve,reject) => {
                this.connection.query(query, values, (error, results) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(results);
                        logger.info("[MySQL] Query '" + query + "' with values '" + values + "' successfully performed!");
                    }
                });
                this.disconnect();
            });
        } catch (err) {
            logger.error(error);
            throw (err);
        }
    }
}


module.exports = { DB };