#!/usr/bin/env node
import dotenv from "dotenv";
import prettier from "prettier";
import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";
import fs from "fs";
import chalk from "chalk";

dotenv.config();
const isVerbose = false; // TODO: Make this an env variable too

let translateGPTConfig;
import(process.env.TRANSLATEGPT_JS_PATH)
  .then((module) => {
    translateGPTConfig = module.config;

    console.log(chalk.cyan("config: "), JSON.stringify(translateGPTConfig));
    init();
  })
  .catch((error) => {
    console.error(chalk.red("Error importing module:"), error);
  });

const openAIConfig = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openAIConfig);

const buildQueries = (mappedTranslateStrings) => {
  const tokenLimit = 500;
  const queries = [];
  let buildingTokens = 0;
  let buildingQuery = {};

  const getTokenCount = (str) => encode(str).length;

  Object.keys(mappedTranslateStrings).forEach((key) => {
    if (buildingTokens >= tokenLimit) {
      queries.push(JSON.stringify(buildingQuery));
      buildingTokens = 0;
      buildingQuery = {};
    }

    if (mappedTranslateStrings[key] === "") {
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
      role: "system",
      content:
        "The translations that will be asked for in this conversation will be used in the following way: " +
        translateGPTConfig.context +
        ". The following prompt will give you instructions on what to translate and how",
    },
    {
      role: "user",
      content: `This JSON is used in a platform implementing i18n, return it with the empty value strings filled in with the translation of the keys into ${language}. Values in {{}} are used for interpolation, so they should be placed correctly but anything inside {{}} should be not be translated. JSON ONLY. NO DISCUSSION. DO NOT ALTER THE KEYS IN THE JSON. ALWAYS FILL IN ONLY THE EMPTY STRING VALUE WITH YOUR TRANSLATION:  ${query} `,
    },
  ];

  // Only log the user prompt, since the system prompt doesn't change
  console.log(chalk.blue("Prompt: "), prompt[1]);
  console.log(
    chalk.yellow("Translations are still being generated, please wait.")
  );

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

// Merging new data from response into the building output, which should be a running list of translations, some with empty strings that will need to be filled
// Eventually, this building output should be a complete list of translations, and then we can stop running queries... but that's not happening rn!
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

// Returns a JSON object with the source translations that are missing in the output JSON
// Only adds to returned result if the key from source does not exist in output
const addMissingSourceTranslations = (
  sourceJSON,
  outputJSON,
  sourceLanguage
) => {
  console.log(chalk.cyan(`Adding translations from: ${sourceLanguage}`));
  const addedTranslations = {};

  if (sourceJSON && outputJSON) {
    console.log(chalk.cyan("JSON from source and output found, merging."));
    for (const [key, value] of Object.entries(sourceJSON)) {
      if (!outputJSON[key]) {
        addedTranslations[value] = "";
      }
    }
  } else if (sourceJSON && !outputJSON) {
    console.log(
      chalk.cyan("Output file/JSON not found, adding all source translations.")
    );
    for (const [key, value] of Object.entries(sourceJSON)) {
      addedTranslations[value] = "";
    }
  }

  return addedTranslations;
};

async function translate(addedTranslations, language) {
  let buildingOutput = { ...addedTranslations };
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
      const queryResponse = await sendQuery(query, language);

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

  let interpolations;
  try {
    interpolations = (str.match(regex) || []).reduce((obj, match) => {
      const key = match.replace(/{{|}}/g, "");
      obj[key] = true;
      return obj;
    }, {});
  } catch {
    interpolations = null;
  }

  return interpolations;
};

const isValidInterpolations = (query, queryResponse) => {
  const validInterpolations = getInterpolations(query);
  const responseInterpolations = getInterpolations(queryResponse);

  if (validInterpolations === null || responseInterpolations === null) {
    console.log(chalk.red("Error interpolating query."));
    return false;
  } else {
    const validKeys = Object.keys(validInterpolations);

    for (const key of validKeys) {
      if (!responseInterpolations[key]) {
        return false;
      }
    }

    return validKeys.length === Object.keys(responseInterpolations).length;
  }
};

const mergeExistingTranslations = (result, outputFile) => {
  if (fs.existsSync(outputFile)) {
    const existingJsonData = fs.readFileSync(outputFile, "utf-8");

    try {
      const parsedExistingData = JSON.parse(existingJsonData);
      console.log(
        chalk.cyan(
          "Destination file already exists, merging existing translations with new translations."
        )
      );
      if (isVerbose) {
        console.log(
          chalk.cyan(
            "Existing translations: ",
            JSON.stringify(JSON.stringify(Object.entries(parsedExistingData)))
          )
        );
        console.log(
          chalk.cyan(
            "New translations: ",
            JSON.stringify(Object.entries(result))
          )
        );
      }

      const mergedTranslations = { ...parsedExistingData, ...result };
      if (isVerbose) {
        console.log(chalk.blue("Merged translations: "), mergedTranslations);
      } else {
        console.log(chalk.blue("Translations merged successfully."));
      }
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
    if (isVerbose) {
      console.log(chalk.cyan(`File found: ${filePath}`));
    }
    try {
      const existingJsonData = fs.readFileSync(filePath, "utf-8");
      const parsedExistingData = JSON.parse(existingJsonData);
      if (isVerbose) {
        console.log(chalk.cyan(`File JSON parsed successfully.`));
      }
      return parsedExistingData;
    } catch {
      console.log(chalk.yellow(`Could not parse file JSON`));
    }
  } else {
    console.log(chalk.cyan("The file does not exist."));
    return null;
  }
};

if (!openAIConfig.apiKey) {
  console.log(
    chalk.red(
      "OpenAI API key not configured, please follow instructions in README.md"
    )
  );
  process.exit(1);
}

const remapSource = (source, output) => {
  if (Object.keys(output).length > 0) {
    console.log(chalk.yellow("Remapping source keys to output values."));
    if (isVerbose) {
      console.log(chalk.blue("Source", JSON.stringify(source)));
    }
    console.log(chalk.blue("Output", JSON.stringify(output)));
    const remap = {};
    for (const [key, value] of Object.entries(source)) {
      if (output[value]) {
        remap[key] = output[value];
      }
    }
    console.log(chalk.green("Remapped", JSON.stringify(remap)));
    return remap;
  } else {
    console.log(chalk.yellow("No results received for remapping, skipping."));
    return output;
  }
};

const init = async () => {
  for (const namespace of translateGPTConfig.namespaces) {
    const outputDirectory = `${process.env.TRANSLATEGPT_OUTPUT_DIRECTORY}/${namespace}`;
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory);
      console.log(chalk.cyan("Folder created: "), outputDirectory);
    }
    console.log(chalk.cyan(`Output directory set to: `), outputDirectory);
    for (const language of translateGPTConfig.languages) {
      const sourceLanguageAbbreviation =
        language.sourceLanguage ?? translateGPTConfig.sourceLanguage;
      const sourceLanguageFile = `${outputDirectory}/${namespace}.${sourceLanguageAbbreviation.replace(
        /\s/g,
        "_"
      )}.json`;
      console.log(
        chalk.cyan(`Source language file set to: `),
        sourceLanguageFile
      );
      const sourceJSON = getFileJSON(sourceLanguageFile);
      if (isVerbose) {
        console.log(chalk.cyan(`Source JSON set to: `), sourceJSON);
      }

      const outputFile = `${outputDirectory}/${namespace}.${language.abbreviation.replace(
        /\s/g,
        "_"
      )}.json`;
      console.log(chalk.cyan(`Output file set to: `), outputFile);
      const outputJSON = getFileJSON(outputFile);
      if (isVerbose) {
        console.log(chalk.cyan(`Output JSON set to: `), outputJSON);
      }

      const addedTranslations = addMissingSourceTranslations(
        sourceJSON,
        outputJSON,
        language.sourceLanguage ?? translateGPTConfig.sourceLanguage
      );
      // TODO: can also remove orphans here in a similar way

      // With no new translations in the source file, addedTranslations is empty {}, so no need to create any new files
      if (Object.keys(addedTranslations).length > 0) {
        console.log(
          chalk.yellow("addedTranslations after data parsing: "),
          addedTranslations
        );
        let result = await translate(addedTranslations, language.language);
        console.log(chalk.green("result"), result);

        result = remapSource(sourceJSON, result);
        result = mergeExistingTranslations(result, outputFile);

        if (isVerbose) {
          console.log(
            chalk.cyan(
              `Attempting to write file. Path: ${outputFile} | Result: ${JSON.stringify(
                result
              )}`
            )
          );
        }

        await new Promise((resolve, reject) => {
          fs.writeFile(
            outputFile,
            prettier.format(JSON.stringify(result), { parser: "json" }),
            (err) => {
              if (err) {
                console.error(err);
                reject(err);
              } else {
                console.log(
                  chalk.cyan("File written successfully: "),
                  outputFile
                );
                resolve();
              }
            }
          );
        });
      } else {
        console.log(
          chalk.cyan(
            "File contents are the same as output, skipping file write for: "
          ),
          outputFile
        );
      }
    }
  }
};
