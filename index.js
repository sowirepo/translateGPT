#!/usr/bin/env node
import dotenv from "dotenv";
import prettier from "prettier";
import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";
import fs from "fs";
import chalk from "chalk";

dotenv.config();

import(process.env.TRANSLATEGPT_JS_PATH)
  .then((module) => {
    const { config: config } = module;

    console.log(chalk.cyan("config: "), JSON.stringify(config));
    init(config);
  })
  .catch((error) => {
    console.error(chalk.red("Error importing module:"), error);
  });

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const isObject = (a) => !!a && a.constructor === Object;
const isArray = (a) => !!a && a.constructor === Array;

const formatTranslateStrings = (translateStrings) => {
  if (!isObject(translateStrings) && !isArray(translateStrings)) {
    console.log(
      chalk.red("translateStrings must either be an object or an array.")
    );
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

const generatePrompt = (query, language) => {
  const prompt = [
    {
      role: "user",
      content: `This JSON is used in a platform implementing i18n, return it with the empty value strings filled in with the translation of the keys into ${language}. Values in {{}} are used for interpolation, so they should be placed correctly but anything inside {{}} should be not be translated. JSON ONLY. NO DISCUSSION. DON'T ALTER THE KEYS. ALWAYS FILL IN THE EMPTY STRINGS WITH A TRANSLATION:  ${query} `,
    },
  ];

  console.log(chalk.blue("Prompt: "), prompt);

  return prompt;
};

const sendQuery = async (query, language) => {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo-0301",
      messages: generatePrompt(query, language),
      temperature: 1.0,
    });
    const response = completion.data.choices[0].message.content;
    console.log(chalk.blue("Query response: "), response);
    return response;
  } catch (error) {
    if (error.response) {
      console.error(
        chalk.red(error.response.status, JSON.stringify(error.response.data))
      );
    } else {
      console.error(
        chalk.red(`Error with OpenAI API request: ${error.message}`)
      );
    }
  }
};

const generateAppliedResponse = (response, buildingOutput) => {
  let appliedResponse = buildingOutput;
  let parsedResponse;

  try {
    const firstIndex = response.indexOf("{");
    const lastIndex = response.lastIndexOf("}");
    parsedResponse = JSON.parse(response.slice(firstIndex, lastIndex + 1));
    console.log(chalk.blue("Parsed response: "), parsedResponse);
  } catch {
    console.log(
      chalk.yellow(`Response parse error, retrying. Response: ${response}`)
    );
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
  outputJSON,
  sourceLanguage
) => {
  console.log(chalk.cyan(`Adding translations from: ${sourceLanguage}`));
  const merged = { ...translateStrings };

  if (sourceJSON && outputJSON) {
    console.log(chalk.cyan("JSON from source and output found, merging."));
    Object.keys(sourceJSON).forEach((key) => {
      if (!outputJSON[key]) {
        merged[key] = "";
      }
    });
  } else if (sourceJSON && !outputJSON) {
    console.log(
      chalk.cyan("Output file/JSON not found, adding all source translations.")
    );
    Object.keys(sourceJSON).forEach((key) => {
      merged[key] = "";
    });
  }

  return merged;
};

async function translate(toTranslate, language) {
  let buildingOutput = { ...toTranslate };
  console.log(chalk.green("buildOut"), buildingOutput);
  let isOutputBuilt = false;

  while (!isOutputBuilt) {
    const queries = buildQueries(buildingOutput);
    console.log(chalk.green("Queries"), queries);

    if (queries.length === 0) {
      console.log(chalk.magenta(`Finished queries`));
      isOutputBuilt = true;
      return buildingOutput;
    }

    for (let query of queries) {
      console.log(
        chalk.yellow("Translations are still being generated, please wait.")
      );
      const queryResponse = await sendQuery(query, language);
      console.log(chalk.blue("Query response: "), queryResponse);

      if (isValidInterpolations(query, queryResponse)) {
        buildingOutput = generateAppliedResponse(queryResponse, buildingOutput);
      }

      console.log(chalk.green("Building output"), buildingOutput);
    }
  }

  console.log(chalk.green("build output"), buildingOutput);
  return buildingOutput;
}

const getInterpolations = (str) => {
  const regex = /{{([^}]+)}}/g;

  return (str.match(regex) || []).reduce((obj, match) => {
    const key = match.replace(/{{|}}/g, "");
    obj[key] = true;
    return obj;
  }, {});
};

