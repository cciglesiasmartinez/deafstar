/*
 * Web Crawler/Scraper
 *
 * This file contains the implementation of a web crawler/scraper. The Crawler class is
 * responsible for crawling a website, extracting titles, paragraphs, and links, and
 * populating the content in a structured manner. The Url class represents a single URL
 * along with its title and content.
 *
 */

// Dependencies
const axios = require('axios');
const cheerio = require('cheerio');
const URLParse = require('url-parse');
const { Logger } = require('./log.js');

// Initializing logger
const logger = new Logger();

// Class for handling the crawler
class Crawler {
    constructor(url) {
        this.baseUrl = new URLParse(url);
        this.links = [url];
        this.scrapedLinks = [];
        this.content = [];
        this.headers = [
            {
            'Connection': 'keep-alive',
            'sec-ch-ua': `"Not/A)Brand";v="99", "Google Chrome";v="115", 
                "Chromium";v="115"`,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Linux"',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 
                (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36`,
            'Accept': `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,
                image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`,
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept-Language': 'es-ES,es;q=0.9'
            },
        ];
    }
    // Helper method to verify if a given link must be crawled
    isValidLink(link) {
        // Check if format is valid
        const invalidPatterns = ['#', 'tel:', 'mailto:', '.pdf', '.docx', /\.\w{3,4}$/];
        const formatValidity = !invalidPatterns.some(
            pattern => (pattern instanceof RegExp) ? pattern.test(link) : link.includes(pattern));
        // If format is valid, check if URL is part of the site
        if (formatValidity) {
            const l = new URLParse(link, this.baseUrl);
            if (( l.hostname == this.baseUrl.hostname ) 
            && ( l.pathname.startsWith(this.baseUrl.pathname) ) ) {
                return true;
            } else { return false };
        } else { return false };
    }
    // Helper method to check if a link is actually online, and skip it if not
    async checkLinkStatus(link) {
        try {
            const response = await axios.get(link, this.headers[0] );
            return response;
        } catch (err) {
            logger.error(err);
            logger.info("[CRAWLER] Proceeding to remove, then going for the next link.");
            this.links.splice(0, 1);
            return null;
        }
    }
    // Main crawling method, this actually most of the job
    async crawl() {
        try {
            logger.info("[CRAWLER] Crawling..." + this.links[0]);
            // Create an instance for the URL
            const url = new Url(this.links[0]);
            // HTTP GET request
            const response = await this.checkLinkStatus(this.links[0]);
            // Use cheerio to get the content
            const $ = cheerio.load(response.data);
            // Extract titles and paragraphs
            const title = $('title').text();
            url.title = title;
            // Get the paragraphs
            $('p').each((index, element) => {
                url.content.push($(element).text());
            });
            // Get the links available
            $('a').each((index, element) => {
                let link = $(element).attr('href');
                // First we check for link validity
                if ( link && this.isValidLink(link) ) {
			// Then, if link is relative, set it to absolute
                	if ( link.startsWith('/') ) {
                        	link = new URLParse(link, this.baseUrl).toString();
                	}
                    // Finally we check if the link it has been listed or scraped
                    if (!this.scrapedLinks.includes(link) && !this.links.includes(link)) {
                	this.links.push(link);
                        console.log('[CRAWLER] Added URL to parse: ' + link);
                    }
                }   
            });
            // Place the actual link as scraped and remove from the pending links list
            this.scrapedLinks.push(this.links[0]);
            this.links.splice(this.links[0], 1);
            // Finally put this instance in the content list
            this.content.push(url);
            // Finish message
            console.log(`[CRAWLER] URLs waiting to be scraped: ${this.links}. 
                Currently there are $ ${this.links.length} URLs waiting to be scraped.`);
            console.log("[CRAWLER] Total pages scraped: " + this.scrapedLinks.length);
        } catch (error) {
            logger.error('[CRAWLER] Error: ' + error);
        }
    }
    // Initialization method
    async start() {
        if (this.links[0]) {
            const crawlInterval = 300;
            while (this.links.length > 0) {
                await this.crawl();
                await new Promise(resolve => setTimeout(resolve, crawlInterval));
            }
            logger.info("[CRAWLER] Site fully scraped");
            return this.content;
        } else {
            throw logger.error("[CRAWLER] Error: Missing argument (initial URL)");
        }
    }
}


// Support class for URL handling in the crawler
class Url {
    constructor(url) {
        this.url = url;
        this.title = undefined;
        this.content = [];
    }
}


module.exports = { Crawler, Url };
