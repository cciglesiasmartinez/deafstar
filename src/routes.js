/*
 * Express Routes Configuration
 *
 * This file sets up the routes and their associated functionalities for the 
 * Express application. It initializes the necessary middleware, authentication 
 * strategies, and route handlers. The routes include login, crawling, system 
 * settings,temperature settings, logout, profile access, user panel and etc.
 *
 */

// Dependencies
const path = require('path');
const express = require('express');
const passport = require('passport');
const session = require('express-session');
const LocalStrategy = require('passport-local').Strategy;
const chat = require('./chat.js');
const { DB } = require('./db.js')
const { conf } = require('../conf/conf.js');
const { UserManagement } = require('./struct.js');

// Initialize database
const db = new DB(conf.db.host, conf.db.user, conf.db.password, conf.db.name );

// Initialize our User Management class
const userManagement = new UserManagement();

// Here is a method to initialize all the routes
const routes = {
    setupRoutes: (app) => {

        // Set static folder for css, assets and such
        const parentPath = path.resolve(__dirname, '..');
        app.use(express.static(parentPath + "/public"));

        // Middleware for JSON data handling
        // ** Might be good idea to later use body-parser
        app.use(express.json());

        // Session configuration
        app.use(session({
            secret: 'edit-this-secret',
            resave: false,
            saveUninitialized: false
        }));

        // Middleware for URL encoded data
        app.use(express.urlencoded({ extended: true }));

        // Serialize user
        passport.serializeUser((user, done) => {
            done(null, user.handler);
        });

        // Deserialize user
        passport.deserializeUser((handler, done) => {
            const user = userManagement.getUserByHandler(handler);
            done(null, user);
        });

        // Passport configuration, loical strategy
        passport.use(new LocalStrategy(
            (username, password, done) => {
                // Regular users
                if (password == userManagement.getPassword(username)) {
                    console.log('[HTTPS] Auth succeeded for user ' + username);
                    return done(null, userManagement.getUserByHandler(username));
                } 
                // Administrator
                else if ((username == conf.admin.username) && (password == conf.admin.password)) {
                    console.log('[HTTPS] Auth succeeded for the administrator');
                    const adminUserObj = new database.User(
                        conf.admin.password,
                        conf.admin.username,
                        'Administrator',
                        'admin@email.com');
                    userManagement.addUser(adminUserObj);
                    return done(null, userManagement.getUserByHandler(username));
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

        function isAuthenticated(req, res, next) {
            if (req.isAuthenticated()) {
                return next();
            }
            res.status(404).render('404');
        }

        app.use(passport.initialize());
        app.use(passport.session());

        // Login route
        app.post('/login', passport.authenticate('local', {
            successRedirect: '/profile',
            failureRedirect: '/login'
        }));

        // Crawl route
        app.post('/crawl', isAuthenticated, async (req, res) => {
            try {
                console.log(req.body.url);
                const chatBot = new chat.ChatBot(req.body.url);
                const user = userManagement.getUserByHandler(req.user.handler);
                await chatBot.initialize(req.body.url, user);
                console.log(req.body.url, user);
                console.log(chatBot);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // System setting
        app.post('/system', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                user.systemMsg = req.body.url;
                const query = `
                    UPDATE users SET system_msg = ? WHERE id = ?
                `;
                const values = [req.body.url, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Temperature setting
        app.post('/temp', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                user.temp = Number(req.body.url);
                const query = `
                    UPDATE users SET temp = ? WHERE id = ?
                `;
                const values = [req.body.url, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Greet message setting
        app.post('/greetMsg', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                user.greetMsg = req.body.url;
                const query = `
                    UPDATE users SET greet_msg = ? WHERE id = ?
                `;
                const values = [req.body.url, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Url suggestions text setting
        app.post('/urlSuggestionsText', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                user.urlSuggestionsText = req.body.url;
                const query = `
                    UPDATE users SET url_suggestions_text = ? WHERE id = ?
                `;
                const values = [req.body.url, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Vectors per answer setting
        app.post('/vectorsPerAnswer', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                user.vectorsPerAnswer = Number(req.body.vectorsPerAnswer);
                user.chatbot.vectorsPerAnswer = user.vectorsPerAnswer;
                const query = `
                    UPDATE users SET vectors_per_answer = ? WHERE id = ?
                `;
                const values = [user.vectorsPerAnswer, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // AI model setting
        app.post('/aiModel', isAuthenticated, async (req, res) => {
            try {
                const user = userManagement.getUserByHandler(req.user.handler);
                const aiModel = req.body.selectAiModel;
                user.aiModel = aiModel;
                user.chatbot.aiModel = aiModel;
                const query = `
                    UPDATE users SET ai_model = ? WHERE id = ?
                `;
                const values = [aiModel, user.id];
                await db.makeQuery(query, values);
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Add vector functionality
        app.post('/addVector', isAuthenticated, async (req,res)=> {
            try {
                console.log('[ROUTE] Add vector route called!');
                const user = userManagement.getUserByHandler(req.user.handler);
                await user.chatbot.createNewVector(user,req.body.url);
                /*
                const query = `
                    UPDATE users SET ai_model = ? WHERE id = ?
                `;
                const values = [aiModel, user.id];
                await db.makeQuery(query, values);
                */
                res.redirect('/profile');
            } catch (err) {
                console.error(err);
                res.redirect('/profile');
            }
        });

        // Logout route
        app.get('/logout', (req, res) => {
            req.logout(() => { console.log("Logged out"); });
            res.redirect('/');
        });

        // Login page
        app.get('/login', isAlreadyAuthenticated, (req, res) => {
            res.render('login');
        });

        // Placeholder for main page
        app.get('/', (req, res) => {
            res.redirect('/login');
        });

        // Helper method to redirect users to their panel
        app.get('/profile', (req, res) => {
            if (req.isAuthenticated()) {
                const username = req.user.handler;
                if (username == conf.admin.username) {
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
            if (req.user.handler == conf.admin.username) {
                res.render('admin', { data });
            } else {
                res.status(404).render('404');
            }
        });

        // Route for chatbots
        app.get('/chat/:id', (req, res) => {
            const { id } = req.params;
            console.log(id);
            const user = userManagement.getUserByChatId(id);
            if (userManagement.getUserByChatId(id) !== undefined) {
                console.log("Got an user");
                console.log(user);
                const data = {
                    user,
                    hostname: conf.server.hostname + ":" + conf.server.port.toString(),
                };
                res.render('chat', { data });
            } else {
                res.status(404).render('404');
            }
        });

        // User panel route
        app.get('/:username', isAuthenticated, (req, res) => {
            const { username } = req.params;
            const { handler } = req.user;
            if ((userManagement.getUserByHandler(username)) && (handler == username)) {
                const user = userManagement.getUserByHandler(username);
                console.log("[HTTPd]: Obtained user \n", user);
                const data = {
                    user,
                    hostname: conf.server.hostname + ":" + conf.server.port,
                };
                res.render('user', { data });
            } else {
                res.status(404).render('404');
            }
        });

        // Handling 404 routes
        app.use((req, res, next) => {
            res.status(404).render('404');
        });
    }
};

module.exports = { routes };
