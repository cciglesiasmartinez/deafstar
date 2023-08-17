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
    (this.id = id), (this.metadata = metadata), (this.embedding = embedding);
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
          text: v.text,
          url: v.url,
          title: v.title,
        };
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
  // Initialize the chatbot function.
  async initialize(url, user) {
    // Look if there's id, if not give one
    if (user.hasChatBotId()) {
      console.log("Got user for chatbot.");
      this.chatId = user.chatId;
      this.userId = user.id;
      this.namespace = user.handler;
      this.url = user.url;
      const pinecone = await this.PineconeInit();
      this.index = pinecone;
      this.vectors = await this.getVectors(user.id);
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
      // Now update the user object with the information from the chatbot
      user.url = this.url;
      user.chatId = this.chatId;
      user.systemMsg = "I'm a bot designed to help you.";
      user.temp = 0;
      user.vectorsPerAnswer = 2;
      user.greetMsg = "Hello, I'm here to help you :)";
      user.urlSuggestionsText =
        "Here are some links that you might find useful";
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
  //RFR -1
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
        result.push(
          ...chunks.map((chunk) =>
            this.createUrlFromPage(page.url, page.title, chunk)
          )
        );
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
          this.createUrlFromPage(page.url, page.title, combinedChunks.join(" "))
        );
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
  async generateVectorEmbedding(data) {
    const result = [];
    const delay = 300;
    let i = 0;
    for (let page of data) {
      let id = v4(); // Keep an eye on this, remote possibility of collision
      let res = await openai.createEmbedding({
        model: "text-embedding-ada-002",
        input: page.content,
      });
      //console.log(res);
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
    console.log(pinecone);
    console.log("CALLING CHECK-OR-CREATE");
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
    const delay = 1000;
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
        //await new Promise((resolve) => setTimeout(resolve, delay));
      }
      console.log("[PINECONE] Upserted batches: " + i + batchSize);
      console.log(
        "[PINECONE] Batches left: " + (data.length - (i + batchSize))
      );
    }
    console.log(result);
    return result;
  }
  // Generate prompt and answer
  // RFR-3
  async generateText(prompt, user, debug) {
    //console.log("GENERATE TEXT PETITION REC, USER IS " + JSON.stringify(user));
    const res = await openai.createEmbedding({
      input: prompt,
      model: "text-embedding-ada-002",
    });
    console.log(res.data.data[0].embedding);
    const embed = res.data.data[0].embedding;
    //const pinecone = await PineconeInit();
    //const index = await checkOrCreateIndex(pinecone);
    //const index = this.index;
    //console.log(this.index);
    const index = await this.checkOrCreateIndex(this.index);
    console.log("GOOOOOOOOOOOOOOOOOT INDEX!!!!!!!!!!!!!!!!!!");
    console.log(this.index);
    let related;
    try {
      related = await index.query({
        queryRequest: {
          topK: 2,
          vector: embed,
          namespace: this.namespace,
          includeMetadata: true,
        },
      });
      console.log(related);
    } catch (err) {
      throw err;
    }
    let prompty = [
      {
        role: "system",
        content: user.systemMsg,
      },
      {
        role: "assistant",
        content:
          related.matches[0].metadata.text +
          " " +
          related.matches[1].metadata.text,
      },
      {
        role: "user",
        content: prompt,
      },
    ];
    console.log(prompty);
    //console.log(related.matches[0,1].metadata);
    //console.log('Answer this question: ' + prompt + '. With this context: '
    //    + related.matches[0].metadata.text + ' ' + related.matches[1].metadata.text);
    //console.log("[CHAT] Generating text for prompt...");
    const response = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: prompty,
      temperature: user.temp,
      //max_tokens: 300,
      //temperature: 0,
    });
    //console.log(prompt);
    //const text = response.data.choices[0].message;
    let text;
    if (debug) {
      let debugText = `DEBUG MODE\n CONTEXT RETRIEVED:\n ${related.matches[0].metadata.text} \n 
            ${related.matches[1].metadata.text} \n 
            ANSWER OFFERED: \n
            `;
      // Put debug text in its right place
      response.data.choices[0].message.content =
        debugText + response.data.choices[0].message.content;
      text = {
        response: response.data.choices[0].message,
        urls: [
          related.matches[0].metadata.url,
          related.matches[1].metadata.url,
        ],
      };
    } else {
      text = {
        response: response.data.choices[0].message,
        urls: [
          related.matches[0].metadata.url,
          related.matches[1].metadata.url,
        ],
      };
    }

    console.log(text);
    //const text = response.data.choices[0].text.replace(/\n/g,"");
    return text;
  }
}

// Demonstration without enhanced functionality (delete later)
async function generateText(prompt) {
  const response = await openai.createCompletion({
    model: "text-davinci-003",
    prompt: prompt,
    max_tokens: 300,
  });
  console.log("BASIC GENERATION: " + prompt);
  const text = response.data.choices[0].text.replace(/\n/g, "");
  return text;
}

module.exports = {
  generateText,
  ChatBot,
};
