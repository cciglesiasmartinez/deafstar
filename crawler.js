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
const { Logger } = require('./log.js');

const CAUTIOUS = false;

const headers = {
    'Connection': 'keep-alive',
    'sec-ch-ua': '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Linux"',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept-Language': 'es-ES,es;q=0.9'
};

// Initializing logger
const logger = new Logger();

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
    async checkLinkStatus(link) {
        try {
            const response = await axios.get(link, {headers});
            //console.log(response.data);
            return response;
        } catch (err) {
            console.log("Got error: " + err);
            console.log("Proceeding to remove, then going for the next link.");
            this.links.splice(0, 1);
            return null;
        }
    }
    async crawl() {
        try {
            logger.info("[CRAWLER] Crawling..." + this.links[0]);
            // Create an instance for the URL
            const url = new Url(this.links[0]);
            // HTTP GET request
            const response = await this.checkLinkStatus(this.links[0]);
            // Use cheerio to get the content
            const $ = cheerio.load(response.data);
            // Get the links available
            const links = [];
            $('a').each((index, element) => {
                const href = $(element).attr('href');
                links.push(href);
            });
            // Select only the links that point to the target site
            const filteredUrls = links.filter((link) => {
                // Ignore if empty or if #
                if (!link || link.includes('#') || link.startsWith('tel:') || link.includes('mailto:') || link.includes('.pdf') || link.includes('.docx')) {
                    return false;
                }
                // Verify if link points to target site or is a relative path
                const parsedLink = new URLParse(link);
                return parsedLink.hostname === new URL(this.links[0]).hostname || !parsedLink.hostname;
            });
            // If url is not listed and has not been scraped, add to the list
            filteredUrls.forEach((url) => {
                if (!this.scrapedLinks.includes(url) && !this.links.includes(url)) {
                    if (!url.includes("http")) {
                        // If it's a relative path, append the hostname to make it an absolute URL
                        const currentURL = new URL(this.links[0]);
                        const absoluteURL = currentURL.protocol + "//" + currentURL.hostname + (currentURL.port ? ":" + currentURL.port : "") + url;
                        if (!this.scrapedLinks.includes(absoluteURL) && !this.links.includes(absoluteURL)) {
                            this.links.push(absoluteURL);
                            console.log('[CRAWLER] Added URL to parse:' + absoluteURL);
                        }
                    } else {
                        // If it's already an absolute URL, simply add it to the list
                        this.links.push(url);
                        console.log('[CRAWLER] Added URL to parse:' + url);
                    }
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
            // Updating instance
            this.scrapedLinks.push(this.links[0]);
            this.content.push(url);
            this.links.splice(this.links[0], 1);
            // Finish message
            console.log("[CRAWLER] URLs waiting to be scraped: " + this.links + ". Currently there are " + this.links.length + " URLs waiting to be scraped.");
            console.log("Total pages scraped: " + this.scrapedLinks.length);
        } catch (error) {
            logger.error('[CRAWLER] Error: ' + error);
        }
    }

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

module.exports = { Crawler, Url };