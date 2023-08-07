/*
 * Application entry point.
 * 
 */

const express = require('express');
const ejs = require('ejs');
const fs = require('fs');
const http = require('http');
const ws = require('ws');
const app = express();
const crawler = require('./crawler.js');
const database = require('./db.js');
const chat = require('./chat.js');
const { Logger } = require('./log.js');
const { configuration } = require('./conf.js');

// Instancing database
const db = new database.DB('127.0.0.1', 'root', 'password', 'deafstar');

// Initializing logger
const logger = new Logger();

// Retrieve SSL key + cert
const sslFiles = {
    cert: fs.readFileSync(__dirname + '/ssl/snakeoil.crt'),
    key: fs.readFileSync(__dirname + '/ssl/snakeoil.key'),
}
const secureHttpd = http.createServer(sslFiles, app);

// Setting template engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// This will allow the template engine to ue stuff (img/css) in the "/public" folder
app.use(express.static(__dirname + "/public"));

// Main class (this name *has to* be changed)
class Main {
    constructor() {
        if (Main.instance) {
            return Main.instance; // Singleton!
        }
        this.users = [];
        Main.instance = this;
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
    // Temp method, might be changed later
    getUserByHandler(handler) {
        for (let i=0; i<this.users.length; i++) {
            if ( this.users[i].handler == handler ) {
                return this.users[i];
            }
        }
    }
    getUserByChatId(id) {
        console.log("CAlling the getUserByChat func");
        for (let i=0; i<this.users.length; i++) {
            console.log("Iterating...")
            if (this.users[i].chatbot !== undefined ) {
                if ( this.users[i].chatbot.chatId == id ) {
                    console.log("Got a result!!");
                    return this.users[i];
                }
            }
        }
        console.log("Finished func");
    }
    listUsers(callback) {
        callback(this.users);
    }
    getPassword(handler) {
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
            logger.info('[HTTPS] Auth succeeded for user ' + username);
            return done(null, mainClass.getUser(username));
        }
        if ( (username == configuration.admin.username) 
        && (password == configuration.admin.password)) { 
            logger.info('[HTTPS] Auth succeeded for the administrator');
            const adminUserObj = new database.User(
                configuration.admin.password,
                configuration.admin.username,
                'Administrator',
                'admin@email.com');
            mainClass.addUser(adminUserObj);
            return done(null,mainClass.getUser(username));
        } 
        else {
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
        console.log(req.body.url);
        const chatBot = new chat.ChatBot(req.body.url);
        const user = mainClass.getUser(req.user.handler);
        await chatBot.initialize(req.body.url,user);
        console.log(req.body.url, user);
        console.log(chatBot);
        res.redirect('/profile');

    } catch (err) {
        console.error(err);
        res.redirect('/profile?');
    }
});

// These two routes (temp and system) should be merged <3
 
// System route
app.post('/system', isAuthenticated, async (req, res) => {
    //Logic for changing the system msg
    try {
        console.log(req.body.url);
        const user = mainClass.getUser(req.user.handler);
        user.systemMsg = req.body.url;
        console.log(user)
        const query = `
            UPDATE users SET system_msg = ? WHERE id = ?
        `;
        const values = [req.body.url, user.id];
        await db.makeQuery(query,values);
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/profile?');
    }
});

// Temperature route
app.post('/temp', isAuthenticated, async (req, res) => {
    //Logic for changing the temperature
    try {
        console.log(req.body.url);
        const user = mainClass.getUser(req.user.handler);
        user.temp = Number(req.body.url);
        console.log(user)
        const query = `
            UPDATE users SET temp = ? WHERE id = ?
        `;
        const values = [req.body.url, user.id];
        await db.makeQuery(query,values);
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/profile?');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.logout(() => {console.log("Logged out");});
    res.redirect('/');
});


// Change this func names, they're a bit confusing
function isAlreadyAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        res.redirect('/profile');
    } else {
        return next();
    }
}

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // Is authenticated
    }
    res.status(404).render('404'); // Is not auth
}

function isAdmin(req, res, next) {
    if ((req.isAuthenticated()) && (req.user == 'admin')) {
        return next();
    }
    res.status(404).render('404');
}

