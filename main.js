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
 *      ReactJS (cool, scalable, single application format chat user interface)
 *      Webpack (related to ReactJS)
 * 
 *  Languages used will be: JavaScript, CSS3, HTML5, SQL
 * 
 */

