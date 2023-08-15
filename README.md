# DEAFSTAR
Private repo for the project
## To do
The first would be to create the main http/express functions, that is, the core engine able to create several instances on demand, each one corresponding to a dinamically generated handler in the form of https://url/my_handler with its correspont instance of chatgpt.

Second, to create a very simple chatgpt interface attached to each one of the instances. This interface would be a mere placeholder until the final ReactJS interface is ready to deploy.

Thirdly, creating functionality to train each instance from its dashboard panel (remember url.com/my_handler) trough Pinecone API. As for starters functionalty, I'd suggest going with a function that will enable the client to pass its URL, scrap it, and then build a custom vector db with it, much like in the form that's explained in https://docs.pinecone.io/docs/gen-qa-openai.

Lastly, a secure and robust login system and an admin panel should be built.

## Technologies
Stack of technologies suggested will be like:

* Backend:
  * NodeJS
    * EJS (dinamically HTML generation)
    * ExpressJS (HTTP server functionality)
    * OpenAI API (chatbot service)
    * Pinecone API (embedding for chatbot)
    * TikToken (utility for tracking tokens for chat I/O)
    * WS (websockets library, used for communicating backend with frontend)
  * MariaDB (SQL database)
* Frontend:
  * ReactJS (cool, scalable, single application chat and dashboard user interface)
  * Webpack (related to ReactJS)

Languages used will be: JavaScript, CSS3, HTML5, SQL

## Code for creating users the first time 

Here goes a little snippet useful to create users the first time you run the application.

```
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
```
