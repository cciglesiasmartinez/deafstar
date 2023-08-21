/*
 * Application Entry Point
 *
 * This file serves as the entry point for the application. It initializes the
 * necessary components, such as the Express server, WebSocket server, database
 * connection, and routes. It also retrieves users from the database, sets up
 * the user management, and initializes chatbots for users who have them enabled.
 *
 */

// Dependencies
const express = require("express");
const ejs = require("ejs");
const fs = require("fs");
const http = require("http");
const app = express();
const chat = require("./src/chat.js");
const websockets = require("./src/websockets.js");
const { DB } = require("./src/db.js");
const { Logger } = require("./src/log.js");
const { conf } = require("./conf/conf.js");
const { UserManagement, User } = require("./src/struct.js");
const { routes } = require("./src/routes.js");

// Instancing database
const db = new DB(conf.db.host, conf.db.user, conf.db.password, conf.db.name);

// Initializing logger
const logger = new Logger();

// Init main class and test users (this is dirty, just temp)
const userManagement = new UserManagement();

// Retrieve SSL key + cert
const sslFiles = {
  cert: fs.readFileSync(__dirname + "/ssl/snakeoil.crt"),
  key: fs.readFileSync(__dirname + "/ssl/snakeoil.key"),
};

// Create the instance
const secureHttpd = http.createServer(sslFiles, app);

// Setting template engine
app.set("view engine", "ejs");
app.set("views", __dirname + "/views");

// Initialize and put listening the http server
secureHttpd.listen(conf.server.port, () => {
  logger.info("[HTTPd] Running on port " + conf.server.port);
});

// Serving all the routes needed
routes.setupRoutes(app);

// Initialize websockets module
websockets.setupWebsockets(secureHttpd);

// For first time running
db.createStructure();

/*
const newUser2 = {
  token: "digitalai",
  handler: "digitalai",
  name: "DigitalAi",
  email: "post@digitalai.no",
};

const userJson = JSON.stringify(newUser2);
db.createUser(newUser2, (createdUser) => {
  console.log("User created:", createdUser);
});
*/

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
    } catch (err) {
      throw err;
    }
    console.log(user);
  });
});
