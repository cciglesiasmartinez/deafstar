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
const crawler = require('./crawler.js');
const database = require('./db.js');
const chat = require('./chat.js');

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
    listUsers(callback) {
        callback(this.users);
    }
    getPassword(handler) {
        console.log("Getting pass!");
        let password;
        for (let i=0; i<this.users.length; i++) {
            if (this.users[i].handler == handler) {
                password = this.users[i].token;
                break;
            }
        }
        return password;
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
        return `Name: ${this.name}, Token: ${this.token},
        Email: ${this.email}`;
    }
}

// Init main class and test users (this is dirty, just temp)
const mainClass = new Main();


/*
 * Login system 
 *
 */

const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

app.use(express.urlencoded({ extended: true }));

// Configuring session (check this later)
app.use(session({
    secret: 'edit-this-secret',
    resave: false,
    saveUninitialized: false
}));

// Serialize user
passport.serializeUser((user, done) => {
    done(null, user.handler);
});
  
// Deserialize user
passport.deserializeUser((handler, done) => {
    const user = mainClass.getUser(handler);
    done(null, user);
});
  
// Configuración de Passport y estrategia local
passport.use(new LocalStrategy(
    (username, password, done) => {
        if (password == mainClass.getPassword(username)) {
            console.log("[HTTPS] Auth succeeded.");
            return done(null, mainClass.getUser(username));
        } else {
            return done(null, false, { message: 'Invalid login' });
        }
    }
));

// Initializing passport and establishing sessions
app.use(passport.initialize());
app.use(passport.session());


// Login route
app.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/login'
}));

// Crawl route
app.post('/crawl', isAuthenticated, async (req, res) => {
    //Logic for crawling site
    try {
        /*
        const url = [ req.body.url ];
        console.log('[HTTPd] Crawling ' + url + ' ...\n');
        const crawlerInstance = new crawler.Crawler(url,100,200);
        const pages = await crawlerInstance.start();
        console.log('[HTTPd] Crawling is done.\n', pages);
        */
        const crawlerInstance = new crawler.Crawler(req.body.url);
        const result = await crawlerInstance.start();
        console.log(result);
    } catch (err) {
        console.error(err);
    }
    res.redirect('/profile');
});
  
// Logout route
app.get('/logout', (req, res) => {
    req.logout(() => {console.log("Logged out");});
    res.redirect('/');
});

function isAlreadyAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        res.redirect('/profile');
    } else {
        return next();
    }
}

app.get('/login', isAlreadyAuthenticated, (req, res) => {
    res.render('login');
});

// Placeholder for login page
app.get('/', (req,res) => {
    const content = "Coming soon."
    res.render('index', { content });
});

// Profile checker (this route is a bit redundant, should be redone)
app.get('/profile', (req, res) => {
    if (req.isAuthenticated()) {
        const username = req.user.handler;
        res.redirect(`/${username}`);
    } else {
        res.redirect('/login');
    }
});

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // Is authenticated
    }
    res.status(400).render('404'); // Is not auth
}

// Getting users page
app.get('/:username', isAuthenticated, (req, res) => {
    const { username } = req.params;
    const { handler } = req.user;
    // Checking if exists
    if ((mainClass.getUser(username)) && (handler == username)) {
        const user = mainClass.getUser(username);
        console.log("[HTTPd]: Obtained user \n", user);
        res.render('user', { user });
    } else {
        // Sending error
        //console.log(mainClass.users, "Requested user " + req.params.username);
        res.status(404).render('404');
    }
});

// Handling 404 routes
app.use((req, res, next) => {
    res.status(404).render('404');
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
    console.log("[WEBSOCKET] Client connected"); 
    //const greet = {origin: "server", data:"Connected!"};
    //ws.send(JSON.stringify(greet));
    ws.on('message', async (msg) => {
        try {
            msg = JSON.parse(msg);
            console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
            // Calling OpenAI API
            
            const response = await chat.generateText(msg.data);
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


// Instancing class and retrieving users
const db = new database.DB('localhost', 'root', 'password', 'deafstar');

db.getUsers((users) => {
    users.forEach((user) => {
        mainClass.addUser(user);
    });
    console.log("[MySQL] Users: ", mainClass.listUsers((users)=>{console.log(users)}));
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

const testUser1 = new User("01234","client1", "Client #1", "client1@mail.net");
const testUser2 = new User("56789","client2", "Client #2", "client2@mail.net");
mainClass.addUser(testUser1);
mainClass.addUser(testUser2);
*/