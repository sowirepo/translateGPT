// TODO
// return languages correctly
// accept a list of languages
// TODO Tokens are 2x as needed because we're not filling in the vlaues thi way, determine if we should?'

require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const input = require("./test_translations.json");
const { encode } = require("gpt-3-encoder");
const fs = require("fs");

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

// TODO Json smart restructure
// Get source data

// While loop on object that builds queries out of blank values
//   and token based splits them
async function translate(input, language) {
  if (!configuration.apiKey) {
    console.log(
      "OpenAI API key not configured, please follow instructions in README.md"
    );
    return;
  }

  if (!input) {
    console.log("Input translations not received.");
    return;
  }

  // Turn source into JSON object with blank values
  const formatInput = (input) => {
    const formattedInput = {};

    if (isObject(input)) {
      Object.keys(input).forEach((key) => {
        formattedInput[key] = "";
      });
    } else if (isArray(input)) {
      input.forEach((key) => {
        formattedInput[key] = "";
      });
    } else {
      console.log("Input must either be an object or an array.");
      return null;
    }

    return formattedInput;
  };

  const buildQueries = (formattedInput) => {
    const tokenLimit = 1000;
    const queries = [];
    let buildingTokens = 0;
    let buildingQuery = {};

    const getTokenCount = (str) => {
      return encode(str).length;
    };

    Object.keys(formattedInput).forEach((key) => {
      if (buildingTokens >= tokenLimit) {
        queries.push(JSON.stringify(buildingQuery));
        buildingTokens = 0;
        buildingQuery = {};
      }

      if (formattedInput[key] === "") {
        buildingQuery[key] = "";
        buildingTokens += getTokenCount(key) * 2 + 4; // TODO fix this
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

  let buildingOutput = formatInput(input);
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
// Try function on result from api to place the values into source json
// once while loop completes, return filled JSON
const languages = ["informal dutch", "emoji", "backwards english"];

languages.forEach((language) => {
  (async () => {
    const result = await translate(input, language);

    fs.writeFile(
      `./output.${language.replace(/\s/g, "_")}.json`,
      JSON.stringify(result),
      (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("file written successfully");
      }
    );
  })();
});

module.exports = {
  translate: translate,
};
