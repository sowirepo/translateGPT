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
      [["Confirm", "Shop", "Hamster Dance"], "app"],
      [
        [
          "If you look hard enough, you'll find our mascot- Hambone the Hamster King!",
        ],
        "Instructor",
      ],
    ],
  },
};

export default settings;
