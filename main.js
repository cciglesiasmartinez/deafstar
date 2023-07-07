/*
 * Application entry point.
 * 
 */

const express = require('express');
const ejs = require('ejs');
const app = express();

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
    constructor(handler, name, token) {
        this.handler = handler;
        this.name = name;
        this.token = token;
    }
    // Returning client info
    getInfo() {
        return `Name: ${this.name}, Token: ${this.token}`;
    }
}

// Init main class and test users (this is dirty, just temp)
const mainClass = new Main();
const testUser1 = new User("client1", "Client #1", 12345);
const testUser2 = new User("client2", "Client #2", 67890);
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
        res.status(404).send('Handler does not exist.');
    }
});

// Init the http server
app.listen(8008, () => {
    const port = 8008;
    console.log('[HTTPd] Running on port ' + port);
});