/*
 * MySQL calls
 *
 */

const mysql = require('mysql');
const { Logger } = require('./log.js');

// Initialize logger
const logger = new Logger();

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
        const query = 'SELECT id, handler, name, email, token, url, chat_id  FROM users';
        this.connection.query(query, (error, results) => {
            if (error) throw logger.error(error);
            const users = results.map((row) => {
                const user = new User(row.id, row.token, row.handler, row.name, row.email, row.url, row.chat_id);
                return user;
            });
            callback(users);
        });
        this.disconnect();
    }
    // Create a new user
    createUser(user, callback) {
        this.connect();
        const query = 'INSERT INTO users (token, handler, name, email) VALUES (?, ?, ?, ?)';
        const values = [user.token, user.handler, user.name, user.email];
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
                chat_id VARCHAR(255)
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
                    this.disconnect();
                });
            });
        } catch (err) {
            throw (err);
        }
    }
    // 
}

// User class (repeating code, must be deleted later)
class User {
    constructor(id, token, handler, name, email, url, chatId) {
        this.id = id;
        this.token = token;
        this.handler = handler;
        this.name = name;
        this.email = email;
        this.url = url;
        this.chatId = chatId;
        this.chatbot = undefined;
    }
    // Returning client info
    getInfo() {
        return `Name: ${this.name}, Token: ${this.token},
        Email: ${this.email}, URL: ${this.url}`;
    }
    addChatBot(chatbot) {
        this.chatbot = chatbot;
    }
}

module.exports = { DB, User };