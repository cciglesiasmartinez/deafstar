
/*
 * Chatbot Stuff
 *
 */

require("dotenv").config();
const tiktoken = require("tiktoken-node");
const { Configuration, OpenAIApi } = require("openai");
const { PineconeClient } = require("@pinecone-database/pinecone");
const { Crawler, Url } = require("./crawler.js");
const { v4 } = require("uuid");
const { DB } = require("./db.js");
const { conf } = require("../conf/conf.js");

const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.PINECONE_ENV;
const openAiApiKey = process.env.OPENAI_API_KEY;
const openAiConf = new Configuration({ apiKey: openAiApiKey });
const openai = new OpenAIApi(openAiConf);
const database = new DB(
  conf.db.host,
  conf.db.user,
  conf.db.password,
  conf.db.name
);

console.log("[CHAT] OpenAI API key: " + openAiApiKey);
console.log("[CHAT] Pinecone API key; " + pineconeApiKey);

/*
 * Class for chatbot stuff
 *
 */

class VectorEmbed {
	constructor(id, metadata, embedding) {
		this.id = id;
		this.metadata = metadata; 
		this.embedding = embedding;
	}
}

class ChatBot {
	constructor() {
		this.chatId = undefined;
		this.userId = undefined;
		this.namespace = undefined;
		this.url = undefined;
		this.vectors = [];
		this.indexName = "digitalai";
		this.index = undefined;
		this.vectorsPerAnswer = undefined;
		this.aiModel = "gpt-3.5-turbo";
		this.chatLogs = undefined;
	}
	// Get all the vectors for a given chatbot
	async getVectors(userId) {
		try {
			// Query the database to fetch all the vectors
			const query = `
				SELECT vector_id, title, text, url 
				FROM vectors WHERE user_id = ?
			`;
			const values = [userId];
			const response = await database.makeQuery(query, values);
			// Format them properly to insert in our object
			const vectorArray = [];
			response.forEach((v) => {
				let metadata = {
					id: v.vector_id,
					text: v.text,
					url: v.url,
					title: v.title,
				};
				// Create the object using our template class
				let vector = new VectorEmbed(v.user_id, metadata, undefined);
				vectorArray.push(vector);
			});
			return vectorArray;
		} catch (err) {
			throw err;
		}
	}
	// Update the SQL database with the data
	async updateSQL(
		id,
		url,
		chatId,
		systemMsg,
		temp,
		vectorsPerAnswer,
		greetMsg,
		urlSuggestionsText
		) {
		try {
			const query = `
				UPDATE users 
				SET url = ?, chat_id = ?, system_msg = ?, temp = ?,
				vectors_per_answer = ?, greet_msg = ?, url_suggestions_text = ?
				WHERE id = ?
			`;
			const values = [
				url,
				chatId,
				systemMsg,
				temp,
				vectorsPerAnswer,
				greetMsg,
				urlSuggestionsText,
				id,
			];
			await database.makeQuery(query, values);
		} catch (err) {
			throw err;
		}
	}
	// Helper method to update with existing chat_id
	// ** THis should be refactored later. It looks ugly.
	async setChatDataFromUser(user) {
		this.chatId = user.chatId;
		this.userId = user.id;
		this.namespace = user.handler;
		this.url = user.url;
		this.vectorsPerAnswer = user.vectorsPerAnswer;
		this.index = await this.PineconeInit();
		this.vectors = await this.getVectors(user.id);
		this.aiModel = user.aiModel;
		this.chatLogs = await this.getChatLogs(user);
	}
	// Initialize the chatbot function.
	async initialize(url, user) {
		// Look if there's id, if not give one
		if (user.hasChatBotId()) {
			console.log("[CHAT] Got user for chatbot.");
			await this.setChatDataFromUser(user);
		} else {
			// Basic object data
			this.url = url;
			this.chatId = v4();
			this.userId = user.id;
			this.namespace = user.handler;
			// Create Crawler instance and init the crawling process
			const crawler = new Crawler(url);
			let urlData = await crawler.start();
			// Set the url for this chatbot instance
			this.url = url;
			// Normalize the data
			urlData = await this.normalizeCrawledData(urlData);
			// Chunk the data
			urlData = await this.chunkData(urlData, 500);
			// Generate the vectors
			urlData = await this.generateVectorEmbedding(urlData);
			this.vectors = urlData;
			// Init Pinecone API and get our index
			const pinecone = await this.PineconeInit();
			this.index = pinecone;
			// Upsert the vectors into our index
			urlData = await this.upsertEmbeddings(pinecone, urlData, 100);
			// Now update user object with the information from the chatbot
			user.url = this.url;
			user.chatId = this.chatId;
			user.systemMsg = "I'm a bot designed to help you.";
			user.temp = 0;
			user.vectorsPerAnswer = 2;
			user.greetMsg = "Hello, I'm here to help you :)";
			user.urlSuggestionsText = "Suggested links:";
			// Send the data to the database
			await this.updateSQL(
				user.id,
				user.url,
				user.chatId,
				user.systemMsg,
				user.temp,
				user.vectorsPerAnswer,
				user.greetMsg,
				user.urlSuggestionsText
			);
		}
		// Finally add the whole chatbot object to the user
		user.addChatBot(this);
		console.log(user);
	}
	// Normalize URL data
	async normalizeCrawledData(pages) {
		const result = [];
		// Removing line breaks and filtering empty elements
		pages.forEach((page) => {
			const filteredContent = page.content
			// This takes away tabs and line breaks
			.map((element) => element.replace(/[\t\n]/g, ""))
			// This deals with empty spaces
			.map((element) => element.replace(/ {2,}/g, ""))
			.filter((element) => element.trim() !== "");
			if (filteredContent.length > 0) {
				result.push({ ...page, content: filteredContent });
			}
		});
		return result;
	}
	// Chunk URL data into manageable bits
	// ** This needs to be refactored. Maybe a new module.
	async chunkData(pages, max_tokens) {
		const result = [];
		const enc = tiktoken.encodingForModel("text-davinci-003");
		for (let i = 0; i < pages.length; i++) {
			let page = pages[i];
			let content = page.content.join(" ");
			let tokens = enc.encode(content).length;
			if (tokens >= max_tokens) {
				const words = content.split(" ");
				let currentChunk = "";
				let currentTokensCount = 0;
				const chunks = [];
				for (const word of words) {
					const wordTokens = enc.encode(" " + word).length;
					if (currentTokensCount + wordTokens <= max_tokens) {
						currentChunk += " " + word;
						currentTokensCount += wordTokens;
					} else {
						chunks.push(currentChunk.trim());
						currentChunk = word;
						currentTokensCount = wordTokens;
					}
				}
				if (currentChunk !== "") {
					chunks.push(currentChunk.trim());
				}
				result.push(...chunks.map((chunk) =>
					this.createUrlFromPage(page.url, page.title, chunk)));
			} else {
				let combinedTokens = tokens;
				let combinedChunks = [content];
				while (i + 1 < pages.length) {
					let nextPage = pages[i + 1];
					let nextContent = nextPage.content.join(" ");
					let nextTokens = enc.encode(nextContent).length;
					if (combinedTokens + nextTokens <= max_tokens) {
						combinedTokens += nextTokens;
						combinedChunks.push(nextContent);
						pages.splice(i + 1, 1);
					} else {
						break;
					}
				}
				result.push(
				this.createUrlFromPage(
					page.url, page.title, combinedChunks.join(" ")));
			}
		}
		return result;
	}
	// Helper method for chunkData
	createUrlFromPage(url, title, content) {
		const urlObj = new Url(url);
		urlObj.title = title;
		urlObj.content = content;
		return urlObj;
	}
	// Generate vector embeddings
	// ** This needs refactor.
	async generateVectorEmbedding(data) {
		const result = [];
		const delay = 300;
		let i = 0;
		for (let page of data) {
			let id = v4(); // Keep an eye on this, collisions?
			let res = await openai.createEmbedding({
				model: "text-embedding-ada-002",
				input: page.content,
			});
			let metadata = {
				text: page.content,
				url: page.url,
				title: page.title,
			};
			let v = new VectorEmbed(id, metadata, res.data.data[0].embedding);
			await database.addVector(v, this.userId);
			console.log(v);
			result.push(v);
			if (i < data.length - 1) {
				// Wait for delay before executing next iteration
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
			i++;
			console.log("[OPENAI] Embeddings obtained: " + i);
			console.log("[OPENAI] Embeddings left: " + (data.length - i));
		}
		return result;
	}
	// Initialize Pinecone
	async PineconeInit() {
		const pinecone = new PineconeClient({
			apiKey: pineconeApiKey,
			environment: pineconeEnvironment,
		});
		await pinecone.init({
			apiKey: pineconeApiKey,
			environment: pineconeEnvironment,
		});
		return pinecone;
	}
	// Check if index already exists, create it if it doesn't
	async checkOrCreateIndex(pinecone) {
		//console.log(pinecone);
		console.log("[PINECONE] Checking for index...");
		const indexes = await pinecone.listIndexes();
		if (!indexes.includes(this.indexName)) {
			await pinecone.createIndex({
				createRequest: {
				name: this.indexName,
				dimension: 1536,
				metric: "dotproduct",
				},
			});
		}
		const index = pinecone.Index(this.indexName);
		return index;
	}
	// Upsert embeddings into Pinecone in batches
	async upsertEmbeddings(pinecone, data, batchSize) {
		console.log("[PINECONE] Upserting process...");
		let result;
		const delay = 300;
		const index = await this.checkOrCreateIndex(pinecone);
		for (let i = 0; i < data.length; i += batchSize) {
			const iEnd = Math.min(data.length, i + batchSize);
			const metaBatch = data.slice(i, iEnd);
			const idsBatch = metaBatch.map((x) => x.id);
			const embeds = metaBatch.map((x) => x.embedding);
			const metaBatchForUpsert = metaBatch.map((x) => ({
				title: x.metadata.title,
				text: x.metadata.text,
				url: x.metadata.url,
			}));
			const toUpsert = idsBatch.map((id, idx) => ({
				id,
				values: embeds[idx],
				metadata: metaBatchForUpsert[idx],
			}));
			console.log(toUpsert);
			result = await index.upsert({
				upsertRequest: {
				vectors: toUpsert,
				namespace: this.namespace,
				},
			});
			// Waiting for the next batch
			if (i + batchSize < data.length) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
			console.log("[PINECONE] Upserted batches: " + i + batchSize);
			console.log("[PINECONE] Left: " + (data.length - (i + batchSize)));
		}
		return result;
	}
	// Get vectors for query
	async getRelatedVectors(questionVector) {
		try {
			console.log("GEtting vectors");
			// Response object	
			const result = {
				texts: [],
				urls: [],
			};
			// Check if index exist
			const index = await this.checkOrCreateIndex(this.index);
			// Collect the vectors from Pinecone
			const related = await index.query({
				queryRequest: {
					topK: this.vectorsPerAnswer,
					vector: questionVector,
					namespace: this.namespace,
					includeMetadata: true,
				},
			});
			console.log('THIS IS THE RELATED', related);
			// Do things this way!! 
			// related.matches.forEach( () => {  });
			console.log("Entering FOR LOOP, nuber of iterations:", this.vectorsPerAnswer);
			for (let i = 0; i < this.vectorsPerAnswer; i++) {
				console.log('Iterating...', i);
				result.texts.push(related.matches[i].metadata.text);
				result.urls.push(related.matches[i].metadata.url);
			}
			console.log('THIS IS THE RESULT',result);
			return result;
		} catch (err) {
			throw err;
		}
	}
  	// Generate prompt and answer
	// ** This should be refactored.
	async generateText(prompt, user, debug) {
		// Get vector for the question 
		const res = await openai.createEmbedding({
			input: prompt,
			model: "text-embedding-ada-002",
		});
		console.log(res.data.data[0].embedding);
		const questionVector = res.data.data[0].embedding;
		console.log("[PINECONE] Got index again!");
		// Get the  Related vectors from pinecone
		const relatedVectors = await this.getRelatedVectors(questionVector);
		const relatedTexts = relatedVectors.texts.join('\n');
		const messages = [
			{
				role: "system",
				content: user.systemMsg,
			},
			{
				role: "assistant",
				content: relatedTexts,
			},
			{
				role: "user",
				content: prompt,
			},
		];
		// Check it on screen (delete later)
		console.log('THIS IS HOW MSGS LOOK', messages);
		// Get the right answer (context provided) from the AI model
		const response = await openai.createChatCompletion({
			model: this.aiModel,
			messages: messages,
			temperature: user.temp,
		});
		// Log answer and question it our database
		await this.chatLog(user, prompt, response.data.choices[0].message.content);
		let answerOffered;
		// Check if debug mode is enabled;
		if (debug) {
			// ** This should be redone in a cleaner way
			let debugText = `<b>Vectors retrieved:</b>\n 
			${relatedTexts}\n<b>Answer offered:</b> \n `;
			// Put debug text in its right place
			response.data.choices[0].message.content =
				debugText + response.data.choices[0].message.content;
			answerOffered = {
				response: response.data.choices[0].message,
				urls: relatedVectors.urls,
			};
		} else {
			answerOffered = {
				response: response.data.choices[0].message,
				urls: relatedVectors.urls,
			};
		}
		console.log(answerOffered);
		return answerOffered;
	}
	// Chat logging function
	async chatLog(user, question, answer) {
		const date = Math.floor(new Date().getTime() / 1000);
		const query = `
			INSERT INTO chat_logs (
				user_id,
				date,
				question,
				answer
				)
			VALUES (?,?,?,?)
		`;
		const values = [user.id, date, question, answer];
		database.makeQuery(query,values);
		console.log('[CHAT] Logged question and answer.');
	}
	// Gather all the logs for current chatbot instance
	async getChatLogs(user) {
		const query= `
			SELECT date, question, answer FROM chat_logs
			WHERE user_id = ?
		`;
		const values = [user.id];
		const result = await database.makeQuery(query,values);
		console.log('[CHAT] Logs gathered for user', user.handler);
		return result;
	}
}

// Demonstration without enhanced functionality (delete later)
async function generateText(prompt) {
	const response = await openai.createCompletion({
		model: "text-davinci-003",
		prompt: prompt,
		max_tokens: 300,
	});
	console.log("[CHAT] BASIC GENERATION: " + prompt);
	const text = response.data.choices[0].text.replace(/\n/g, "");
	return text;
}

module.exports = {
	generateText,
	ChatBot,
};
