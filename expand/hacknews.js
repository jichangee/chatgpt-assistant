import axios from 'axios'
const TOP_STORIES_API = `https://hacker-news.firebaseio.com/v0/topstories.json?print=pretty`

function getTopStoriesIdList() {
  return axios.get(TOP_STORIES_API)
}

function getStoreDetail(id) {
  return axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json?print=pretty`)
}

function summarizeArticleInChinese(url) {
  return axios.get(`http://127.0.0.1:8001/url/?url=${url}`)
}

async function getTop10StoreList() {
  let storeList = []
  const res = await getTopStoriesIdList()
  const top10List = res.data.slice(0, 10)
  for(const id of top10List) {
    const res = await getStoreDetail(id)
    const data = res.data
    if (data.score > 100) {
      storeList.push(data)
    }
  }
  return storeList
}

function sleep(second) {
  return new Promise(resolve => {
    setTimeout(resolve, second * 1000);
  })
}

getTop10StoreList().then(async storeList => {
  let limitCount = 0
  for (const store of storeList) {
    const url = store.url
    const res = await summarizeArticleInChinese(url)
    if (res.data.err) {
      console.error('err', `${JSON.stringify(res.data)}\n\n\n`);
    } else {
      console.log('article\n', `${res.data.data}\n\n${url}\n\n\n`);
      limitCount += 1
      if (limitCount >= 3) {
        console.log('sleep 60s...');
        // Limit: 3 / min
        await sleep(limitCount * 20)
        limitCount = 0
      }
    }
  }
})