const isValidInterpolations = (query, queryResponse) => {
  const validInterpolations = getInterpolations(query);
  const responseInterpolations = getInterpolations(queryResponse);

  const validKeys = Object.keys(validInterpolations);

  for (const key of validKeys) {
    if (!responseInterpolations[key]) {
      return false;
    }
  }

  return validKeys.length === Object.keys(responseInterpolations).length;
};

const mergeExistingTranslations = (result, outputFile) => {
  if (fs.existsSync(outputFile)) {
    const existingJsonData = fs.readFileSync(outputFile, "utf-8");

    try {
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(
        chalk.cyan(
          "Destination file contains translations, merging with new translations."
        )
      );
      const mergedTranslations = { ...parsedExistingData, ...result };
      console.log(chalk.blue("Merged translations: "), mergedTranslations);
      return mergedTranslations;
    } catch {
      console.log(chalk.cyan("Destination file currently empty."));
      return result;
    }
  } else {
    console.log(chalk.cyan("The file does not exist."));
    return result;
  }
};

const getFileJSON = (filePath) => {
  if (fs.existsSync(filePath)) {
    console.log(chalk.cyan(`File found: ${filePath}`));
    try {
      const existingJsonData = fs.readFileSync(filePath, "utf-8");
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(chalk.cyan(`File JSON parsed successfully.`));
      return parsedExistingData;
    } catch {
      console.log(chalk.yellow(`Could not parse file JSON`));
    }
  } else {
    console.log(chalk.cyan("The file does not exist."));
    return null;
  }
};

if (!configuration.apiKey) {
  console.log(
    chalk.red(
      "OpenAI API key not configured, please follow instructions in README.md"
    )
  );
  process.exit(1);
}

const init = (config) => {
  config.toTranslate.forEach((toTranslate) => {
    console.log(chalk.yellow("translateStrings"), toTranslate.translateStrings);

    const outputDirectory = `${process.env.TRANSLATEGPT_OUTPUT_DIRECTORY}/${toTranslate.namespace}`;
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory);
      console.log(chalk.cyan("Folder created: "), outputDirectory);
    }
    console.log(chalk.cyan(`Output directory set to: `), outputDirectory);
    config.languages.forEach(async (language) => {
      const sourceLanguageFile = `${outputDirectory}/${
        toTranslate.namespace
      }.${language.language.replace(/\s/g, "_")}.json`;
      console.log(
        chalk.cyan(`Source language file set to: `),
        sourceLanguageFile
      );
      const sourceJSON = getFileJSON(sourceLanguageFile);
      console.log(chalk.cyan(`Source JSON set to: `), sourceJSON);

      const outputFile = `${outputDirectory}/${
        toTranslate.namespace
      }.${language.abbreviation.replace(/\s/g, "_")}.json`;
      console.log(chalk.cyan(`Output file set to: `), outputFile);
      const outputJSON = getFileJSON(outputFile);
      console.log(chalk.cyan(`Output JSON set to: `), outputJSON);

      console.log(
        chalk.yellow("translateStrings before data parsing: "),
        toTranslate.translateStrings
      );

      let formattedTranslateStrings = formatTranslateStrings(
        toTranslate.translateStrings
      );

      formattedTranslateStrings = addMissingSourceTranslations(
        formattedTranslateStrings,
        sourceJSON,
        outputJSON,
        language.sourceLanguage ?? config.sourceLanguage
      );

      console.log(
        chalk.yellow("translateStrings after data parsing: "),
        formattedTranslateStrings
      );

      let result = await translate(
        formattedTranslateStrings,
        language.language
      );
      console.log(chalk.green("result"), result);

      result = mergeExistingTranslations(result, outputFile);

      console.log(
        chalk.cyan(
          `Attempting to write file. Path: ${outputFile} | Result: ${JSON.stringify(
            result
          )}`
        )
      );

      fs.writeFile(
        outputFile,
        prettier.format(JSON.stringify(result), { parser: "json" }),
        (err) => {
          if (err) {
            console.error(err);
            return;
          }
          console.log(chalk.cyan("File written successfully: "), outputFile);
        }
      );
    });
  });
};
