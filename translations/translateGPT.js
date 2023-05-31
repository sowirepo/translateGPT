// Example of how to structure your translations file.

module.exports = {
  sourceLanguage: "nl",
  useSourceTranslations: true,
  languages: [
    ["japanese", "jp"],
    ["dutch spoken informally specifically using je instead of u", "nl"],
    ["cat meows", "cat"],
  ],
  toTranslate: [
    [
      ["Submit", "Cancel", "Yes I would like to donate $12,000,000,000."],
      "app",
    ],
    [["Submit", "Unsubmit", "Hypersubmit"], "Instructor"],
  ],
};
