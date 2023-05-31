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
  // Turn source into JSON object with blank values
  const formattedTranslateStrings = {};

  if (isObject(translateStrings)) {
    Object.keys(translateStrings).forEach((key) => {
      formattedTranslateStrings[key] = "";
    });
  } else if (isArray(translateStrings)) {
    translateStrings.forEach((key) => {
      formattedTranslateStrings[key] = "";
    });
  } else {
    console.log("translateStrings must either be an object or an array.");
    return null;
  }

  return formattedTranslateStrings;
};

const buildQueries = (formattedTranslateStrings) => {
  const tokenLimit = 500;
  const queries = [];
  let buildingTokens = 0;
  let buildingQuery = {};

  const getTokenCount = (str) => {
    return encode(str).length;
  };

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

const addMissingSourceTranslations = (
  translateStrings,
  sourceJSON,
  outputJSON
) => {
  console.log(`Adding translations from: ${sourceLanguage[1]}`);
  let merged = translateStrings;

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
  // While loop on object that builds queries out of blank values
  //   and token based splits them
  let buildingOutput = toTranslate;

  console.log("buildOut", buildingOutput);
  let isOutputBuilt = false;

  while (!isOutputBuilt) {
    const queries = buildQueries(buildingOutput);
    console.log("Queries", queries);

    if (JSON.stringify(queries) === `["{}"]`) {
      console.log(`Finished queries`);
      isOutputBuilt = true;
      return buildingOutput;
    }

    for (let query in queries) {
      console.log("Translations are still being generated, please wait.");
      const queryResponse = await sendQuery(queries[query], language);
      console.log("Query response: ", queryResponse);

      buildingOutput = generateAppliedResponse(queryResponse, buildingOutput);
      console.log("Building output", buildingOutput);
    }
  }

  console.log("build output", buildingOutput);
}

const mergeExistingTranslations = (result, outputFile) => {
  if (fs.existsSync(outputFile)) {
    const existingJsonData = fs.readFileSync(outputFile, "utf-8");

    try {
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(
        "Destination file contains translations, merging with new translations."
      );
      let mergedTranslations = parsedExistingData;
      for (let key in result) {
        mergedTranslations[key] = result[key];
      }
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

toTranslate.forEach((toTrans) => {
  console.log("toTrans", toTrans);
  let translateStrings = toTrans[0];
  const translateNamespace = toTrans[1];
  languages.forEach((language) => {
    (async () => {
      const languageDescription = language[0];
      const languageAbbreviation = language[1];
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
    })();
  });
});