// Login page
app.get('/login', isAlreadyAuthenticated, (req, res) => {
    res.render('login');
});

// Placeholder for main page
app.get('/', (req,res) => {
    const content = "Coming soon."
    res.render('index', { content });
});

// Profile checker (this route is a bit redundant, should be redone)
app.get('/profile', (req, res) => {
    if (req.isAuthenticated()) {
        const username = req.user.handler;
        if ( username == configuration.admin.username) {
            res.redirect('/admin');
        } else { 
            res.redirect(`/${username}`);
        }
    } else {
        res.redirect('/login');
    }
});

// Getting admin panel
app.get('/admin', isAuthenticated, (req, res) => { 
    const data = 'testing';
    console.log(req.user);
    if ( req.user.handler == configuration.admin.username ) {
        res.render('admin', { data })
    }
    else {
        res.status(404).render('404');
    }
});

// Route for chatbots
app.get('/chat/:id', (req,res) => {
    const { id } = req.params;
    console.log(id);
    const user = mainClass.getUserByChatId(id);
    if (mainClass.getUserByChatId(id) !== undefined) {
        console.log("Got an user");
        console.log(user);
        res.render('chat', { user });
    } else { res.status(404).render('404'); }
});

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
    logger.info('[HTTPd] Running on port ' + port);
});


/* 
 * Websocket Server
 * 
 */

// Init websocket server through https

const wsServer = new ws.Server({server: secureHttpd});

// WS functions

wsServer.on('connection',  (ws) => {
    logger.info("[WEBSOCKET] Client connected"); 
    //const greet = {origin: "server", data: { response: { content: "Hello, how can I help you?" } } };
    //ws.send(JSON.stringify(greet));
    ws.on('message', async (msg) => {
        try {
            msg = JSON.parse(msg);
            console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
            // Calling OpenAI API
            let user = mainClass.getUserByHandler(msg.origin);
            if ( user.chatbot === undefined) {
                const response = await chat.generateText(msg.data);
                const resMsg = {
                    origin: "server",
                    data: response,
                }
                console.log(resMsg);
                ws.send(JSON.stringify(resMsg));
            } else {
                console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
                let chatbot = user.chatbot;
                //console.log(chatbot);
                console.log("Got the bot");
                console.log(user);
                let resMsg;
                if ( msg.debug == true ) {
                    let text = await chatbot.generateText(msg.data, user, msg.debug);
                    resMsg = {
                        origin: "server",
                        data: text,
                    }
                } else {
                    msg.debug = false;
                    let text = await chatbot.generateText(msg.data, user, msg.debug);
                    resMsg = {
                        origin: "server",
                        data: text,
                    }
                }

                console.log(resMsg);
                ws.send(JSON.stringify(resMsg));
            }

            
        } catch (err) {
            console.error("[WEBSOCKET] Error in JSON msg: " + err)
        }
    });
});


// Instancing class and retrieving users
/*
const newUser = new database.User('password', 'volvat', 'Volvat Medisinske', 'mail@volvat.no');
const newUser2 = new database.User('password', 'digitalai', 'DigitalAi', 'post@digitalai.no');
const newUser3 = new database.User('password', 'eurofins', 'EuroFins Scientific', 'mail@eurofins.no');

db.createUser(newUser, (createdUser) => {
    console.log('User created:', createdUser);
});

db.createUser(newUser2, (createdUser) => {
    console.log('User created:', createdUser);
});

db.createUser(newUser3, (createdUser) => {
    console.log('User created:', createdUser);
});
*/

// For first time running

db.createStructure();


// Retrieving users

db.getUsers((users) => {
    users.forEach(async (user) => {
        // Add the user
        try {
            mainClass.addUser(user);
            // Check if user has a chatbot and add if yes
            if (user.url !== null) {
                const chatbot = new chat.ChatBot();
                    let undef;
                    await chatbot.initialize(undef, user);
                    console.log("Detected user with chatbot");
            }
        } catch(err) { throw err; } 
        console.log(user)
    });
});


// Testing function


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