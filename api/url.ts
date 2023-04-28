import type { VercelRequest, VercelResponse } from "@vercel/node";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { message2Messages } from "../utils/openAI";

const CHAT_GPT_API_KEY = process.env.API_KEY || "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { url = "" } = req.query;
  if (Array.isArray(url)) {
    return res.json({ err: "url must be string" });
  }
  if (!url) {
    return res.json({ err: "url cannot be empty" });
  }
  const chatGPText = await getChatGPTResult(url).catch((err) => {
    return res.json({ err: JSON.stringify(err), params: url });
  });
  return res.json({ data: chatGPText });
}

const getUrlDocument = (url): Promise<any> => {
  return new Promise((resolve) => {
    axios({
      url,
    }).then((res: any) => {
      resolve(res.data);
    });
  });
};

const sendMessageToChatGPT = async (message) => {
  const messages = message2Messages(message);
  return axios({
    url: "https://api.openai.com/v1/chat/completions",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHAT_GPT_API_KEY}`,
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

async function getChatGPTResult(url: string) {
  try {
    const text = await getUrlDocument(url);
    const doc = new JSDOM(text, {
      url,
      contentType: "text/html",
      includeNodeLocations: true,
      storageQuota: 10000000,
    });
    const dom = doc.window.document;
    const article = new Readability(dom).parse();
    if (article) {
      const textContent = article.textContent;
      const chatGPTText = await sendMessageToChatGPT(
        `Please summarize this article in chinese. \n ` + textContent
      );
      return chatGPTText;
    }
    return Promise.reject(new Error("article is null"));
  } catch (error) {
    return Promise.reject(new Error(error));
  }
}
