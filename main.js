/*
 * Okay, some things to do:
 * 
 * First would be to create the main http/express functions, that is, the core engine
 * able to create several instances on demand, each one corresponding to a dinamically
 * generated handler in the form of https://url/my_handler with its correspont instance
 * of chatgpt.
 * 
 * Second, to create a very simple chatgpt interface attached to each one of the
 * instances. This interface would be a mere placeholder until the final ReactJS 
 * interface is ready to deploy.
 * 
 * Thirdly, creating functionality to train each instance from its dashboard panel
 * (remember url.com/my_handler) trough Pinecone API. As for starters functionalty, I'd
 * suggest going with a function that will enable the client to pass its URL, scrap
 * it, and then build a custom vector db with it, much like in the form that's 
 * explained in <url here needed>.
 * 
 * Lastly, a secure and robust login system and an admin panel.
 * 
 * Stack of technologies suggested will be like:
 * 
 *  Backend:
 *      NodeJS
 *          EJS (dinamically HTML generation)
 *          ExpressJS (HTTP server functionality)
 *          OpenAI API (chatbot service)
 *          Pinecone API (embedding for chatbot)
 *          TikToken (utility for tracking tokens for chat I/O)
 *          WS (websockets library, used for communicating backend with frontend)
 *      MariaDB (SQL database)
 * 
 *  Frontend:
 *      ReactJS (cool, scalable, single application chat and dashboard user interface)
 *      Webpack (related to ReactJS)
 * 
 *  Languages used will be: JavaScript, CSS3, HTML5, SQL
 * 
 */

const express = require('express');
const app = express();

const users = {
    client1: {
        name: 'Client #1',
        token: 1234,
    },
    client2: {
        name: 'Client #2',
        token: 5678,
    },
};
  
// Getting users page
app.get('/:username', (req, res) => {
    const { username } = req.params;
  
    // Checking if exists
    if (username in users) {
        // Serving JSON data
        res.json(users[username]);
    } else {
        // Sending error
        res.status(404).send('Handler does not exist.');
    }
});
  
// Iniciamos el servidor en el puerto 3000 (puedes cambiarlo si lo deseas)
app.listen(8008, () => {
    const port = 8008;
    console.log('[HTTPd] Running on port ' + port);
});