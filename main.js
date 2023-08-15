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
const crawler = require('./src/crawler.js');
const database = require('./src/db.js');
const chat = require('./src/chat.js');
const { Logger } = require('./src/log.js');
const { conf } = require('./conf/conf.js');
const { UserManagement, User } = require('./src/struct.js');

// Instancing database
const db = new database.DB(conf.db.host, conf.db.user, conf.db.password, conf.db.name );

// Initializing logger
const logger = new Logger();

// Init main class and test users (this is dirty, just temp)
const userManagement = new UserManagement();



/*
 * Express server initialization
 *
 */

// Retrieve SSL key + cert
const sslFiles = {
    cert: fs.readFileSync(__dirname + '/ssl/snakeoil.crt'),
    key: fs.readFileSync(__dirname + '/ssl/snakeoil.key'),
}

// Create the instance
const secureHttpd = http.createServer(sslFiles, app);

// Setting template engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// This will allow the template engine to ue stuff (img/css) in the "/public" folder
app.use(express.static(__dirname + "/public"));

// Initialize and put listening the http server
secureHttpd.listen(conf.server.port, () => {
    logger.info('[HTTPd] Running on port ' + conf.server.port);
});



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
    const user = userManagement.getUserByHandler(handler);
    done(null, user);
});
  
// Passport configuration, local strategy.
passport.use(new LocalStrategy(
    (username, password, done) => {
        // Regular users
        if (password == userManagement.getPassword(username)) {
            logger.info('[HTTPS] Auth succeeded for user ' + username);
            return done(null, userManagement.getUserByHandler(username));
        }
        // Administrator
        if ( (username == conf.admin.username) 
        && (password == conf.admin.password)) { 
            logger.info('[HTTPS] Auth succeeded for the administrator');
            const adminUserObj = new database.User(
                conf.admin.password,
                conf.admin.username,
                'Administrator',
                'admin@email.com');
            userManagement.addUser(adminUserObj);
            return done(null,userManagement.getUserByHandler(username));
        } 
        else {
            return done(null, false, { message: 'Invalid login' });
        }
    }
));

// Middleware for authentication
function isAlreadyAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        res.redirect('/profile');
    } else {
        return next();
    }
}

// More middleware for authentication
function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // Is authenticated
    }
    res.status(404).render('404'); // Is not auth
}

/*
// More middleware. Maybe this should be deprecated.
function isAdmin(req, res, next) {
    if ((req.isAuthenticated()) && (req.user == 'admin')) {
        return next();
    }
    res.status(404).render('404');
}
*/

// Initializing passport and establishing sessions
app.use(passport.initialize());
app.use(passport.session());



/*
 * Routes
 * 
 * In the future, those routes here should be re-factored and adapted
 * to operate in a RESTful API manner.
 *
 */

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
        const user = userManagement.getUserByHandler(req.user.handler);
        await chatBot.initialize(req.body.url,user);
        console.log(req.body.url, user);
        console.log(chatBot);
        res.redirect('/profile');

    } catch (err) {
        console.error(err);
        res.redirect('/profile');
    }
});

// System route
app.post('/system', isAuthenticated, async (req, res) => {
    //Logic for changing the system msg
    try {
        const user = userManagement.getUserByHandler(req.user.handler);
        user.systemMsg = req.body.url;
        const query = `
            UPDATE users SET system_msg = ? WHERE id = ?
        `;
        const values = [req.body.url, user.id];
        await db.makeQuery(query,values);
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/profile');
    }
});

// Temperature route
app.post('/temp', isAuthenticated, async (req, res) => {
    //Logic for changing the temperature
    try {
        const user = userManagement.getUserByHandler(req.user.handler);
        user.temp = Number(req.body.url);
        const query = `
            UPDATE users SET temp = ? WHERE id = ?
        `;
        const values = [req.body.url, user.id];
        await db.makeQuery(query,values);
        res.redirect('/profile');
    } catch (err) {
        console.error(err);
        res.redirect('/profile');
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.logout(() => {console.log("Logged out");});
    res.redirect('/');
});

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
        if ( username == conf.admin.username) {
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
    if ( req.user.handler == conf.admin.username ) {
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
    const user = userManagement.getUserByChatId(id);
    if (userManagement.getUserByChatId(id) !== undefined) {
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
    if ((userManagement.getUserByHandler(username)) && (handler == username)) {
        const user = userManagement.getUserByHandler(username);
        console.log("[HTTPd]: Obtained user \n", user);
        res.render('user', { user });
    } else {
        // Sending error
        //console.log(userManagement.users, "Requested user " + req.params.username);
        res.status(404).render('404');
    }
});

// Handling 404 routes
app.use((req, res, next) => {
    res.status(404).render('404');
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
        console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
        try {
            // Parse the msg and get the object for the user
            msg = JSON.parse(msg);
            const user = userManagement.getUserByHandler(msg.origin);
            // Check if user has not a chatbot attached (still not have crawled their site)
            if ( user.chatbot === undefined) {
                const response = await chat.generateText(msg.data);
                const dataObj = {
                    response: { 
                        role: undefined,
                        content: response 
                    },
                    urls: ["Unavailable", "Unavailable"]
                }
                const resMsg = {
                    origin: "server",
                    data: dataObj,
                }
                console.log(resMsg);
                // We send the response in JSON format to the WebSocket client.
                ws.send(JSON.stringify(resMsg));
            } else {

                let chatbot = user.chatbot;
                let resMsg;
                // We check if current user has debug mode enabled or not.
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
                // We send the response in JSON format to the WebSocket client.
                ws.send(JSON.stringify(resMsg));
            }
        } catch (err) {
            console.error("[WEBSOCKET] Error in JSON msg: " + err)
        }
    });
});



/* 
 * Database initialization.
 * 
 */

// For first time running
db.createStructure();

// Retrieving users
db.getUsers((users) => {
    users.forEach(async (user) => {
        // Add the user
        try {
            userManagement.addUser(user);
            // Check if user has a chatbot and add if yes
            if (user.url !== null) {
                const chatbot = new chat.ChatBot();
                    /* This is really an ugly way to call initialize() without
                     * passing an URL. I'd be open to suggestions: a different
                     * function for this use case, maybe an object @param...
                     */
                    let undef; 
                    await chatbot.initialize(undef, user);
                    console.log("Detected user with chatbot");
            }
        } catch(err) { throw err; } 
        console.log(user)
    });
});



// Ad hoc code for creating some initial users.
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