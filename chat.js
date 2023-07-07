/*
 * This file will handle all chatGPT/AI related functions.
 * 
 * There are two main goals. First, we need to craft a system that assigns chatGPT
 * websocket instances to each user/client. Once this is done, each instance would
 * need some protocol/auth system in order to verify its being called from the 
 * correct frontend interface.
 * 
 * For example, lets say we have client1 (obj.handler = "client1"), so it would
 * need its own instance (obj.instance = new chatBot();) where all the data related
 * to its own Pinecone vector database will be available. Also, we will need a
 * websocket system on the backend in order to diferentiate chats opened from
 * different webchat clients, so we can deal with every vector database.
 * 
 * Also security issues should be regarded in order to prevent abuse from outside
 * the webchat. Some system has to be engineered in order to make sure requests
 * only come from real webchats and petitions cannot be forged outside them.
 *
 */

const ws = require('ws');
const https = require ('https');
const fs = require('fs');

// Set SSL parameters 
const sslFiles = {
    cert: fs.readFileSync(__dirname + '/ssl/snakeoil.crt'),
    key: fs.readFileSync(__dirname + '/ssl/snakeoil.key'),
}
const secureHttpd = https.createServer(sslFiles);

// Init websocket server through https
const wsServer = new ws.Server({secureHttpd});

// WS functions
wsServer.on('connection', (ws) => {
    wsServer.send("Connected!");
    wsServer.on('message', (msg) => {
        console.log("[WEBSOCKET] Data received: " + msg);
    });
});

secureHttpd.listen(9009, () => {
    console.log("[WEBSOCKET] Listening on port 9009");
});