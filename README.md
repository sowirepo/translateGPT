# TranslateGPT

A tool to generate i18n language translations using AI.

## Installation

To install the TranslateGPT package, use the following command:

```
npm install translategpt
```

## Configuration

Before using the package, make sure to set up the configuration files and environment variables.

### Environment Variables

Create a `.env` file in the root directory of your project and provide the following variables:

```
OPENAI_API_KEY=<your_openai_api_key>
TRANSLATEGPT_JS_PATH="<path_to_translateGPT.js>"
TRANSLATEGPT_OUTPUT_DIRECTORY="<path_to_output_directory>"
```

Note: Do not share your OpenAI API key with anyone and ensure that the `.env` file is added to the `.gitignore` file.

### TranslateGPT.js

Create a `translateGPT.js` file in the `translations` directory of your project and define the translation configuration using the `config` object. Here's an example:

```javascript
// Example of how to structure your translations file.

export const config = {
  sourceLanguage: "en",
  languages: [
    {
      language: "dutch spoken informally specifically using je instead of u",
      abbreviation: "nl",
    },
    {
      language: `german using the informal "duzen"`,
      abbreviation: "de",
      sourceLanguage: "nl",
    },
    {
      language: "japanese",
      abbreviation: "jp",
    },
    {
      language: "cat meows",
      abbreviation: "cat",
    },
    {
      language: "english with a hamster accent",
      abbreviation: "hamster",
    },
  ],
  namespaces: ["app", "shop"],
};
```

Modify the configuration according to your project's needs.

## Translations

Create translation JSON files for each namespace and language in the `translations` directory of your project. Here's an example:

### app.en.json

```json
{
  "Confirm": "Confirm",
  "Shop": "Shop",
  "Hamster Dance": "Hamster Dance",
  "The hamsters are currently {{hamsterStatus}}, if you watch for {{time}}, maybe they'll do something else?": "The hamsters are currently {{hamsterStatus}}, if you watch for {{time}}, maybe they'll do something else?"
}
```

### shop.en.json

```json
{
  "If you look hard enough, you'll find our mascot- Hambone the Hamster King!": "If you look hard enough, you'll find our mascot- Hambone the Hamster King!",
  "My favorite animal is a {{animal}}.": "My favorite animal is a {{animal}}."
}
```

Create translation files for each language and modify the content accordingly.

## Usage

Once you have set up the configuration and environment variables, you can generate the translation files using the `translategpt` command:

```bash
translategpt
```

The package will generate translations for the specified languages and namespaces, based on the source languages defined in the `translateGPT.js` configuration file.


## License

This package is licensed under the MIT license. See the license file for more information.
