# TranslateGPT

TranslateGPT is a tool to generate language translations using AI (OpenAI GPT-3). It helps in creating and updating translation files of user input for multiple languages.

## Installation

```bash
npm install translategpt
```

## Configuration

Before using TranslateGPT, you need to create a `.env` file based on the provided `.envExample`. Make sure the `.env` file is in your project root directory.

```
OPENAI_API_KEY=your_openai_api_key
TRANSLATEGPT_JS_PATH="path/to/your/translateGPT.js"
TRANSLATEGPT_OUTPUT_DIRECTORY="path/to/your/output/directory"
```

Replace `your_openai_api_key` with your actual OpenAI API key. Set the paths for `TRANSLATEGPT_JS_PATH` and `TRANSLATEGPT_OUTPUT_DIRECTORY` accordingly.

**Important**: Do not commit the `.env` file containing your API key. Make sure to include `.env` in your `.gitignore`.

## Usage

Create a `translateGPT.js` file in your project, which should contain two arrays:

1. `languages`: A list of languages to translate the text into. Each language should be represented as an array containing a description of the language and its abbreviation.
2. `toTranslate`: An array of arrays, each containing the strings to translate and a namespace for the translation file.

Example `translateGPT.js`:

```javascript
module.exports = {
  languages: [
    ["japanese", "jp"],
    ["dutch spoken informally specifically using je instead of u", "nl"],
  ],
  toTranslate: [
    [
      ["Submit", "Cancel", "Yes I would like to donate $12,000,000,000."],
      "app",
    ],
    [["Submit", "Unsubmit", "Hypersubmit"], "Instructor"],
  ],
};
```

Now, run `translategpt` in your terminal in the root of your project to generate translation files. The generated files will be saved in the output directory specified in the `.env` file (e.g., `"~/your_cool_project/translations"`). The generated files will have the following structure: `<namespace>.<language_abbreviation>.json`.

## License

This project is licensed under the MIT License.
