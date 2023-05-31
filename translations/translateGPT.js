// Example of how to structure your translations file.

const settings = {
  settings: {
    sourceLanguage: "nl",
    useSourceTranslations: true,
    languages: [
      ["japanese", "jp"],
      ["dutch spoken informally specifically using je instead of u", "nl"],
      ["cat meows", "cat"],
    ],
    toTranslate: [
      [[], "app"],
      [[], "Instructor"],
    ],
  },
};

export default settings;
