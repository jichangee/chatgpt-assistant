import axios from "axios";
import dotenv from "dotenv";
import { LocalStorage } from "node-localstorage";
const { TG_BOT_TOKEN, TG_CHAT_ID } = dotenv.config().parsed;
const MIN_SCORE = 180
const MAX_LIST_LENGTH = 20
const ONCE_SLEEP_SECOND = 0

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
function summarizeTitleInChinese(url) {
  return axios.get(`http://127.0.0.1:8001/title/?url=${url}`);
}

async function getTopStoreList(topNum = 30) {
  let storeList = [];
  const res = await getTopStoriesIdList();
  const topList = res.data.slice(0, topNum).filter(id => !idsHistory.includes(id))
  console.log(`找到${topList.length}个Id`, topList);
  for (const id of topList) {
    const res = await getStoreDetail(id).catch(err => {
      console.log('hacknews detail error', err);
    });
    try {
      const data = res.data;
      if (data.score >= MIN_SCORE) {
        idsHistory.push(data.id);
        storeList.push(data);
      }
    } catch (error) { }
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

function dealUnknownError(id) {
  idsHistory = idsHistory.filter(item => item !== id)
}

function start() {
  getTopStoreList(MAX_LIST_LENGTH).then(async (storeList) => {
    console.log(`找到${storeList.length}篇新文章`);
    let limitCount = 0;
    for (const store of storeList) {
      const url = store.url;
      const id = store.id;
      if (url && url.indexOf('twitter.com') > -1) {
        sendMessageByTG(`${url}\nComments: https://news.ycombinator.com/item?id=${id}\nScore: ${store.score}`);
      } else if (url) {
        const res = await summarizeTitleInChinese(url).catch(() => {
          dealUnknownError(id)
        });
        const data = res.data
        if (data.err) {
          if (data.err.code === '001') {
            // 文章字数超过限制，只发送url
            sendMessageByTG(`${url}\nComments: https://news.ycombinator.com/item?id=${id}`);
          } else if (data.err.code === '002') {
            // 未找到网页中的文本，只发送url
            sendMessageByTG(`${url}\nComments: https://news.ycombinator.com/item?id=${id}`);
          } else {
            // 未知错误，先不记录
            dealUnknownError(id)
          }
          console.error("err", `${JSON.stringify(data)}\n\n\n`);
        } else {
          const text = data.data.replace('标题建议：', '').replace('标题：', '')
          sendMessageByTG(`${text}\n\nLink: ${url}\nComments: https://news.ycombinator.com/item?id=${id}\nScore: ${store.score}`);
        }
        limitCount += 1;
        if (limitCount >= 3) {
          console.log(`sleep ${limitCount * ONCE_SLEEP_SECOND}s...`);
          // Limit: 3 / min
          await sleep(limitCount * ONCE_SLEEP_SECOND);
          limitCount = 0;
        }
      }
    }
    localStorage.setItem("ids-history", JSON.stringify(idsHistory.slice(storeList.length)));
  });
}

start()

setInterval(start, 60 * 60 * 1000);