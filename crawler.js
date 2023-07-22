/*
 * Code for the web crawler/scraper
 * 
 * IMPORTANT NOTE: This is a very dirty and minimalistic crawler, so time constraints 
 * and some other tactics would be needed in order to bypass scraping countermeasures 
 * applied by some hosting vendors. 
 *
 */


const axios = require('axios');
const cheerio = require('cheerio');
const URLParse = require('url-parse');

class Url {
    constructor(url) {
        this.url = url;
        this.title = undefined;
        this.content = [];
    }
}

class Crawler {
    constructor(url) {
        this.links = [url];
        this.scrapedLinks = [];
        this.content = [];
    }
    async crawl() {
        try {
            console.log("[CRAWLER] Crawling...", this.links[0]);
            // HTTP GET request 
            const response = await axios.get(this.links[0]);
            const url = new Url(this.links[0]);
        
            // Use cheerio to get the content
            const $ = cheerio.load(response.data);
        
            // Get the links available
            const links = [];
            $('a').each((index,element) => {
                const href = $(element).attr('href');
                links.push(href);
            });

            // Select only the links that point to the target site
            const filteredUrls = links.filter((link) => {
                // Ignore if empty or if #
                if (!link || link.startsWith('#')) {
                    return false;
                }
                // Verify if link points to target site
                const parsedLink = new URLParse(link);
                return parsedLink.hostname === new URL(this.links[0]).hostname;
            });
        
            // If url its not listed and not has been scraped, add to the list
            filteredUrls.forEach((url) => {
              if (!this.scrapedLinks.includes(url) && !this.links.includes(url)) {
                this.links.push(url);
                console.log('[CRAWLER] Added URL to parse:', url);
              }
            });
      
            // Extract titles and paragraphs
            const title = $('title').text();
            url.title = title;
            const paragraphs = [];
                $('p').each((index, element) => {
                paragraphs.push($(element).text());
                url.content.push($(element).text());
            });
      
            // Print results
            /*
            console.log('[CRAWLER] Title:', title);
            console.log('[CRAWLER] Paragraphs:');
            paragraphs.forEach((paragraph, index) => {
                console.log(`[CRAWLER] - Paragraph ${index + 1}: ${paragraph}`);
            });
            */

            // 
            this.scrapedLinks.push(this.links[0]);
            this.content.push(url);
            this.links.splice(this.links[0],1);
            
            // Finish message
            console.log("[CRAWLER] URLs waiting to be scraped: ", this.links);
        } catch (error) {
            console.error('[CRAWLER] Error: ', error);
        }
    }
    async start() {
        if (this.links[0]) {
            while (this.links.length > 0 ) {
                await this.crawl();
            }
            console.log("[CRAWLER] Site fully scraped");
            return this.content;
        } else { throw console.log("[CRAWLER] Error: Missing argument (initial URL)");} 
    }
}

module.exports = { Crawler, Url };