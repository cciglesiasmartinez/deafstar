/*
 * MySQL calls
 *
 */

const mysql = require('mysql');

class DB {
    // Constructor call 
    constructor(host, user, password, database) {
        this.host = host;
        this.user = user;
        this.password = password;
        this.database = database;
    }
    // Connect function
    connect() {
        this.connection = mysql.createConnection({
            host: this.host,
            user: this.user,
            password: this.password,
            database: this.database
        });
        // Sending message
        this.connection.connect((err) => {
            //if (err) throw err;
            console.log('[MySQL] Connected to MySQL database');
        });
    }
    // Disconnect function
    disconnect() {
        this.connection.end((err) => {
            if (err) throw err;
            console.log('[MySQL] Disconnected from MySQL database');
        });
    }
    // Checking users fucntion
    getUsers(callback) {
        this.connect();
        const query = 'SELECT handler, name, email, token  FROM users';
        this.connection.query(query, (error, results) => {
            if (error) throw error;
            //console.log(results);
            const users = results.map((row) => {
                const user = new User(row.token, row.handler, row.name, row.email);
                return user;
            });
            callback(users);
        });
        this.disconnect();
    }
    createUser(user, callback) {
        this.connect();
        const query = 'INSERT INTO users (token, handler, name, email) VALUES (?, ?, ?, ?)';
        const values = [user.token, user.handler, user.name, user.email];
        this.connection.query(query, values, (error, results) => {
            if (error) throw error;
            const createdUser = new User(user.token, user.handler, user.name, user.email);
            callback(createdUser);
        });
        this.disconnect();
    }
}

// User class (repeating code, must be deleted later)
class User {
    constructor(token, handler, name, email) {
        this.token = token;
        this.handler = handler;
        this.name = name;
        this.email = email;
        this.url = undefined;
    }
    // Returning client info
    getInfo() {
        return `Name: ${this.name}, Token: ${this.token},
        Email: ${this.email}, URL: ${this.url}`;
    }
}

module.exports = { DB };