/*
 * Application entry point.
 * 
 */

const express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const https = require('https');
const ws = require('ws');
const app = express();
const mysql = require('mysql');

// Retrieve SSL key + cert
const sslFiles = {
    cert: fs.readFileSync(__dirname + '/ssl/snakeoil.crt'),
    key: fs.readFileSync(__dirname + '/ssl/snakeoil.key'),
}
const secureHttpd = https.createServer(sslFiles, app);

// Setting template engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Main class (this name *has to* be changed)
class Main {
    constructor() {
        this.users = [];
    }
    // @param is object instantiated from class Users
    addUser(user) {
        this.users.push(user);
    }
    // Search for an object given handler attr
    getUser(handler) {
        for (let i=0; i<this.users.length; i++) {
            if ( this.users[i].handler == handler ) {
                return this.users[i];
            }
        }
    }
}

// User class
class User {
    constructor(token, handler, name, email) {
        this.token = token;
        this.handler = handler;
        this.name = name;
        this.email = email;
    }
    // Returning client info
    getInfo() {
        return `Name: ${this.name}, Token: ${this.token}`;
    }
}

// Init main class and test users (this is dirty, just temp)
const mainClass = new Main();
const testUser1 = new User("01234","client1", "Client #1", "client1@mail.net");
const testUser2 = new User("56789","client2", "Client #2", "client2@mail.net");
mainClass.addUser(testUser1);
mainClass.addUser(testUser2);

// Placeholder for login page
app.get('/', (req,res) => {
    const content = "Coming soon."
    res.render('index', { content });
});

// Getting users page
app.get('/:username', (req, res) => {
    const { username } = req.params;
    // Checking if exists
    if (mainClass.getUser(username)) {
        const user = mainClass.getUser(username);
        console.log("[HTTPd]: Obtained user \n", user);
        if ( user instanceof User ) {
            console.log("Right class!");
        }
        res.render('user', { user });
    } else {
        // Sending error
        console.log(mainClass.users, "Requested user " + req.params.username);
        res.status(404).send('Handler does not exist.');
    }
});

// Init the http server
secureHttpd.listen(8008, () => {
    const port = 8008;
    console.log('[HTTPd] Running on port ' + port);
});


/* 
 * Websocket Server
 * 
 */

// Init websocket server through https

const wsServer = new ws.Server({server: secureHttpd});

// WS functions

wsServer.on('connection',  (ws) => {
    console.log("Client connected");
    const greet = {origin: "server", data:"Connected!"};
    //ws.send(JSON.stringify(greet));
    ws.on('message', async (msg) => {
        try {
            msg = JSON.parse(msg);
            console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
            // Calling OpenAI API
            
            const response = await generateText(msg.data);
            const resMsg = {
                origin: "server",
                data: response,
            }
            console.log(resMsg);
            ws.send(JSON.stringify(resMsg));
            
        } catch (err) {
            console.error("[WEBSOCKET] Error in JSON msg: " + err)
        }
    });
});


/*
 * OpenAI API call
 *
 */

require('dotenv').config()
const { Configuration, OpenAIApi } = require('openai');

const openAiApiKey = process.env.OPENAI_API_KEY;
const conf = new Configuration({apiKey: openAiApiKey});
const openai = new OpenAIApi(conf);

console.log("API KEY IS: " + openAiApiKey);

async function generateText(prompt) {
    console.log("function is being called");
    const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: prompt,
        max_tokens: 300,
    });
    //console.log(response.data.choices[0]);
    const text = response.data.choices[0].text.replace(/\n/g,"");
    return text;
}


/*
 * MySQL calls
 *
 */

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
            if (err) throw err;
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
            const users = results.map((row) => {
                return new User(row.token, row.handler, row.name, row.email);
            });
            callback(users);
            console.log("[MySQL DEBUG]: " + users + " " + typeof(users));
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

// Instancing class and retrieving users
const db = new DB('localhost', 'root', 'password', 'deafstar');

db.getUsers((users) => {
    console.log(users);
});

// Instancing user and creating 
/*
const newUser = new User('01234', 'client1', 'Client #1', 'client1@mail.net');
const newUser2 = new User('56789', 'client2', 'Client #2', 'client2@mail.net');


db.createUser(newUser, (createdUser) => {
    console.log('User created:', createdUser);
});

db.createUser(newUser2, (createdUser) => {
    console.log('User created:', createdUser);
});
*/