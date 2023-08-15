/*
 * WebSocket Server
 *
 * This file contains the implementation of a WebSocket server that handles connections,
 * messages, and interactions with chatbots. It uses the 'ws' library to create a 
 * WebSocket server, interacts with the UserManagement class to retrieve user information, 
 * and communicates with the chatbot for generating responses to user messages.
 *
 */

// Dependencies
const chat = require('./chat.js');
const ws = require('ws');
const { Logger } = require('./log.js');
const { UserManagement, User } = require('./struct.js');

// Initializing logger
const logger = new Logger();

// Init class for user management
const userManagement = new UserManagement();

// Websocket basic handling functions
function setupWebsockets(server) {
    // Initialize the server 
    const wsServer = new ws.Server({ server });
    //Handle all the logic regarding messages
    wsServer.on('connection',  (ws) => {
        logger.info("[WEBSOCKET] Client connected"); 
        ws.on('message', async (msg) => {
            console.log(msg);
            console.log("[WEBSOCKET] Data from " + msg.origin + " received: " + msg.data);
            try {
                // Parse the msg and get the object for the user
                msg = JSON.parse(msg);
                const user = userManagement.getUserByHandler(msg.origin);
                // Set format of the message
                const resMsg = {
                    origin: "server",
                    data: undefined
                };
                // Check if user has not a chatbot attached (still not have crawled their site)
                if ( !user.hasChatBotId() ) {
                    const response = await chat.generateText(msg.data);
                    const dataObj = {
                        response: { 
                            role: undefined,
                            content: response 
                        },
                        urls: ["Unavailable", "Unavailable"]
                    }
                    resMsg.data = dataObj;
                    console.log(resMsg);
                    // We send the response in JSON format to the WebSocket client.
                    ws.send(JSON.stringify(resMsg));
                } else {
                    // Get the chatbot instance for the user
                    const chatbot = user.chatbot;
                    // We check if current user has debug mode enabled or not.
                    if ( msg.debug == true ) {
                        const text = await chatbot.generateText(msg.data, user, msg.debug);
                        resMsg.data = text;
                    } else {
                        msg.debug = false;
                        const text = await chatbot.generateText(msg.data, user, msg.debug);
                        resMsg.data = text;
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
    
}

module.exports = { setupWebsockets };