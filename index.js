import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
const API_KEY = dotenv.config().parsed.API_KEY;
const app = express();

const getUrlDocument = (url) => {
  return new Promise((resolve, reject) => {
    axios({
      url,
    }).then((res) => {
      resolve(res.data);
    }).catch(err => {
      reject(err)
    })
  });
};

const message2Messages = (message) => {
  return [{ role: "user", content: message }];
};

const sendMessageToChatGPT = async (message) => {
  const messages = message2Messages(message);
  return axios({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    method: "POST",
    data: {
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.6,
    },
  }).then((res) => {
    return res.data.choices[0].message.content;
  });
};

function getErrorBody(message, code = '000') {
  return {
    response: {
      data: {
        error: {
          code,
          message,
        },
      },
    },
  };
}

//  words length   tokens
//         19543     4247   4.6
//         34648     7436   4.659

async function getChatGPTResult(textContent) {
  const chatGPTText = await sendMessageToChatGPT(
    `请用中文总结这篇文章 \n------\n${textContent}`
  ).catch((err) => {
    return Promise.reject(getErrorBody(JSON.stringify(err)));
  });
  return chatGPTText;
}

async function getWebsiteTextContent(url) {
  let text = "";
  try {
    text = await getUrlDocument(url);
  } catch (error) {
    return Promise.reject(getErrorBody(JSON.stringify(error)));
  }
  const doc = new JSDOM(text, {
    url,
    contentType: "text/html",
    includeNodeLocations: true,
    storageQuota: 10000000,
  });
  const dom = doc.window.document;
  const article = new Readability(dom).parse();
  const textContent = article.textContent.substring(0, 19000).trim()
  if (textContent.length === 0) {
    return Promise.reject(
      getErrorBody(
        `未找到网页中的文本`, '002'
      )
    );
  }
  return textContent
}

app.get('/url/score', async (req, res) => {
  const { url } = req.query;
  try {
    const textContent = await getWebsiteTextContent(url).catch((err) => {
      return res.send({ err: err.response.data.error });
    });
    const chatGPText = await getChatGPTResult(textContent).catch((err) => {
      return res.send({ err: err.response.data.error });
    });
    res.send({ data: chatGPText });
  } catch (error) {
    console.log("error", JSON.stringify(error));
  }
})

app.get("/url", async (req, res) => {
  const { url } = req.query;
  console.log("url", url);
  try {
    const textContent = await getWebsiteTextContent(url).catch((err) => {
      return res.send({ err: err.response.data.error });
    });
    const chatGPText = await getChatGPTResult(textContent).catch((err) => {
      return res.send({ err: err.response.data.error });
    });
    res.send({ data: chatGPText });
  } catch (error) {
    console.log("error", JSON.stringify(error));
  }
});

app.listen("8001", () => {
  console.log(`Example app listening on port 8001`);
});
