import axios from "axios";
import dotenv from "dotenv";
import { LocalStorage } from "node-localstorage";
const { TG_BOT_TOKEN, TG_CHAT_ID } = dotenv.config().parsed;

const localStorage = new LocalStorage("./scratch");

let idsHistory = [];
try {
  idsHistory = JSON.parse(localStorage.getItem("ids-history")) || [];
} catch (error) {}

const TOP_STORIES_API = `https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty`;

function getTopStoriesIdList() {
  return axios.get(TOP_STORIES_API);
}

function getStoreDetail(id) {
  return axios.get(
    `https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`
  );
}

function summarizeArticleInChinese(url) {
  return axios.get(`http://127.0.0.1:8001/url/?url=${url}`);
}

async function getTopStoreList(topNum = 10) {
  let storeList = [];
  const res = await getTopStoriesIdList();
  const topList = res.data.slice(0, topNum);
  for (const id of topList) {
    const res = await getStoreDetail(id);
    const data = res.data;
    if (data.score > 100 && !idsHistory.includes(data.id)) {
      idsHistory.push(data.id);
      storeList.push(data);
    }
  }
  return storeList;
}

function sleep(second) {
  return new Promise((resolve) => {
    setTimeout(resolve, second * 1000);
  });
}

function sendMessageByTG(text) {
  axios({
    url: `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`,
    method: "POST",
    data: {
      chat_id: TG_CHAT_ID,
      text: text,
    },
  });
}

function start() {
  getTopStoreList(30).then(async (storeList) => {
    console.log(`找到${storeList.length}篇新文章`);
    let limitCount = 0;
    for (const store of storeList) {
      const url = store.url;
      if (url.indexOf('twitter.com') > -1) {
        sendMessageByTG(url);
      } else {
        const res = await summarizeArticleInChinese(url);
        if (res.data.err) {
          if (res.data.err.code === '001') {
            // 文章字数超过限制，只发送url
            sendMessageByTG(url);
          }
          console.error("err", `${JSON.stringify(res.data)}\n\n\n`);
        } else {
          sendMessageByTG(`${res.data.data}\n\n${url}`);
          console.log("article\n", `${res.data.data}\n\n${url}\n\n\n`);
          limitCount += 1;
          if (limitCount >= 3) {
            console.log("sleep 60s...");
            // Limit: 3 / min
            await sleep(limitCount * 20);
            limitCount = 0;
          }
        }
      }
    }
    localStorage.setItem("ids-history", JSON.stringify(idsHistory));
  });
}

start()

setInterval(start, 30 * 60 * 1000);