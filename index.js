import dotenv from "dotenv";
import express from "express";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
const API_KEY = dotenv.config().parsed.API_KEY;
const app = express();

const getUrlDocument = (url) => {
  return new Promise((resolve) => {
    axios({
      url,
    }).then((res) => {
      resolve(res.data);
    });
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

//  words length   tokens
//         19543     4247   4.6
//         34648     7436   4.659

async function getChatGPTResult(url) {
  const text = await getUrlDocument(url);
  const doc = new JSDOM(text, {
    url,
    contentType: "text/html",
    includeNodeLocations: true,
    storageQuota: 10000000,
  });
  const dom = doc.window.document;
  const article = new Readability(dom).parse();
  const textContent = article.textContent;
  if (textContent.length / 4.65 > 4096) {
    return Promise.reject({
      response: {
        data: {
          error: {
            message: `Custom: This model's maximum context length is 4097 tokens. However, your messages resulted in ${
              textContent.length / 4.65
            } tokens. Please reduce the length of the messages.`,
          },
        },
      },
    });
  }
  const chatGPTText = await sendMessageToChatGPT(
    `Please summarize this article in chinese. \n ${textContent}`
  ).catch((err) => {
    return Promise.reject(err);
  });
  return chatGPTText;
}

app.get("/url", async (req, res) => {
  const { url } = req.query;
  console.log("url", url);
  try {
    const chatGPText = await getChatGPTResult(url).catch((err) => {
      res.send({ err: err.response.data.error.message });
      return;
    });
    res.send({ data: chatGPText });
  } catch (error) {
    console.log("error", JSON.stringify(error));
  }
});

app.listen("8001", () => {
  console.log(`Example app listening on port 8001`);
});
