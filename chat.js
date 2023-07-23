/*
 * OpenAI API call
 *
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

require('dotenv').config()
const { Configuration, OpenAIApi } = require('openai');

const openAiApiKey = process.env.OPENAI_API_KEY;
const conf = new Configuration({apiKey: openAiApiKey});
const openai = new OpenAIApi(conf);

console.log("[CHAT] OpenAI API key: " + openAiApiKey);

async function generateText(prompt) {
    let res = await openai.createEmbedding({
        input: prompt,
        model: "text-embedding-ada-002"
    });
    console.log(res.data.data[0].embedding);
    let embed = res.data.data[0].embedding;
    let pinecone = await PineconeInit();
    let index = await checkOrCreateIndex(pinecone);
    let related = await index.query({queryRequest:{
        topK: 2,
        vector: embed,
        namespace: 'digitalai',
        includeMetadata: true,
    }});
    console.log(related);
    console.log("[CHAT] Generating text for prompt...");
    const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt: 'Answer this question in english: ' + prompt + ' With this context: ' 
        + related.matches[0].metadata.text + ' ' + related.matches[1].metadata.text,
        max_tokens: 300,
    });
    console.log(prompt);
    const text = response.data.choices[0].text.replace(/\n/g,"");
    return text;
}


/*
 * Pinecone functionality
 *
 */

const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.PINECONE_ENV;
const tiktoken = require('tiktoken-node');
const { PineconeClient } = require('@pinecone-database/pinecone');
const { Url } = require('./crawler.js');
const { v4 } = require('uuid');

console.log("[CHAT] Pinecone API key; " + pineconeApiKey);


/*
 * Normalizing scraped data from websites. This function might be relevant to
 * processing speed and model effectiveness.
 *
 */

function normalizeScrapedData(pages) {
    const result = [];
    // Removing breaks and filtering empty elements
    pages.forEach((page) => {
      const filteredContent = page.content
        .map(element => element.replace(/\n/g, ''))
        .filter(element => element.trim() !== '');
  
      if (filteredContent.length > 0) {
        result.push({ ...page, content: filteredContent });
      }
    });
    //console.log(result);
    return result;
}


/*
 * Preparing the normalized contents for Pinecone 
 *
 */

async function chunkData(pages, max_tokens) {
    const result = [];
    const enc = tiktoken.encodingForModel("text-davinci-003");

    for (let i = 0; i < pages.length; i++) {
    let page = pages[i];
    let content = page.content.join(' ');
    let tokens = enc.encode(content).length;

    if (tokens >= max_tokens) {
        const words = content.split(' ');
        let currentChunk = '';
        let currentTokensCount = 0;
        const chunks = [];

        for (const word of words) {
            const wordTokens = enc.encode(' ' + word).length;
            if (currentTokensCount + wordTokens <= max_tokens) {
                currentChunk += ' ' + word;
                currentTokensCount += wordTokens;
            } else {
                chunks.push(currentChunk.trim());
                currentChunk = word;
                currentTokensCount = wordTokens;
            }
        }

        if (currentChunk !== '') {
        chunks.push(currentChunk.trim());
        }

        result.push(...chunks.map(chunk => createUrlFromPage(page.url, page.title, chunk)));
    } else {
        let combinedTokens = tokens;
        let combinedChunks = [content];

        while (i + 1 < pages.length) {
            let nextPage = pages[i + 1];
            let nextContent = nextPage.content.join(' ');
            let nextTokens = enc.encode(nextContent).length;

            if (combinedTokens + nextTokens <= max_tokens) {
                combinedTokens += nextTokens;
                combinedChunks.push(nextContent);
                pages.splice(i + 1, 1);
            } else {
                break;
            }
        }

        result.push(createUrlFromPage(page.url, page.title, combinedChunks.join(' ')));
    }
    }
    return result;
}

function createUrlFromPage(url, title, content) {
    const urlObj = new Url(url);
    urlObj.title = title;
    urlObj.content = content;
    return urlObj;
}


/*
 * Generating the vector embeddings 
 *
 */

class VectorEmbed {
    constructor(id, metadata, embedding) {
        this.id = id,
        this.metadata = metadata,
        this.embedding = embedding
    }
}

async function generateVectorEmbedding(data) {
    const result = [];
    for ( page of data ) {
        let id = v4(); // Keep an eye on this, remote possibility of collision
        let res = await openai.createEmbedding({
            model: "text-embedding-ada-002",
            input: page.content,
        });
        let metadata = {
            text: page.content,
            url: page.url,
            title: page.title

        };
        let v = new VectorEmbed(id,metadata,res.data.data[0].embedding);
        result.push(v);
    }
    console.log(result);
    return result;
}


/*
 * Upserting embeddings
 *
 */

// Initialize connection to Pinecone

async function PineconeInit() {
    const pinecone = new PineconeClient({ 
        apiKey: pineconeApiKey, environment: pineconeEnvironment 
    });
    await pinecone.init({apiKey: pineconeApiKey, environment: pineconeEnvironment});
    //const indexes = await pinecone.listIndexes();
    return pinecone;
}


// Check if index already exists, create it if it doesn't
async function checkOrCreateIndex(pinecone) {
    index_name = "digitalai";
    const indexes = await pinecone.listIndexes();
    if (!indexes.includes(index_name)) {
        await pinecone.createIndex({
            createRequest: {
                name: index_name,
                dimension: 1536,
                metric: 'dotproduct'
            }});
    }
    let index = pinecone.Index(index_name);
    return index;
}

// Upsert embeddings into Pinecone in batches
async function upsertEmbeddings(pinecone,data,batchSize) {
    let result;
    const index = await checkOrCreateIndex(pinecone); 
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
        result = await index.upsert( {
            upsertRequest: {
                vectors: toUpsert,
                namespace: "digitalai"
        }});
        
    }
    return result;
}



module.exports = { normalizeScrapedData, generateText, chunkData, generateVectorEmbedding, upsertEmbeddings, PineconeInit };