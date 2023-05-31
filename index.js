#!/usr/bin/env node
require("dotenv").config();
const prettier = require("prettier");
const { Configuration, OpenAIApi } = require("openai");
const { encode } = require("gpt-3-encoder");
const fs = require("fs");
const {
  sourceLanguage,
  useSourceTranslations,
  languages,
  toTranslate,
} = require(process.env.TRANSLATEGPT_JS_PATH);

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const isObject = (a) => !!a && a.constructor === Object;
const isArray = (a) => !!a && a.constructor === Array;

const formatTranslateStrings = (translateStrings) => {
  if (!isObject(translateStrings) && !isArray(translateStrings)) {
    console.log("translateStrings must either be an object or an array.");
    return null;
  }

  return Array.isArray(translateStrings)
    ? translateStrings.reduce((formattedStrings, key) => {
        formattedStrings[key] = "";
        return formattedStrings;
      }, {})
    : Object.fromEntries(Object.keys(translateStrings).map((key) => [key, ""]));
};

const buildQueries = (formattedTranslateStrings) => {
  const tokenLimit = 500;
  const queries = [];
  let buildingTokens = 0;
  let buildingQuery = {};

  const getTokenCount = (str) => encode(str).length;

  Object.keys(formattedTranslateStrings).forEach((key) => {
    if (buildingTokens >= tokenLimit) {
      queries.push(JSON.stringify(buildingQuery));
      buildingTokens = 0;
      buildingQuery = {};
    }

    if (formattedTranslateStrings[key] === "") {
      buildingQuery[key] = "";
      buildingTokens += getTokenCount(key) + 4;
    }
  });

  if (Object.keys(buildingQuery).length > 0) {
    queries.push(JSON.stringify(buildingQuery));
  }

  return queries;
};

const generatePrompt = (query, language) => [
  {
    role: "user",
    content: `Please return this JSON object with the empty value strings filled in with the translation of the keys into ${language} JSON ONLY. NO DISCUSSION. DON'T ALTER THE KEYS. ALWAYS FILL IN THE EMPTY STRINGS WITH A TRANSLATION:  ${query} `,
  },
];

const sendQuery = async (query, language) => {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0301",
      messages: generatePrompt(query, language),
      temperature: 1.0,
    });
    const response = completion.data.choices[0].message.content;
    console.log("Query response: ", response);
    return response;
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
    const lastIndex = response.lastIndexOf("}");
    const firstIndex = response.lastIndexOf("{", lastIndex);
    parsedResponse = JSON.parse(response.slice(firstIndex, lastIndex + 1));
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

const addMissingSourceTranslations = (
  translateStrings,
  sourceJSON,
  outputJSON
) => {
  console.log(`Adding translations from: ${sourceLanguage[1]}`);
  const merged = { ...translateStrings };

  if (sourceJSON && outputJSON) {
    console.log("JSON from source and output found, merging.");
    Object.keys(sourceJSON).forEach((key) => {
      if (!outputJSON[key]) {
        merged[key] = "";
      }
    });
  } else if (sourceJSON && !outputJSON) {
    console.log("Output file/JSON not found, adding all source translations.");
    Object.keys(sourceJSON).forEach((key) => {
      merged[key] = "";
    });
  }

  return merged;
};

async function translate(toTranslate, language) {
  let buildingOutput = { ...toTranslate };
  console.log("buildOut", buildingOutput);
  let isOutputBuilt = false;

  while (!isOutputBuilt) {
    const queries = buildQueries(buildingOutput);
    console.log("Queries", queries);

    if (queries.length === 0) {
      console.log(`Finished queries`);
      isOutputBuilt = true;
      return buildingOutput;
    }

    for (let query of queries) {
      console.log("Translations are still being generated, please wait.");
      const queryResponse = await sendQuery(query, language);
      console.log("Query response: ", queryResponse);

      buildingOutput = generateAppliedResponse(queryResponse, buildingOutput);
      console.log("Building output", buildingOutput);
    }
  }

  console.log("build output", buildingOutput);
  return buildingOutput;
}

const mergeExistingTranslations = (result, outputFile) => {
  if (fs.existsSync(outputFile)) {
    const existingJsonData = fs.readFileSync(outputFile, "utf-8");

    try {
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(
        "Destination file contains translations, merging with new translations."
      );
      const mergedTranslations = { ...parsedExistingData, ...result };
      console.log("Merged translations: ", mergedTranslations);
      return mergedTranslations;
    } catch {
      console.log("Destination file currently empty.");
      return result;
    }
  } else {
    console.log("The file does not exist.");
    return result;
  }
};

const getFileJSON = (filePath) => {
  if (fs.existsSync(filePath)) {
    console.log(`File found: ${filePath}`);
    try {
      const existingJsonData = fs.readFileSync(filePath, "utf-8");
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(`File JSON parsed successfully.`);
      return parsedExistingData;
    } catch {
      console.log(`Could not parse file JSON`);
    }
  } else {
    console.log("The file does not exist.");
    return null;
  }
};

if (!configuration.apiKey) {
  console.log(
    "OpenAI API key not configured, please follow instructions in README.md"
  );
  return;
}

toTranslate.forEach(([translateStrings, translateNamespace]) => {
  console.log("toTrans", translateStrings);
  languages.forEach(async ([languageDescription, languageAbbreviation]) => {
    const outputDirectory = `${process.env.TRANSLATEGPT_OUTPUT_DIRECTORY}/${translateNamespace}`;
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory);
      console.log("Folder created: ", outputDirectory);
    }
    console.log(`Output directory set to: `, outputDirectory);

    const sourceLanguageFile = `${outputDirectory}/${translateNamespace}.${sourceLanguage.replace(
      /\s/g,
      "_"
    )}.json`;
    console.log(`Source language file set to: `, sourceLanguageFile);
    const sourceJSON = getFileJSON(sourceLanguageFile);
    console.log(`Source JSON set to: `, sourceJSON);

    const outputFile = `${outputDirectory}/${translateNamespace}.${languageAbbreviation.replace(
      /\s/g,
      "_"
    )}.json`;
    console.log(`Output file set to: `, outputFile);
    const outputJSON = getFileJSON(outputFile);
    console.log(`Output JSON set to: `, outputJSON);

    console.log("translateStrings before data parsing: ", translateStrings);

    let formattedTranslateStrings = formatTranslateStrings(translateStrings);

    if (useSourceTranslations) {
      formattedTranslateStrings = addMissingSourceTranslations(
        formattedTranslateStrings,
        sourceJSON,
        outputJSON
      );
    }

    console.log(
      "translateStrings after data parsing: ",
      formattedTranslateStrings
    );

    let result = await translate(
      formattedTranslateStrings,
      languageDescription
    );
    console.log("result", result);

    result = mergeExistingTranslations(result, outputFile);

    console.log(
      `Attempting to write file. Path: ${outputFile} | Result: ${JSON.stringify(
        result
      )}`
    );

    fs.writeFile(
      outputFile,
      prettier.format(JSON.stringify(result), { parser: "json" }),
      (err) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log("File written successfully: ", outputFile);
      }
    );
  });
});
