import { Scraper, SearchMode } from "agent-twitter-client";
import { writeFile } from "fs/promises";

const scraper = new Scraper();
await scraper.login(
  process.env.TWITTER_USERNAME!,
  process.env.TWITTER_PASSWORD!
);

const cookies = await scraper.getCookies();

// Set current session cookies
await scraper.setCookies(cookies);

const isLoggedIn = await scraper.isLoggedIn();

console.log(isLoggedIn);

if (!isLoggedIn) {
  throw new Error("Failed to login");
}

const username = "Agent_YP";

const tweetIterator = scraper.getTweetsAndReplies(username, 200);

// Collect only the `text` field of each tweet
const tweetTexts: string[] = [];

for await (const tweet of tweetIterator) {
  if (tweet.text) {
    tweetTexts.push(tweet.text);
    console.log(tweet.text);
  }
}

// Write all collected tweets to a JSON file
const filePath = `tweets-${username}.json`;
await writeFile(filePath, JSON.stringify(tweetTexts, null, 2), "utf-8");
console.log(`Saved ${tweetTexts.length} tweets to ${filePath}`);
