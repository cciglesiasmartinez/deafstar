/*
 * Classes and structures
 * 
 */


//This class should manage the users and some quick queries
class UserManagement {
    constructor() {
        if (UserManagement.instance) {
            return UserManagement.instance; // Singleton!
        }
        this.users = [];
        UserManagement.instance = this;
    }
    // Add user, @param is object instantiated from class User
    addUser(user) {
        this.users.push(user);
    }
    // Temp method, might be changed later
    getUserByHandler(handler) {
        for (let i=0; i<this.users.length; i++) {
            if ( this.users[i].handler == handler ) {
                return this.users[i];
            }
        }
    }
    // Get an user by is chatId attribute
    getUserByChatId(id) {
        for (let i=0; i<this.users.length; i++) {
            if (this.users[i].chatbot !== undefined ) {
                if ( this.users[i].chatbot.chatId == id ) {
                    return this.users[i];
                }
            }
        }
    }
    // List all users available on the server object
    listUsers(callback) {
        callback(this.users);
    }
    // Get password for a handler, might be changed for a secure
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

// User class
class User {
    constructor(id, token, handler, name, email, url, chatId, systemMsg, greetMsg, vectorsPerAnswer, temp) {
        this.id = id;
        this.token = token;
        this.handler = handler;
        this.name = name;
        this.email = email;
        this.url = url;
        /*
         * It would be interesting to place all the attributes below (except 
         * chatbot) in a new object of a new class, or maybe in the chatBot 
         * one. I'm still not sure, suggestions on how to organize and handle 
         * this are really welcomed. Maybe we'll need another SQL table.
         */
        this.chatId = chatId;
        this.systemMsg = systemMsg;
        this.temp = temp;
        this.greetMsg = greetMsg;
        this.vectorsPerAnswer = vectorsPerAnswer;
        this.urlSuggestionsText = undefined ;
        this.chatbot = undefined;
    }
    // Returning client info
    getInfo() {
        return `Name: ${this.name}, Token: ${this.token},
        Email: ${this.email}, URL: ${this.url}`;
    }
    // Adds a chatbot to the current user
    addChatBot(chatbot) {
        this.chatbot = chatbot;
    }
    // Verifies if user has a chatbot assigned
    hasChatBotId() {
        if ( this.chatId !== null ) {
            return true;
        } else { return false; }
    }
}

module.exports = { UserManagement, User }