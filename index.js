#!/usr/bin/env node
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const { encode } = require("gpt-3-encoder");
const fs = require("fs");
const { languages, toTranslate } = require(process.env.TRANSLATEGPT_JS_PATH);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const isObject = function (a) {
  return !!a && a.constructor === Object;
};

const isArray = function (a) {
  return !!a && a.constructor === Array;
};

// While loop on object that builds queries out of blank values
//   and token based splits them
async function translate(toTranslate, language) {
  if (!configuration.apiKey) {
    console.log(
      "OpenAI API key not configured, please follow instructions in README.md"
    );
    return;
  }

  if (!toTranslate) {
    console.log("toTranslate translations not received.");
    return;
  }

  // Turn source into JSON object with blank values
  const formatToTranslate = (toTranslate) => {
    const formattedToTranslate = {};

    if (isObject(toTranslate)) {
      Object.keys(toTranslate).forEach((key) => {
        formattedToTranslate[key] = "";
      });
    } else if (isArray(toTranslate)) {
      toTranslate.forEach((key) => {
        formattedToTranslate[key] = "";
      });
    } else {
      console.log("toTranslate must either be an object or an array.");
      return null;
    }

    return formattedToTranslate;
  };

  const buildQueries = (formattedToTranslate) => {
    const tokenLimit = 500;
    const queries = [];
    let buildingTokens = 0;
    let buildingQuery = {};

    const getTokenCount = (str) => {
      return encode(str).length;
    };

    Object.keys(formattedToTranslate).forEach((key) => {
      if (buildingTokens >= tokenLimit) {
        queries.push(JSON.stringify(buildingQuery));
        buildingTokens = 0;
        buildingQuery = {};
      }

      if (formattedToTranslate[key] === "") {
        buildingQuery[key] = "";
        buildingTokens += getTokenCount(key) + 4;
      }
    });

    if (buildingQuery) {
      queries.push(JSON.stringify(buildingQuery));
    }

    return queries;
  };

  const generatePrompt = (query, language) => {
    return [
      {
        role: "user",
        content: `Please return this JSON object with the empty value strings filled in with the translation of the keys into ${language} JSON ONLY. NO DISCUSSION. DON'T ALTER THE KEYS. ALWAYS FILL IN THE EMPTY STRINGS WITH A TRANSLATION:  ${query} `,
      },
    ];
  };

  const sendQuery = async (query, language) => {
    try {
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo-0301",
        messages: generatePrompt(query, language),
        temperature: 1.0,
      });
      console.log("Query response: ", completion.data.choices[0]);
      return completion.data.choices[0].message.content;
    } catch (error) {
      if (error.response) {
        console.error(error.response.status, error.response.data);
      } else {
        console.error(`Error with OpenAI API request: ${error.message}`);
      }
    }
  };

  const generateAppliedResponse = (response, buildingOutput) => {
    let appliedResponse = buildingOutput;
    let parsedResponse;

    try {
      let lastIndex = response.lastIndexOf("}"); // Attempt to remove non json fluff.
      let firstIndex = response.lastIndexOf("{", lastIndex);
      parsedResponse = response.slice(firstIndex, lastIndex + 1);

      parsedResponse = JSON.parse(parsedResponse);
      console.log("Parsed response: ", parsedResponse);
    } catch {
      console.log(`Response parse error, retrying. Response: ${response}`);
      return buildingOutput;
    }

    Object.keys(parsedResponse).forEach((key) => {
      if (appliedResponse[key] === "") {
        appliedResponse[key] = parsedResponse[key];
      }
    });
    return appliedResponse;
  };

  let buildingOutput = formatToTranslate(toTranslate);
  console.log("buildOut", buildingOutput);
  let isOutputBuilt = false;

  while (!isOutputBuilt) {
    const queries = buildQueries(buildingOutput);
    console.log("Queries", queries);

    for (let query in queries) {
      const queryResponse = await sendQuery(queries[query], language); // Todo pass language
      console.log("Query response: ", queryResponse);

      buildingOutput = generateAppliedResponse(queryResponse, buildingOutput);
      console.log("Building output", buildingOutput);
    }

    if (JSON.stringify(queries) === `["{}"]`) {
      console.log(`Finished queries`);
      isOutputBuilt = true;
    }
  }

  console.log("build output", buildingOutput);
  return buildingOutput;
}

toTranslate.forEach((toTrans) => {
  console.log("toTrans", toTrans);
  languages.forEach((language) => {
    (async () => {
      const result = await translate(toTrans[0], language[0]);
      const outputDirectory = `${process.env.TRANSLATEGPT_OUTPUT_DIRECTORY}/${toTrans[1]}`;
      console.log(`Output directory set to: `, outputDirectory);
      const outputFile = `${outputDirectory}/${
        toTrans[1]
      }.${language[1].replace(/\s/g, "_")}.json`;
      console.log(`Output file set to: `, outputFile);

      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory);
        console.log("Folder created: ", outputDirectory);
      }

      fs.writeFile(outputFile, JSON.stringify(result), (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("File written successfully: ", outputFile);
      });
    })();
  });
});
