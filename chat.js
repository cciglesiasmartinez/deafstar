/*
 * Chatbot Stuff
 *
 */

require('dotenv').config()
const tiktoken = require('tiktoken-node');
const { Configuration, OpenAIApi } = require('openai');
const { PineconeClient } = require('@pinecone-database/pinecone');
const { Crawler, Url } = require('./crawler.js');
const { v4 } = require('uuid');

const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeEnvironment = process.env.PINECONE_ENV;
const openAiApiKey = process.env.OPENAI_API_KEY;
const conf = new Configuration({apiKey: openAiApiKey});
const openai = new OpenAIApi(conf);

console.log("[CHAT] OpenAI API key: " + openAiApiKey);
console.log("[CHAT] Pinecone API key; " + pineconeApiKey);


/*
 * Class for chatbot stuff
 *
 */

class VectorEmbed {
    constructor(id, metadata, embedding) {
        this.id = id,
        this.metadata = metadata,
        this.embedding = embedding
    }
}

class ChatBot {
    constructor() {
        this.chatId = v4();
        this.namespace = 'digitalai';
        this.url = undefined;
        this.vectors = [];
        this.indexName = 'digitalai';
        this.index = undefined;
    }
    // Init the scraping
    async initialize(url, user) {
        // Create Crawler instance and init the crawling process
        const crawler = new Crawler(url);
        let urlData = await crawler.start();
        // Set the url for this chatbot instance
        this.url = url;
        // Normalize the data
        urlData = await this.normalizeCrawledData(urlData);
        // Chunk the data 
        urlData = await this.chunkData(urlData,500);
        // Generate the vectors
        urlData = await this.generateVectorEmbedding(urlData);
        this.vectors = urlData;
        // Init Pinecone API and get our index
        const pinecone = await this.PineconeInit();
        this.index = pinecone;
        // Upsert the vectors into our index
        urlData = await this.upsertEmbeddings(pinecone,urlData,100);
        console.log("ARRIVING AT CRITICAL POINT!!!!");
        user.addChatBot(this);
        console.log(this);
    }
    // Normalize URL data
    async normalizeCrawledData(pages) {
        const result = [];
        // Removing line breaks and filtering empty elements
        pages.forEach((page) => {
          const filteredContent = page.content
            .map(element => element.replace(/\n/g, ''))
            .filter(element => element.trim() !== '');
            if (filteredContent.length > 0) {
                result.push({ ...page, content: filteredContent });
            }
        });
        return result;
    }
    // Chunk URL data into manageable bits 
    async chunkData(pages, max_tokens) {
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
                result.push(...chunks.map(chunk => this.createUrlFromPage(page.url, page.title, chunk)));
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
                result.push(this.createUrlFromPage(page.url, page.title, combinedChunks.join(' ')));
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
        console.log(data);
        const result = [];
        for ( let page of data ) {
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
    // Initialize Pinecone
    async PineconeInit() {
        const pinecone = new PineconeClient({ 
            apiKey: pineconeApiKey, environment: pineconeEnvironment 
        });
        await pinecone.init({apiKey: pineconeApiKey, environment: pineconeEnvironment});
        return pinecone;
    }
    // Check if index already exists, create it if it doesn't
    async checkOrCreateIndex(pinecone) {
        const indexes = await pinecone.listIndexes();
        if (!indexes.includes(this.indexName)) {
            await pinecone.createIndex({
                createRequest: {
                    name: this.indexName,
                    dimension: 1536,
                    metric: 'dotproduct'
                }});
        }
        const index = pinecone.Index(this.indexName);
        return index;
    }
    // Upsert embeddings into Pinecone in batches
    async upsertEmbeddings(pinecone,data,batchSize) {
        console.log("Upserting process");
        let result;
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
            result = await index.upsert( {
                upsertRequest: {
                    vectors: toUpsert,
                    namespace: this.namespace
            }});
        }
        console.log(result);
        return result;
    }
    // Generate prompt and answer
    async generateText(prompt,user) {
        console.log("GENERATE TEXT PETITION REC, USER IS " + user);
        const res = await openai.createEmbedding({
            input: prompt,
            model: "text-embedding-ada-002"
        });
        console.log(res.data.data[0].embedding);
        const embed = res.data.data[0].embedding;
        //const pinecone = await PineconeInit();
        //const index = await checkOrCreateIndex(pinecone);
        //const index = this.index;
        //console.log(this.index);
        const index = await this.checkOrCreateIndex(this.index);
        const related = await index.query({queryRequest:{
            topK: 2,
            vector: embed,
            namespace: this.namespace,
            includeMetadata: true,
        }});
        //console.log(related.matches[0,1].metadata);
        console.log('Answer this question: ' + prompt + '. With this context: ' 
            + related.matches[0].metadata.text + ' ' + related.matches[1].metadata.text);
        //console.log("[CHAT] Generating text for prompt...");
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: 'Answer this question: ' + prompt + '. With this context: ' 
            + related.matches[0].metadata.text + ' ' + related.matches[1].metadata.text,
            max_tokens: 300,
        });
        console.log(prompt);
        const text = response.data.choices[0].text.replace(/\n/g,"");
        return text;
    }
}

// Demonstration without enhanced functionality (delete later)
async function generateText(prompt) {
    const response = await openai.createCompletion({
        model: 'text-davinci-003',
        prompt:  prompt,
        max_tokens: 300,
    });
    console.log("BASIC GENERATION: " + prompt);
    const text = response.data.choices[0].text.replace(/\n/g,"");
    return text;
}

module.exports = {
    generateText,
    ChatBot,
};